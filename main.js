import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* ---------- Configuração editável ---------- */
const CONFIG = {
  contato: { label: 'Tenho interesse', url: 'https://linktr.ee/comercialcalper' },
  links: [
    { label: 'Tour 360', url: 'https://feelpontaloceanico.com.br/metaverso' },
    { label: 'Decorado virtual', url: 'https://aboutavisit.com/feel-pontal-oceanico-calper' },
    { label: 'Ultratour', url: 'https://tour.ultratour.com.br/sas-calper/feel/index.html' },
    { label: 'Site', url: 'https://feelpontaloceanico.com.br' },
  ],
};

/* ---------- Geometria do empreendimento (masterplan da ficha técnica) ---------- */
const W = 4.4;          // largura de cada coluna (m, aproximada)
const D = 7.6;          // profundidade da unidade
const CORR = 2.2;       // circulação entre as fileiras
const BLOCKS = {        // centro de cada bloco no terreno (x: rua → lazer, z: nascente(-) → poente(+))
  1: { x: -26, z: 27 },
  2: { x: -26, z: -27 },
  3: { x: 26, z: -27 },
  4: { x: 26, z: 27 },
};
// Ordem das colunas da esquerda (rua) para a direita (lazer)
const ROWS = {
  north: { // blocos 2 e 3 (lado nascente)
    outer: ['13', '12', '11', '10', '09', '08', '07', '06', '05'],
    inner: ['14', '15', '16', '17', '18', '01', '02', '03', '04'],
  },
  south: { // blocos 1 e 4 (lado poente)
    inner: ['04', '03', '02', '01', '18', '17', '16', '15', '14'],
    outer: ['05', '06', '07', '08', '09', '10', '11', '12', '13'],
  },
};
const floorY = (f) => (f === 1 ? 0 : f === 6 ? 14.0 : 3.12 + (f - 2) * 2.72);
const floorH = (f) => (f === 1 ? 3.0 : 2.6);

const TIPOS = {
  G: { nome: 'Garden Studio', curto: 'Garden' },
  S: { nome: 'Studio Design', curto: 'Studio' },
  D: { nome: 'Studio Dúplex', curto: 'Dúplex' },
};
const tipoDe = (f) => (f === 1 ? 'G' : f === 6 ? 'D' : 'S');
const pavNome = (f) => (f === 1 ? 'Térreo' : f === 6 ? 'Cobertura' : `${f}º pavimento`);

function plantas(f, c) {
  const inA = (arr) => arr.includes(c);
  if (f === 1) {
    if (inA(['04', '05', '13', '14'])) return [['Planta', 'G-B']];
    if (inA(['09', '10'])) return [['Planta', 'G-C']];
    if (c === '16') return [['Planta', 'G-D']];
    return [['Planta', 'G-A']];
  }
  if (f < 6) {
    if (inA(['04', '05', '13', '14'])) return [['Planta', 'S-B']];
    if (inA(['09', '10'])) return [['Planta', 'S-C']];
    if (inA(['17', '18'])) return [['Planta', 'S-D']];
    return [['Planta', 'S-A']];
  }
  let inf = 'D-INF-A', sup = 'D-SUP-1';
  if (inA(['04', '05', '13', '14'])) { inf = 'D-INF-B'; sup = 'D-SUP-B'; }
  else if (inA(['09', '10'])) { inf = 'D-INF-C'; sup = 'D-SUP-C'; }
  else if (inA(['17', '18'])) { inf = 'D-INF-D'; sup = 'D-SUP-D'; }
  else if (inA(['02', '07'])) sup = 'D-SUP-2';
  else if (inA(['03', '06', '12', '15'])) sup = 'D-SUP-3';
  return [['Pavimento inferior', inf], ['Pavimento superior', sup]];
}

/* ---------- Formatação ---------- */
const brl = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const mil = (v) => 'R$ ' + Math.round(v / 1000).toLocaleString('pt-BR') + ' mil';
const m2 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' m²';

/* ---------- Estado ---------- */
const state = {
  tipos: new Set(['G', 'S', 'D']),
  blocos: new Set([1, 2, 3, 4]),
  andar: 0,          // 0 = todos; 1..6 corta o prédio acima
  precoMax: Infinity,
  soDisp: false,
  sel: null,
  hover: null,
};
let units = [], meta = {};
const $ = (s) => document.querySelector(s);

/* ---------- Cena ---------- */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#111813');
scene.fog = new THREE.Fog('#111813', 190, 380);

const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 22;
controls.maxDistance = 280;
controls.maxPolarAngle = 1.47;
controls.target.set(6, 6, 0);
camera.position.set(-150, 120, 170);

scene.add(new THREE.HemisphereLight('#dfe9f2', '#33402f', 0.85));
const sun = new THREE.DirectionalLight('#fff1dc', 2.2);
sun.position.set(-70, 110, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 90, bottom: -90, near: 10, far: 320 });
sun.shadow.bias = -0.0004;
scene.add(sun);
const fill = new THREE.DirectionalLight('#9fc3ff', 0.35);
fill.position.set(80, 60, -80);
scene.add(fill);

/* Texturas geradas: ripado de madeira da fachada */
function slatTexture(base, gap) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = gap; g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 8) {
    const t = (Math.sin(x * 12.9898) * 43758.5453) % 1;
    g.fillStyle = base;
    g.globalAlpha = 0.86 + Math.abs(t) * 0.14;
    g.fillRect(x + 1, 0, 6, 128);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.anisotropy = 4;
  return tex;
}
const woodTex = slatTexture('#b98a5e', '#3b2a1d');

const MAT = {
  vendido: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85, metalness: 0 }),
  vendidoGhost: new THREE.MeshStandardMaterial({ color: '#6d6152', transparent: true, opacity: 0.16, roughness: 1, depthWrite: false }),
  disp: new THREE.MeshStandardMaterial({ color: '#9ee0ae', emissive: '#2fae5f', emissiveIntensity: 0.55, roughness: 0.45 }),
  dispFora: new THREE.MeshStandardMaterial({ color: '#c7cbb6', emissive: '#2f4a36', emissiveIntensity: 0.25, roughness: 0.7 }),
  hover: new THREE.MeshStandardMaterial({ color: '#f3fff5', emissive: '#7ff0a2', emissiveIntensity: 0.9, roughness: 0.4 }),
  sel: new THREE.MeshStandardMaterial({ color: '#ffe3a1', emissive: '#e9a93a', emissiveIntensity: 0.95, roughness: 0.4 }),
  slab: new THREE.MeshStandardMaterial({ color: '#2b2c28', roughness: 0.75 }),
  core: new THREE.MeshStandardMaterial({ color: '#3d3e39', roughness: 0.9 }),
  lobby: new THREE.MeshStandardMaterial({ color: '#8fb3b9', roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.55 }),
  lawn: new THREE.MeshStandardMaterial({ color: '#4f7a45', roughness: 1 }),
  pave: new THREE.MeshStandardMaterial({ color: '#b9b2a2', roughness: 1 }),
  sand: new THREE.MeshStandardMaterial({ color: '#2a332b', roughness: 1 }),
  road: new THREE.MeshStandardMaterial({ color: '#1d201d', roughness: 1 }),
  water: new THREE.MeshStandardMaterial({ color: '#47b7c9', emissive: '#145a66', emissiveIntensity: 0.35, roughness: 0.1, metalness: 0.2 }),
  deck: new THREE.MeshStandardMaterial({ color: '#a77d55', roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#3f6b3a', roughness: 1 }),
  leaf2: new THREE.MeshStandardMaterial({ color: '#5c8a4a', roughness: 1 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 1 }),
  line: new THREE.MeshBasicMaterial({ color: '#e8e2d2' }),
  car: new THREE.MeshStandardMaterial({ color: '#555b5e', roughness: 0.5 }),
};

const box = (w, h, d, mat, x, y, z, shadow = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = shadow; m.receiveShadow = true;
  scene.add(m);
  return m;
};
const plane = (w, d, mat, x, z, y = 0) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
  scene.add(m); return m;
};

/* Terreno */
plane(700, 700, MAT.sand, 0, 0, -0.05);
plane(14, 120, MAT.road, -66, 0, -0.02);
plane(136, 96, MAT.pave, 10, 0, 0);
for (const k of Object.keys(BLOCKS)) {
  const b = BLOCKS[k];
  plane(9 * W + 8, 2 * D + CORR + 8, MAT.lawn, b.x, b.z, 0.02);
}
plane(12, 30, MAT.lawn, 0, -30, 0.02);   // pet place
plane(12, 30, MAT.lawn, 0, 30, 0.02);    // play kids / redário
// vagas
for (let i = 0; i < 26; i++) {
  const x = -50 + i * 4;
  if (Math.abs(x) < 7) continue;
  for (const z of [-11.5, 11.5]) {
    plane(0.12, 5, MAT.line, x, z, 0.03);
    if ((i * 7 + (z > 0 ? 3 : 0)) % 3 === 0) box(1.8, 1.3, 4.2, MAT.car, x + 2, 0, z, true);
  }
}
// piscina e lazer
{
  const s = new THREE.Shape();
  s.moveTo(-5, -12); s.bezierCurveTo(4, -15, 8, -6, 4, 0); s.bezierCurveTo(1, 5, 7, 11, 1, 13);
  s.bezierCurveTo(-6, 15, -8, 4, -5, -2); s.bezierCurveTo(-3, -6, -10, -9, -5, -12);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(s), MAT.deck);
  deck.rotation.x = -Math.PI / 2; deck.position.set(60, 0.04, 0); deck.scale.set(1.35, 1.35, 1); deck.receiveShadow = true; scene.add(deck);
  const pool = new THREE.Mesh(new THREE.ShapeGeometry(s), MAT.water);
  pool.rotation.x = -Math.PI / 2; pool.position.set(60, 0.08, 0); scene.add(pool);
}
box(10, 3.4, 9, MAT.core, 74, 0, -6);    // salão de festas / coworking
box(10, 3.4, 10, MAT.core, 74, 0, 8);    // academia
box(6, 3, 6, MAT.core, 74, 0, -26);      // churrasqueira
box(6, 3, 6, MAT.core, 74, 0, 28);       // pool house
plane(10, 12, MAT.lawn, 74, -17, 0.02);
plane(10, 10, MAT.lawn, 74, 19, 0.02);
box(5, 3, 7, MAT.core, -55, 0, -4);      // guarita
box(4, 1, 12, MAT.slab, -48, 0, 0);

/* Árvores */
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const treePts = [];
for (let i = 0; i < 26; i++) treePts.push([-60 + rnd() * 4, -44 + i * 3.6]);
for (let i = 0; i < 20; i++) treePts.push([-52 + i * 5.6, -45 + rnd() * 2]);
for (let i = 0; i < 20; i++) treePts.push([-52 + i * 5.6, 45 + rnd() * 2]);
for (const x of [-38, -26, -14, 14, 26, 38]) treePts.push([x, -3 + rnd() * 2], [x + 3, 3 + rnd() * 2]);
for (let i = 0; i < 8; i++) treePts.push([-3 + rnd() * 6, -40 + rnd() * 18], [-3 + rnd() * 6, 22 + rnd() * 18]);
for (let i = 0; i < 9; i++) treePts.push([52 + rnd() * 3, -20 + i * 5]);
{
  const crown = new THREE.IcosahedronGeometry(1, 1);
  const trunkG = new THREE.CylinderGeometry(0.18, 0.25, 1, 6);
  const crowns = [new THREE.InstancedMesh(crown, MAT.leaf, treePts.length), new THREE.InstancedMesh(crown, MAT.leaf2, treePts.length)];
  const trunks = new THREE.InstancedMesh(trunkG, MAT.trunk, treePts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  treePts.forEach(([x, z], i) => {
    const s = 1.6 + rnd() * 1.6, h = 2.2 + rnd() * 2.5;
    trunks.setMatrixAt(i, m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(1, h, 1)));
    crowns[i % 2].setMatrixAt(i, m.compose(new THREE.Vector3(x, h + s * 0.7, z), q, new THREE.Vector3(s, s * 0.9, s)));
    crowns[(i + 1) % 2].setMatrixAt(i, m.compose(new THREE.Vector3(0, -999, 0), q, new THREE.Vector3(0, 0, 0)));
  });
  for (const c of [...crowns, trunks]) { c.castShadow = true; c.receiveShadow = true; scene.add(c); }
}

/* Prédios */
const unitMeshes = [];    // meshes clicáveis
const floorParts = [];    // {mesh, floor} para corte por pavimento
const byKey = new Map();

function rowZ(b, rowName) {
  const B = BLOCKS[b];
  const north = b === 2 || b === 3;
  const off = CORR / 2 + D / 2;
  // nascente = -z. Blocos 2/3: fileira externa no lado nascente. Blocos 1/4: externa no lado poente.
  if (north) return rowName === 'outer' ? B.z - off : B.z + off;
  return rowName === 'outer' ? B.z + off : B.z - off;
}
function facing(b, rowName) {
  const north = b === 2 || b === 3;
  if (north) return rowName === 'outer' ? -1 : 1;
  return rowName === 'outer' ? 1 : -1;
}

function buildBlock(b) {
  const B = BLOCKS[b];
  const rows = (b === 2 || b === 3) ? ROWS.north : ROWS.south;
  for (let f = 1; f <= 6; f++) {
    const y = floorY(f), h = floorH(f);
    // laje
    const slab = box(9 * W + 0.6, 0.32, 2 * D + CORR + 0.6, MAT.slab, B.x, y - 0.32 + (f === 1 ? 0.32 : 0), B.z);
    floorParts.push({ mesh: slab, floor: f });
    // circulação
    const core = box(9 * W, h, CORR, MAT.core, B.x, y, B.z);
    floorParts.push({ mesh: core, floor: f });
    for (const rowName of ['outer', 'inner']) {
      rows[rowName].forEach((c, i) => {
        const x = B.x + (i - 4) * W;
        const z = rowZ(b, rowName);
        if (f === 1 && (c === '17' || c === '18')) {
          const lob = box(W - 0.15, h, D - 0.15, MAT.lobby, x, y, z);
          floorParts.push({ mesh: lob, floor: f });
          return;
        }
        const key = `${b}-${f}${c}`;
        const u = byKey.get(key);
        if (!u) return;
        const meshes = [];
        const m = box(W - 0.16, h, D - 0.16, MAT.vendido, x, y, z);
        meshes.push(m);
        if (f === 6) { // dependência de cobertura recuada para o lado da circulação
          const dz = facing(b, rowName);
          const upD = 3.8;
          const zu = z - dz * (D / 2 - upD / 2);
          const slabU = box(W - 0.05, 0.3, upD + 0.2, MAT.slab, x, 16.82, zu);
          floorParts.push({ mesh: slabU, floor: 6 });
          meshes.push(box(W - 0.16, 2.5, upD - 0.1, MAT.vendido, x, 17.12, zu));
          const pool = box(1.4, 0.18, 1.6, MAT.water, x - 0.9, 16.75, z + dz * (D / 2 - 1.2), false);
          floorParts.push({ mesh: pool, floor: 6 });
        }
        if (f === 1) { // garden privativo
          const dz = facing(b, rowName);
          plane(W - 0.3, 3.4, MAT.lawn, x, z + dz * (D / 2 + 1.8), 0.04);
        }
        meshes.forEach((mm) => { mm.userData.key = key; unitMeshes.push(mm); floorParts.push({ mesh: mm, floor: f }); });
        u.meshes = meshes;
        u.pos = new THREE.Vector3(x, y + h / 2, z);
        u.normal = facing(b, rowName);
        u.row = rowName;
        u.colIndex = i;
      });
    }
  }
  // casa de máquinas
  const cm = box(6, 2.6, CORR + 3, MAT.core, B.x, 17.12, B.z);
  floorParts.push({ mesh: cm, floor: 6 });
}

/* ---------- Dados derivados ---------- */
function orientacao(u) {
  const north = u.b === 2 || u.b === 3;
  const nascente = north ? u.row === 'outer' : u.row === 'inner';
  const lado = u.row === 'outer' ? 'Vista para os fundos' : 'Vista para o pátio central';
  return { sol: nascente ? 'Nascente · sol da manhã' : 'Poente · sol da tarde', lado };
}
function ponta(u) {
  const c = u.u.slice(1);
  if (!['04', '05', '13', '14'].includes(c)) return null;
  const ladoRua = u.colIndex === 0;
  return ladoRua ? 'Unidade de ponta · lado da rua' : 'Unidade de ponta · lado do lazer';
}
const matches = (u) =>
  state.tipos.has(u.tipo) && state.blocos.has(u.b) && (!state.andar || u.f === state.andar) &&
  (u.st !== 'd' || u.p <= state.precoMax);

/* ---------- Pintura ---------- */
function paint() {
  for (const u of units) {
    if (!u.meshes) continue;
    let mat;
    const ok = matches(u);
    if (state.sel === u) mat = MAT.sel;
    else if (state.hover === u) mat = u.st === 'd' ? MAT.hover : MAT.vendido;
    else if (u.st === 'd') mat = ok ? MAT.disp : MAT.dispFora;
    else mat = state.soDisp ? MAT.vendidoGhost : MAT.vendido;
    u.meshes.forEach((m) => { m.material = mat; m.castShadow = mat !== MAT.vendidoGhost; });
  }
  for (const p of floorParts) p.mesh.visible = !state.andar || p.floor <= state.andar;
}

/* ---------- UI ---------- */
function buildFilters() {
  const tiposEl = $('#f-tipos');
  tiposEl.innerHTML = Object.entries(TIPOS).map(([k, t]) => {
    const n = units.filter((u) => u.tipo === k && u.st === 'd').length;
    return `<button class="chip on" data-tipo="${k}" aria-pressed="true">${t.curto}<span>${n}</span></button>`;
  }).join('');
  tiposEl.onclick = (e) => {
    const b = e.target.closest('[data-tipo]'); if (!b) return;
    const k = b.dataset.tipo;
    if (state.tipos.has(k) && state.tipos.size > 1) state.tipos.delete(k); else state.tipos.add(k);
    syncChips(); update();
  };
  const blEl = $('#f-blocos');
  blEl.innerHTML = [1, 2, 3, 4].map((b) => `<button class="chip on" data-bloco="${b}" aria-pressed="true">Bloco ${b}</button>`).join('');
  blEl.onclick = (e) => {
    const b = e.target.closest('[data-bloco]'); if (!b) return;
    const k = +b.dataset.bloco;
    if (state.blocos.has(k) && state.blocos.size > 1) state.blocos.delete(k); else state.blocos.add(k);
    syncChips(); update();
  };
  const anEl = $('#f-andar');
  anEl.innerHTML = `<button class="seg on" data-andar="0">Todos</button>` +
    [1, 2, 3, 4, 5, 6].map((f) => `<button class="seg" data-andar="${f}" title="${pavNome(f)}">${f === 1 ? 'T' : f === 6 ? 'C' : f + 'º'}</button>`).join('');
  anEl.onclick = (e) => {
    const b = e.target.closest('[data-andar]'); if (!b) return;
    state.andar = +b.dataset.andar; syncChips(); update();
  };
  const disp = units.filter((u) => u.st === 'd');
  const min = Math.min(...disp.map((u) => u.p)), max = Math.max(...disp.map((u) => u.p));
  const r = $('#f-preco');
  r.min = Math.floor(min / 5000) * 5000; r.max = Math.ceil(max / 5000) * 5000; r.step = 5000; r.value = r.max;
  const lab = () => { $('#f-preco-v').textContent = +r.value >= +r.max ? 'Qualquer valor' : 'até ' + mil(+r.value); };
  r.oninput = () => { state.precoMax = +r.value >= +r.max ? Infinity : +r.value; lab(); update(); };
  lab();
  $('#f-sodisp').onchange = (e) => { state.soDisp = e.target.checked; update(); };
  $('#f-limpar').onclick = () => {
    state.tipos = new Set(['G', 'S', 'D']); state.blocos = new Set([1, 2, 3, 4]); state.andar = 0; state.precoMax = Infinity;
    r.value = r.max; lab(); syncChips(); update();
  };
}
function syncChips() {
  document.querySelectorAll('[data-tipo]').forEach((b) => { const on = state.tipos.has(b.dataset.tipo); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  document.querySelectorAll('[data-bloco]').forEach((b) => { const on = state.blocos.has(+b.dataset.bloco); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  document.querySelectorAll('[data-andar]').forEach((b) => b.classList.toggle('on', +b.dataset.andar === state.andar));
}

function renderList() {
  const list = units.filter((u) => u.st === 'd' && matches(u)).sort((a, b) => a.p - b.p);
  $('#count').textContent = list.length;
  $('#count-m').textContent = list.length;
  $('#list').innerHTML = list.length ? list.map((u) => `
    <button class="row${state.sel === u ? ' sel' : ''}" data-key="${u.key}">
      <span class="r-id"><b>${u.u}</b><small>Bloco ${u.b}</small></span>
      <span class="r-tipo">${TIPOS[u.tipo].nome}<small>${m2(u.a)}</small></span>
      <span class="r-preco">${mil(u.p)}</span>
    </button>`).join('') : `<p class="empty">Nenhuma unidade disponível com esses filtros. Amplie a faixa de preço ou inclua outros blocos.</p>`;
}
$('#list').onclick = (e) => { const b = e.target.closest('[data-key]'); if (b) select(byKey.get(b.dataset.key), true); };

function update() { paint(); renderList(); }

/* Painel da unidade */
function select(u, fly) {
  state.sel = u;
  update();
  if (!u) { $('#unit').hidden = true; document.body.classList.remove('has-unit'); return; }
  if (state.andar && state.andar < u.f) { state.andar = 0; syncChips(); paint(); }
  const o = orientacao(u), p = ponta(u);
  const pl = plantas(u.f, u.u.slice(1));
  const fl = meta.fluxo;
  const preco = u.st === 'd' ? `
    <div class="price"><small>Preço de tabela</small><strong>${brl(u.p)}</strong></div>
    <table class="fluxo">
      <thead><tr><th>Fluxo de pagamento</th><th>Parcelas</th><th>Valor</th></tr></thead>
      <tbody>
        <tr><td>Sinal <small>${fl.sinal.inicio} · ${fl.sinal.pct}%</small></td><td>1×</td><td>${brl(u.s)}</td></tr>
        <tr><td>Mensais <small>a partir de ${fl.mensais.inicio} · ${fl.mensais.pct}%</small></td><td>${fl.mensais.n}×</td><td>${brl(u.m)}</td></tr>
        <tr><td>Intermediárias <small>a partir de ${fl.intermediarias.inicio} · ${fl.intermediarias.pct}%</small></td><td>${fl.intermediarias.n}×</td><td>${brl(u.i)}</td></tr>
        <tr><td>Parcela única <small>${fl.unica.inicio} · ${fl.unica.pct}%</small></td><td>1×</td><td>${brl(u.fin)}</td></tr>
      </tbody>
    </table>
    <a class="cta" href="${CONFIG.contato.url}" target="_blank" rel="noopener">${CONFIG.contato.label} na unidade ${u.u}</a>`
    : `<div class="sold"><strong>Unidade vendida</strong><p>Veja as unidades disponíveis com a mesma planta.</p>
       <button class="ghost" id="similares">Mostrar ${TIPOS[u.tipo].nome} disponíveis</button></div>`;
  $('#unit-body').innerHTML = `
    <p class="eyebrow">Bloco ${u.b} · ${pavNome(u.f)}</p>
    <h2 class="u-num">${u.u}</h2>
    <p class="u-tipo">${TIPOS[u.tipo].nome} <span>·</span> ${m2(u.a)} privativos</p>
    <ul class="tags">
      <li class="${u.st === 'd' ? 'st-d' : 'st-v'}">${u.st === 'd' ? 'Disponível' : 'Vendida'}</li>
      <li>${o.sol}</li><li>${o.lado}</li>${p ? `<li>${p}</li>` : ''}
    </ul>
    ${preco}
    <div class="plantas">
      ${pl.length > 1 ? `<div class="pl-tabs">${pl.map(([n], i) => `<button class="seg${i ? '' : ' on'}" data-pl="${i}">${n}</button>`).join('')}</div>` : `<p class="label">Planta</p>`}
      <button class="pl-img" id="pl-open" aria-label="Ampliar planta"><img id="pl-img" src="plantas/${pl[0][1]}.webp" alt="Planta ${TIPOS[u.tipo].nome}, unidade ${u.u}" loading="lazy"></button>
      <p class="note">Planta ilustrativa da coluna ${u.u.slice(1)}. Mobiliário meramente sugestivo; podem existir pequenas variações entre colunas.</p>
    </div>`;
  const tabs = $('#unit-body .pl-tabs');
  if (tabs) tabs.onclick = (e) => {
    const b = e.target.closest('[data-pl]'); if (!b) return;
    tabs.querySelectorAll('.seg').forEach((x) => x.classList.toggle('on', x === b));
    $('#pl-img').src = `plantas/${pl[+b.dataset.pl][1]}.webp`;
  };
  $('#pl-open').onclick = () => { $('#lb-img').src = $('#pl-img').src; $('#lightbox').hidden = false; };
  const sim = $('#similares');
  if (sim) sim.onclick = () => { state.tipos = new Set([u.tipo]); state.blocos = new Set([1, 2, 3, 4]); state.andar = 0; syncChips(); select(null); openFilters(true); };
  $('#unit').hidden = false;
  document.body.classList.add('has-unit');
  openFilters(false);
  $('#unit').scrollTop = 0;
  if (fly) flyToUnit(u);
}
$('#unit-close').onclick = () => select(null);
$('#lightbox').onclick = () => { $('#lightbox').hidden = true; };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#lightbox').hidden) $('#lightbox').hidden = true; else select(null); } });

/* Filtros no celular */
function openFilters(open) {
  document.body.classList.toggle('filters-open', open);
  if (!open && document.activeElement && $('#filters').contains(document.activeElement)) document.activeElement.blur();
  window.scrollTo(0, 0);
}
$('#btn-filtros').onclick = () => openFilters(!document.body.classList.contains('filters-open'));
$('#filters-close').onclick = () => openFilters(false);

/* ---------- Câmera ---------- */
let tween = null;
function flyTo(pos, target, dur = 1.4) {
  tween = { t0: performance.now(), dur: dur * 1000, p0: camera.position.clone(), p1: pos.clone(), q0: controls.target.clone(), q1: target.clone() };
}
const VIEWS = {
  geral: [new THREE.Vector3(-105, 70, 118), new THREE.Vector3(8, 6, 0)],
  nascente: [new THREE.Vector3(14, 46, -150), new THREE.Vector3(6, 8, 0)],
  poente: [new THREE.Vector3(10, 46, 150), new THREE.Vector3(6, 8, 0)],
  topo: [new THREE.Vector3(8, 210, 6), new THREE.Vector3(8, 0, 0)],
};
function flyToUnit(u) {
  const t = u.pos.clone();
  const mob = canvas.clientWidth < 760;
  const side = u.colIndex < 4 ? -1 : 1;
  // fileira externa: câmera afastada fora do terreno; fileira do pátio: câmera elevada sobre o pátio central
  const off = u.row === 'outer'
    ? new THREE.Vector3(side * 16, 22, u.normal * (mob ? 95 : 78))
    : new THREE.Vector3(side * 34, 18, u.normal * (mob ? 28 : 25));
  const p = t.clone().add(off);
  flyTo(p, t, 1.2);
}
$('#views').onclick = (e) => {
  const b = e.target.closest('[data-view]'); if (!b) return;
  const [p, t] = VIEWS[b.dataset.view]; flyTo(p, t);
};

/* ---------- Interação 3D ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tip = $('#tip');
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(unitMeshes.filter((m) => m.visible && m.material !== MAT.vendidoGhost), false);
  return hits.length ? byKey.get(hits[0].object.userData.key) : null;
}
canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'mouse') return;
  const u = pick(ev);
  if (u !== state.hover) { state.hover = u; paint(); }
  canvas.style.cursor = u ? 'pointer' : 'grab';
  if (u) {
    tip.hidden = false;
    tip.style.transform = `translate(${ev.clientX + 16}px, ${ev.clientY + 14}px)`;
    tip.innerHTML = `<b>${u.u}</b> · Bloco ${u.b}<br>${TIPOS[u.tipo].nome} · ${m2(u.a)}<br>` +
      (u.st === 'd' ? `<em>${mil(u.p)}</em>` : `<span class="muted">Vendida</span>`);
  } else tip.hidden = true;
});
canvas.addEventListener('pointerleave', () => { tip.hidden = true; if (state.hover) { state.hover = null; paint(); } });
let down = null;
canvas.addEventListener('pointerdown', (ev) => { down = [ev.clientX, ev.clientY]; tween = null; intro = null; });
canvas.addEventListener('pointerup', (ev) => {
  if (!down) return;
  const moved = Math.hypot(ev.clientX - down[0], ev.clientY - down[1]);
  down = null;
  if (moved > 6) return;
  const u = pick(ev);
  if (u) select(u, false);
});

/* Rótulos no espaço */
const LABELS = [
  ['Bloco 1', new THREE.Vector3(BLOCKS[1].x, 22.5, BLOCKS[1].z)],
  ['Bloco 2', new THREE.Vector3(BLOCKS[2].x, 22.5, BLOCKS[2].z)],
  ['Bloco 3', new THREE.Vector3(BLOCKS[3].x, 22.5, BLOCKS[3].z)],
  ['Bloco 4', new THREE.Vector3(BLOCKS[4].x, 22.5, BLOCKS[4].z)],
  ['Nascente', new THREE.Vector3(8, 1, -66), 'sun'],
  ['Poente', new THREE.Vector3(8, 1, 66), 'sun'],
  ['Rua Teixeira Heizer', new THREE.Vector3(-66, 1, 0), 'street'],
  ['Lazer', new THREE.Vector3(66, 0.5, 0), 'sun'],
];
const labelEls = LABELS.map(([t, , cls]) => {
  const el = document.createElement('div');
  el.className = 'tag3d' + (cls ? ' ' + cls : '');
  el.textContent = t;
  $('#labels').appendChild(el);
  return el;
});
const v = new THREE.Vector3();
function placeLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  LABELS.forEach(([, p], i) => {
    v.copy(p).project(camera);
    const el = labelEls[i];
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    el.style.opacity = vis ? 1 : 0;
    el.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`;
  });
}

/* ---------- Loop ---------- */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < 700 ? 50 : 38;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let intro = null;
const off = { x: 0, y: 0 };
function loop(now) {
  if (tween) {
    const k = Math.min(1, (now - tween.t0) / tween.dur), e = ease(k);
    camera.position.lerpVectors(tween.p0, tween.p1, e);
    controls.target.lerpVectors(tween.q0, tween.q1, e);
    if (k >= 1) tween = null;
  }
  // desloca o centro da cena para fora dos painéis
  const w = canvas.clientWidth, h = canvas.clientHeight;
  let ox = 0, oy = 0;
  if (w > 760) ox = -((w > 1100 ? 350 : 320) - (state.sel ? (w > 1100 ? 400 : 360) : 0)) / 2;
  else if (state.sel) oy = h * 0.3;
  else if (document.body.classList.contains('filters-open')) oy = h * 0.36;
  off.x += (ox - off.x) * 0.12; off.y += (oy - off.y) * 0.12;
  camera.setViewOffset(w, h, off.x, off.y, w, h);
  controls.update();
  renderer.render(scene, camera);
  placeLabels();
  requestAnimationFrame(loop);
}

/* ---------- Início ---------- */
async function init() {
  const data = await (await fetch('data/unidades.json')).json();
  meta = data.meta;
  units = data.unidades.map((u) => ({ ...u, f: +u.u[0], tipo: tipoDe(+u.u[0]), key: `${u.b}-${u.u}`, fin: u.f }));
  // no JSON, "f" é a parcela única: vai para "fin"; aqui "f" passa a ser o pavimento
  units.forEach((u) => byKey.set(u.key, u));
  for (const b of [1, 2, 3, 4]) buildBlock(b);

  const disp = units.filter((u) => u.st === 'd');
  $('#hero-stat').innerHTML = `<b>${disp.length}</b> disponíveis de ${units.length} · a partir de <b>${mil(Math.min(...disp.map((u) => u.p)))}</b>`;
  $('#tabela').textContent = 'Tabela ' + meta.tabela;
  $('#links').innerHTML = CONFIG.links.map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join('');

  buildFilters();
  update();
  resize();
  requestAnimationFrame(loop);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canvas.clientWidth < 760) VIEWS.geral[0].set(-150, 120, 175);
  const [p, t] = VIEWS.geral;
  if (reduce) { camera.position.copy(p); controls.target.copy(t); }
  else flyTo(p, t, 2.6);
  document.body.classList.add('ready');
  const hash = location.hash.slice(1);
  const m = hash.match(/^b([1-4])-(\d{3})$/);
  if (m && byKey.get(`${m[1]}-${m[2]}`)) setTimeout(() => select(byKey.get(`${m[1]}-${m[2]}`), true), 2700);
}
init().catch((e) => { $('#loader-msg').textContent = 'Não foi possível carregar a disponibilidade. Recarregue a página.'; console.error(e); });
