// Vercel Serverless Function · /api/disponibilidade
// Lê o mapa online da DTCX no servidor (o navegador não consegue por bloqueio de CORS)
// e devolve só o status de cada unidade, sem nomes de imobiliárias.
const FONTE = 'https://feelnature.dtcx.com.br/mapaonline/?glo_id_empreendimento=11';

const LEGENDA = [
  'Não Vendida', 'Reservada', 'Assinado, com Sinal a creditar', 'Sinal Creditado, mas com todos os documentos na imobiliária',
  'Sinal a Creditar, mas com todos os documentos entregue', 'Sinal Creditado, mas com pendência', 'Sinal Creditado e sem pendência',
  'Processo Finalizado', 'cliente pediu distrato', 'Fora de venda',
];
const COR_RE = /(?:background(?:-color)?\s*:\s*|bgcolor\s*=\s*["']?)(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi;

const norm = (c) => (c || '').toLowerCase().replace(/\s+/g, '');
function ultimaCor(trecho) {
  let m, last = null;
  COR_RE.lastIndex = 0;
  while ((m = COR_RE.exec(trecho))) last = m[1];
  return last ? norm(last) : null;
}
const decode = (t) => t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
function tokens(html) {
  return decode(html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(br|\/div|\/span|\/td|\/p|\/li|\/h\d|\/a|\/b|\/strong|\/label)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const TIPO = /^(COB |GD )?1Q$/i, DATA = /^\d{2}\/\d{2}\/\d{4}$/, UNID = /^\d{3}$/;

function parse(html) {
  // mapa de cores da legenda (se a página usar cor inline)
  const corLegenda = {};
  for (const nome of LEGENDA) {
    const i = html.indexOf(nome);
    if (i < 0) continue;
    const c = ultimaCor(html.slice(Math.max(0, i - 500), i));
    if (c && !corLegenda[c]) corLegenda[c] = nome;
  }
  const unidades = [];
  const partes = html.split(/BLOCO\s*0?([1-4])\b/i);
  for (let k = 1; k < partes.length; k += 2) {
    const b = +partes[k];
    const bruto = partes[k + 1] || '';
    const tk = tokens(bruto);
    let busca = 0;
    for (let i = 0; i < tk.length; i++) {
      if (!UNID.test(tk[i])) continue;
      const u = tk[i];
      const prev = tk[i - 1] || '';
      const next = tk[i + 1] || '';
      const imob = prev && !TIPO.test(prev) && !UNID.test(prev) && !DATA.test(prev) ? prev : null;
      const data = DATA.test(next) ? next : null;
      // cor do quadradinho: última cor inline antes do número no HTML
      const pos = bruto.indexOf('>' + u, busca);
      let cor = null;
      if (pos >= 0) { cor = ultimaCor(bruto.slice(Math.max(busca, pos - 700), pos)); busca = pos + 1; }
      const legenda = cor && corLegenda[cor] ? corLegenda[cor] : null;
      let disponivel;
      if (legenda) disponivel = legenda === 'Não Vendida';
      else disponivel = !imob && !data;
      unidades.push({ b, u, d: disponivel ? 1 : 0, s: legenda || (disponivel ? 'Não Vendida' : 'Indisponível') });
    }
  }
  // remove duplicadas (mantém a primeira ocorrência)
  const vistos = new Set();
  return {
    unidades: unidades.filter((x) => { const k = x.b + '-' + x.u; if (vistos.has(k)) return false; vistos.add(k); return true; }),
    metodo: Object.keys(corLegenda).length >= 2 ? 'cor' : 'texto',
  };
}

module.exports = async (req, res) => {
  try {
    const r = await fetch(FONTE, { headers: { 'User-Agent': 'Mozilla/5.0 (FeelNature3D)', Accept: 'text/html' } });
    if (!r.ok) throw new Error('DTCX respondeu ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    let html = buf.toString('utf8');
    if (html.includes('�')) html = buf.toString('latin1');
    if (req.query && req.query.debug) {
      const i = html.indexOf('601');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(200).send(html.slice(Math.max(0, i - 1500), i + 600) + '\n\n----- LEGENDA -----\n' + html.slice(Math.max(0, html.indexOf('Não Vendida') - 800), html.indexOf('Não Vendida') + 300));
      return;
    }
    const out = parse(html);
    if (out.unidades.length < 300) throw new Error('Leitura incompleta: ' + out.unidades.length + ' unidades');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ atualizado: new Date().toISOString(), fonte: 'Mapa online DTCX', metodo: out.metodo, disponiveis: out.unidades.filter((x) => x.d).length, unidades: out.unidades });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ erro: String(e.message || e) });
  }
};
module.exports.parse = parse;
