// Vercel Serverless Function · /api/disponibilidade
// Lê o mapa online da DTCX no servidor (o navegador não consegue por bloqueio de CORS)
// e devolve só o status de cada unidade, sem nomes de imobiliárias.
const FONTE = 'https://feelnature.dtcx.com.br/mapaonline/?glo_id_empreendimento=11';

const LEGENDA = [
  'Não Vendida', 'Reservada', 'Assinado, com Sinal a creditar', 'Sinal Creditado, mas com todos os documentos na imobiliária',
  'Sinal a Creditar, mas com todos os documentos entregue', 'Sinal Creditado, mas com pendência', 'Sinal Creditado e sem pendência',
  'Processo Finalizado', 'cliente pediu distrato', 'Fora de venda',
];
// Regra de cores do site (definida pelo comercial):
// verde = Não Vendida / Estoque · amarelo = as 3 situações abaixo · cinza (sem acesso) = qualquer outra
const AMARELO = ['Reservada', 'Assinado, com Sinal a creditar', 'Sinal a Creditar, mas com todos os documentos entregue'];
const statusDe = (legenda) => (legenda === 'Não Vendida' ? 'd' : AMARELO.includes(legenda) ? 'r' : 'v');
const CLS_RE = /class\s*=\s*["']([^"']+)["']/gi;
// classes dos atributos class="" mais próximos do fim do trecho (o mais próximo primeiro)
function classes(trecho, n = 3) {
  const out = []; let m; CLS_RE.lastIndex = 0;
  while ((m = CLS_RE.exec(trecho))) out.push(m[1]);
  return out.slice(-n).reverse().join(' ').split(/\s+/).filter(Boolean);
}
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

// ---------- Leitura principal: estrutura real do mapa DTCX ----------
// Cada unidade é um <div class="my-card ..." style="background-color:#COR;"> com <div class="card-numero">601</div>,
// dentro de <h2 class="titulo-bloco">BLOCO 0X</h2>. A legenda (nome + cor de cada situação) vem em var STATS_DATA.status_map.
// Regra de acesso no site: 1 = disponível (com preço) · 2, 3, 5 = clicável sem preço · demais = sem acesso.
const ACESSO_PRECO = ['1'];
const ACESSO_BASICO = ['2', '3', '5'];
const acesso = (id) => (ACESSO_PRECO.includes(id) ? 'd' : ACESSO_BASICO.includes(id) ? 'r' : 'v');

function parseDTCX(html) {
  const m = html.match(/var\s+STATS_DATA\s*=\s*(\{[\s\S]*?\});\s*(?:\n|<\/script>|var\s)/);
  if (!m) return null;
  let stats; try { stats = JSON.parse(m[1]); } catch (e) { return null; }
  const map = stats.status_map || {};
  const porCor = {};
  for (const id in map) porCor[norm(map[id].cor)] = id;
  const blocos = [...html.matchAll(/<h2[^>]*titulo-bloco[^>]*>\s*BLOCO\s*0?(\d)\s*<\/h2>/gi)].map((x) => ({ i: x.index, b: +x[1] }));
  const re = /<div class="my-card[^"]*"\s+style="background-color:\s*(#[0-9a-f]{3,8})\s*;?"([^>]*)>[\s\S]*?<div class="card-numero">\s*(\d{3})\s*<\/div>/gi;
  const unidades = []; const vistos = new Set();
  for (const x of html.matchAll(re)) {
    const bl = blocos.filter((k) => k.i < x.index).pop();
    if (!bl) continue;
    const key = bl.b + '-' + x[3];
    if (vistos.has(key)) continue; vistos.add(key);
    const id = porCor[norm(x[1])] || null;
    const conteudo = (x[2].match(/data-bs-content="([^"]*)"/) || [])[1] || '';
    const pos = (decode(conteudo.replace(/&lt;/g, '<').replace(/&gt;/g, '>')).match(/Posi[çc][ãa]o:<\/strong>\s*([A-Za-zÀ-ú]+)/) || [])[1] || null;
    const st = id ? acesso(id) : 'v';
    unidades.push({ b: bl.b, u: x[3], s: id, st, d: st === 'd' ? 1 : 0, pos });
  }
  const status = {};
  for (const id in map) status[id] = { nome: map[id].nome, cor: map[id].cor, acesso: acesso(id) };
  return { unidades, status, metodo: 'dtcx', total: stats.total, geral: stats.geral };
}

function parse(html) {
  // mapa de cores da legenda (se a página usar cor inline)
  const corLegenda = {};
  for (const nome of LEGENDA) {
    const i = html.indexOf(nome);
    if (i < 0) continue;
    const c = ultimaCor(html.slice(Math.max(0, i - 500), i));
    if (c && !corLegenda[c]) corLegenda[c] = nome;
  }
  // mapa de classes CSS da legenda (se a página usar classes em vez de cor inline)
  const clsCount = {}, clsLabel = {};
  for (const nome of LEGENDA) {
    const i = html.indexOf(nome);
    if (i < 0) continue;
    for (const c of new Set(classes(html.slice(Math.max(0, i - 400), i), 1))) { clsCount[c] = (clsCount[c] || 0) + 1; clsLabel[c] = nome; }
  }
  const clsLegenda = {};
  for (const c in clsCount) if (clsCount[c] === 1) clsLegenda[c] = clsLabel[c];
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
      const ini = Math.max(busca, pos - 700);   // trecho só desta unidade (desde a anterior)
      if (pos >= 0) { cor = ultimaCor(bruto.slice(ini, pos)); busca = pos + 1; }
      let legenda = cor && corLegenda[cor] ? corLegenda[cor] : null;
      if (!legenda && pos >= 0) {
        const cl = classes(bruto.slice(ini, pos)).find((c) => clsLegenda[c]);
        if (cl) legenda = clsLegenda[cl];
      }
      // st: d = verde, r = amarelo, v = cinza sem acesso. Sem legenda identificada, usa imobiliária/data.
      const st = legenda ? statusDe(legenda) : (!imob && !data ? 'd' : 'v');
      unidades.push({ b, u, d: st === 'd' ? 1 : 0, st });
    }
  }
  // remove duplicadas (mantém a primeira ocorrência)
  const vistos = new Set();
  return {
    unidades: unidades.filter((x) => { const k = x.b + '-' + x.u; if (vistos.has(k)) return false; vistos.add(k); return true; }),
    metodo: Object.keys(corLegenda).length >= 2 ? 'cor' : Object.keys(clsLegenda).length >= 2 ? 'classe' : 'texto',
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
    const out = parseDTCX(html) || parse(html);
    if (out.unidades.length < 300) throw new Error('Leitura incompleta: ' + out.unidades.length + ' unidades');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    // as vendidas/indisponíveis saem só com bloco, número e situação (sem posição)
    const unidades = out.unidades.map((x) => (x.st === 'v' ? { b: x.b, u: x.u, s: x.s, st: 'v', d: 0 } : x));
    res.status(200).json({ atualizado: new Date().toISOString(), fonte: 'Mapa online DTCX', metodo: out.metodo, disponiveis: unidades.filter((x) => x.st === 'd').length, reservadas: unidades.filter((x) => x.st === 'r').length, status: out.status || null, unidades });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ erro: String(e.message || e) });
  }
};
module.exports.parse = parse;
module.exports.parseDTCX = parseDTCX;
