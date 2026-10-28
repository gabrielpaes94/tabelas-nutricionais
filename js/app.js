import { calcular, fmt, LINHAS, ALERGENOS, textoAlergenos, num, VD } from './calc.js';
import { buildLabelSVG, buildSeloSVG, layoutLabel, avaliarFonte, tamanhoMinimo, gerarPNG, gerarPDF, salvarOuCompartilhar } from './label.js';
import * as store from './store.js';

let S = store.carregar();
const $app = document.getElementById('app');

// ---------- utilidades ----------
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
}
const toNum = (s) => { const n = parseFloat(String(s).replace(',', '.')); return isNaN(n) ? 0 : n; };
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tabela';
const brl = (n) => (n === null || n === undefined || isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const ingMap = () => new Map(S.ings.map((i) => [i.id, i]));
const calc = (rec) => calcular(rec, ingMap(), { metodo: S.settings.metodo });
const sorter = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });

function salvar() {
  if (!store.salvar(S)) toast('Não foi possível salvar neste navegador. Exporte um backup.', true);
}
let toastT;
function toast(msg, erro) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast' + (erro ? ' erro' : '') }, msg);
  document.body.append(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), 3200);
}
function ir(hash) { if (location.hash === hash) render(); else location.hash = hash; }

function campoNum(rotulo, valor, onInput, o = {}) {
  const inp = h('input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: o.placeholder || '',
    value: valor === null || valor === undefined ? '' : String(valor).replace('.', ','),
    oninput: () => onInput(o.nulavel && inp.value.trim() === '' ? null : toNum(inp.value)),
  });
  return h('label', { class: 'campo' }, h('span', {}, rotulo), inp);
}
function campoTxt(rotulo, valor, onInput, o = {}) {
  const inp = h('input', { type: 'text', autocomplete: 'off', value: valor || '', placeholder: o.placeholder || '', oninput: () => onInput(inp.value) });
  return h('label', { class: 'campo' }, h('span', {}, rotulo), inp);
}

// ---------- roteador ----------
function rota() {
  const [path, query] = location.hash.replace(/^#/, '').split('?');
  const p = new URLSearchParams(query || '');
  const seg = path.split('/').filter(Boolean);
  return { seg, p };
}

function render() {
  const { seg, p } = rota();
  const aba = seg[0] === 'i' ? 'i' : seg[0] === 'a' ? 'a' : 'r';
  $app.replaceChildren();
  let view;
  if (seg[0] === 'r' && seg[1]) view = viewReceita(seg[1]);
  else if (seg[0] === 'i' && seg[1]) view = viewInsumo(seg[1], p);
  else if (seg[0] === 'i') view = viewInsumos();
  else if (seg[0] === 'a') view = viewAjustes();
  else view = viewReceitas();
  $app.append(view);
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('ativo', a.dataset.aba === aba));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

function topo(titulo, voltar, acao) {
  return h('header', { class: 'topo' },
    voltar ? h('button', { class: 'btn-voltar', onclick: () => ir(voltar), 'aria-label': 'Voltar' }, '‹') : h('span', { class: 'sp' }),
    h('h1', {}, titulo),
    acao || h('span', { class: 'sp' }));
}

// ---------- receitas ----------
function viewReceitas() {
  const lista = h('div', { class: 'lista' });
  if (!S.recipes.length) lista.append(h('p', { class: 'vazio' }, 'Nenhuma receita ainda. Toque em "Nova receita".'));
  [...S.recipes].sort(sorter).forEach((rec) => {
    const r = calc(rec);
    lista.append(h('div', { class: 'card' },
      h('a', { class: 'card-corpo', href: `#/r/${rec.id}` },
        h('strong', {}, rec.nome || 'Sem nome'),
        h('small', {}, `${rec.linhas.length} ingredientes · porção ${fmt(num(rec.porcaoG))} g · ${fmt(r.declPorcao.energia)} kcal`)),
      h('div', { class: 'card-acoes' },
        h('button', { class: 'mini', onclick: () => duplicarReceita(rec) }, 'Duplicar'),
        h('button', { class: 'mini perigo', onclick: () => excluirReceita(rec) }, 'Excluir'))));
  });
  const nova = h('button', { class: 'btn primario', onclick: () => { const r = store.novaReceita(); S.recipes.push(r); salvar(); ir(`#/r/${r.id}`); } }, 'Nova receita');
  return h('div', { class: 'tela' }, topo('Receitas', null, nova), dicaInstalar(), lista);
}
function duplicarReceita(rec) {
  const c = JSON.parse(JSON.stringify(rec));
  c.id = store.uid('r'); c.nome = `${rec.nome} (cópia)`;
  S.recipes.push(c); salvar(); ir(`#/r/${c.id}`);
}
function excluirReceita(rec) {
  if (!confirm(`Excluir "${rec.nome}"? Esta ação não pode ser desfeita.`)) return;
  S.recipes = S.recipes.filter((r) => r.id !== rec.id); salvar(); render();
}
function dicaInstalar() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  let fechado = false;
  try { fechado = localStorage.getItem('tn-dica') === '1'; } catch (e) { /* ignora */ }
  if (!ios || standalone || fechado) return null;
  return h('div', { class: 'dica' },
    h('p', {}, 'Para instalar: toque em Compartilhar e depois em "Adicionar à Tela de Início". Depois disso o app abre pelo ícone e funciona sem internet.'),
    h('button', { class: 'mini', onclick: (e) => { try { localStorage.setItem('tn-dica', '1'); } catch (x) { /* ignora */ } e.target.closest('.dica').remove(); } }, 'Entendi'));
}

// ---------- editor de receita ----------
let segAtual = 'receita';

function viewReceita(id) {
  const rec = S.recipes.find((r) => r.id === id);
  if (!rec) { ir('#/'); return h('div'); }
  rec.larguraMm = rec.larguraMm || 60; rec.alturaMm = rec.alturaMm || 70;

  const boxResumo = h('div', { class: 'bloco' });
  const boxAvisos = h('div');
  const boxLinhas = h('div', { class: 'linhas' });
  const boxTabela = h('div');
  const boxCusto = h('div');
  const pnlReceita = h('div', { class: 'painel' });
  const pnlTabela = h('div', { class: 'painel' }, boxTabela);
  const pnlCusto = h('div', { class: 'painel' }, boxCusto);
  const paineis = { receita: pnlReceita, tabela: pnlTabela, custo: pnlCusto };
  const infoPeso = h('p', { class: 'nota' });
  const infoSoma = h('p', { class: 'nota' });

  function persistir() { salvar(); refresh(); }

  function refresh() {
    const r = calc(rec);
    infoPeso.textContent = `Peso final total: ${fmt(Math.round(num(rec.unidades) * num(rec.pesoUn) * 10) / 10)} g`;
    infoSoma.textContent = `Soma dos ingredientes: ${fmt(Math.round(r.somaG * 10) / 10)} g` +
      (r.somaG > 0 && num(rec.unidades) * num(rec.pesoUn) > 0 ? ` · variação até o peso final: ${fmt(Math.round(r.perdaPct * 10) / 10)}%` : '');
    boxResumo.replaceChildren(
      h('h3', {}, 'Resumo por porção'),
      h('div', { class: 'resumo' }, LINHAS.map((l) => h('div', {}, h('small', {}, l.nome.replace(/ \(.+\)/, '')), h('b', {}, fmt(r.declPorcao[l.key]))))));
    boxAvisos.replaceChildren(...r.avisos.map((a) => h('div', { class: 'aviso' }, a)));
    boxLinhas.querySelectorAll('[data-g]').forEach((el) => {
      const i = Number(el.dataset.g); const x = r.linhas[i];
      el.textContent = x && x.ing ? `${fmt(Math.round(x.g * 10) / 10)} g` : '';
    });
    if (segAtual === 'tabela') renderTabela(r);
    if (segAtual === 'custo') renderCusto(r);
  }

  function renderLinhas() {
    boxLinhas.replaceChildren();
    const m = ingMap();
    if (!rec.linhas.length) boxLinhas.append(h('p', { class: 'vazio' }, 'Adicione os ingredientes da receita.'));
    rec.linhas.forEach((l, i) => {
      const ing = m.get(l.ing);
      const sel = h('select', { onchange: () => { l.un = sel.value; persistir(); } },
        h('option', { value: 'g' }, 'g'),
        ...(ing ? ing.unidades || [] : []).map((u) => h('option', { value: u.nome, selected: l.un === u.nome }, u.nome)));
      const q = h('input', { type: 'text', inputmode: 'decimal', value: String(l.qtd).replace('.', ','), oninput: () => { l.qtd = toNum(q.value); persistir(); } });
      boxLinhas.append(h('div', { class: 'linha' },
        h('div', { class: 'linha-nome' }, h('span', {}, ing ? ing.nome : '(insumo removido)'), h('small', { 'data-g': i }, '')),
        q, sel,
        h('button', { class: 'mini perigo', 'aria-label': 'Remover', onclick: () => { rec.linhas.splice(i, 1); renderLinhas(); persistir(); } }, '×')));
    });
    refresh();
  }

  pnlReceita.append(
    h('div', { class: 'bloco' },
      campoTxt('Nome do produto', rec.nome, (v) => { rec.nome = v; salvar(); }),
      h('div', { class: 'grade2' },
        campoNum('Nº de unidades', rec.unidades, (v) => { rec.unidades = v; persistir(); }),
        campoNum('Peso por unidade (g)', rec.pesoUn, (v) => { rec.pesoUn = v; persistir(); })),
      infoPeso,
      h('div', { class: 'grade2' },
        campoNum('Porção (g ou mL)', rec.porcaoG, (v) => { rec.porcaoG = v; persistir(); }),
        campoTxt('Medida caseira', rec.medida, (v) => { rec.medida = v; salvar(); refresh(); }, { placeholder: 'ex.: 2 fatias' })),
      h('label', { class: 'campo' }, h('span', {}, 'Tipo do alimento'),
        h('select', { onchange: (e) => { rec.liquido = e.target.value === 'l'; persistir(); } },
          h('option', { value: 's', selected: !rec.liquido }, 'Sólido (por 100 g)'),
          h('option', { value: 'l', selected: rec.liquido }, 'Líquido (por 100 mL)')))),
    h('div', { class: 'bloco' },
      h('div', { class: 'bloco-topo' }, h('h3', {}, 'Ingredientes'),
        h('button', { class: 'btn primario', onclick: () => abrirPicker((idIng) => { rec.linhas.push({ ing: idIng, qtd: 0, un: 'g' }); renderLinhas(); persistir(); }, `r/${rec.id}`) }, 'Adicionar')),
      boxLinhas, infoSoma),
    boxAvisos, boxResumo);

  // ----- tabela -----
  function renderTabela(r) {
    const W = num(rec.larguraMm), H = num(rec.alturaMm);
    const el = [];
    const sizes = h('div', { class: 'bloco' },
      h('h3', {}, 'Tamanho da tabela (mm)'),
      h('div', { class: 'grade2' },
        campoNum('Largura', rec.larguraMm, (v) => { rec.larguraMm = v; salvar(); pintar(); }),
        campoNum('Altura', rec.alturaMm, (v) => { rec.alturaMm = v; salvar(); pintar(); })),
      h('div', { class: 'chips' },
        predefinido('5 × 5 cm', 50, 50), predefinido('6 × 7 cm', 60, 70), predefinido('7 × 8 cm', 70, 80),
        predefinido('Mínimo 6 pt', ...Object.values(tamanhoMinimo(6))), predefinido('Mínimo 8 pt', ...Object.values(tamanhoMinimo(8)))));
    function predefinido(txt, w, hh) {
      return h('button', { class: 'chip', onclick: () => { rec.larguraMm = w; rec.alturaMm = hh; salvar(); renderTabela(calc(rec)); } }, txt);
    }
    const prevBox = h('div', { class: 'preview' });
    const avisoFonte = h('div');
    function pintar() {
      const w = num(rec.larguraMm), hh = num(rec.alturaMm);
      if (w < 20 || hh < 20) { prevBox.replaceChildren(h('p', { class: 'vazio' }, 'Informe largura e altura de pelo menos 20 mm.')); avisoFonte.replaceChildren(); return; }
      const rr = calc(rec);
      const svg = buildLabelSVG(rec, rr, { W: w, H: hh });
      prevBox.innerHTML = svg;
      const sv = prevBox.querySelector('svg'); sv.removeAttribute('width'); sv.removeAttribute('height'); sv.style.maxWidth = `${Math.min(w * 5, 520)}px`;
      const av = avaliarFonte(layoutLabel(w, hh).pt);
      avisoFonte.replaceChildren(h('div', { class: `aviso ${av.nivel}` }, av.msg));
    }
    const nome = slug(rec.nome);
    const exportar = (fmtOut) => async () => {
      const w = num(rec.larguraMm), hh = num(rec.alturaMm);
      try {
        const svg = buildLabelSVG(rec, calc(rec), { W: w, H: hh });
        const blob = fmtOut === 'pdf' ? await gerarPDF(svg, w, hh) : await gerarPNG(svg, w, hh);
        await salvarOuCompartilhar(blob, `tabela-${nome}.${fmtOut}`);
      } catch (e) { toast(e.message || 'Falha ao exportar.', true); }
    };
    el.push(sizes, h('div', { class: 'bloco' }, prevBox, avisoFonte,
      h('div', { class: 'grade2' }, h('button', { class: 'btn primario', onclick: exportar('pdf') }, 'Salvar PDF'), h('button', { class: 'btn', onclick: exportar('png') }, 'Salvar PNG'))));

    // selo frontal
    const sel = h('div', { class: 'bloco' }, h('h3', {}, 'Selo frontal'));
    if (r.selo.length) {
      const s = buildSeloSVG(r.selo, 36);
      const box = h('div', { class: 'selo', html: s.svg });
      const sv = box.querySelector('svg'); sv.removeAttribute('width'); sv.removeAttribute('height'); sv.style.width = '160px';
      sel.append(box, h('button', { class: 'btn', onclick: async () => { try { await salvarOuCompartilhar(await gerarPNG(s.svg, s.W, s.H), `selo-${nome}.png`); } catch (e) { toast('Falha ao exportar.', true); } } }, 'Salvar selo PNG'),
        h('p', { class: 'nota' }, `Calculado por ${rec.liquido ? '100 mL' : '100 g'}: açúcar adicionado ${fmt(Math.round(r.per100.acucAdd * 10) / 10)} g, gordura saturada ${fmt(Math.round(r.per100.sat * 10) / 10)} g, sódio ${fmt(Math.round(r.per100.sodio))} mg.`));
    } else {
      sel.append(h('p', { class: 'nota' }, 'Nenhum selo necessário: o produto não é "alto em" açúcar adicionado, gordura saturada ou sódio.'));
    }
    el.push(sel);

    // alérgenos e ingredientes
    const ingTxt = r.ingredientes.length ? `Ingredientes: ${r.ingredientes.join(', ')}.` : 'Ingredientes: —';
    const alTxt = textoAlergenos(r);
    el.push(h('div', { class: 'bloco' }, h('h3', {}, 'Ingredientes e alérgenos'),
      h('p', { class: 'texto' }, ingTxt), h('p', { class: 'texto forte' }, alTxt),
      h('button', { class: 'btn', onclick: () => copiar(`${ingTxt}\n${alTxt}`) }, 'Copiar texto'),
      h('p', { class: 'nota' }, 'Confira os alérgenos de cada insumo na aba Insumos: marcas e fornecedores mudam a composição.')));
    boxTabela.replaceChildren(...el);
    pintar();
  }

  // ----- custo -----
  function renderCusto(r) {
    const m = ingMap();
    const tab = h('table', { class: 'tab' }, h('thead', {}, h('tr', {}, h('th', {}, 'Insumo'), h('th', {}, 'Qtd (g)'), h('th', {}, 'Custo'))),
      h('tbody', {}, r.linhas.map((x) => h('tr', {}, h('td', {}, x.ing ? x.ing.nome : '—'), h('td', {}, fmt(Math.round(x.g * 10) / 10)), h('td', {}, x.custo === null ? 'sem preço' : brl(x.custo))))));
    const lucro = r.preco !== null && r.custoUn !== null ? r.preco - r.custoUn : null;
    boxCusto.replaceChildren(
      h('div', { class: 'bloco' }, h('h3', {}, 'Custo da receita'), tab),
      r.semPreco.length ? h('div', { class: 'aviso' }, `Sem preço cadastrado (custo parcial): ${[...new Set(r.semPreco)].join(', ')}. Cadastre em Insumos.`) : null,
      h('div', { class: 'bloco' },
        h('div', { class: 'kv' }, h('span', {}, 'Custo total'), h('b', {}, brl(r.custo))),
        h('div', { class: 'kv' }, h('span', {}, 'Custo por unidade'), h('b', {}, brl(r.custoUn))),
        campoNum('Margem sobre o custo (%)', rec.markup, (v) => { rec.markup = v; salvar(); renderCusto(calc(rec)); }),
        h('div', { class: 'kv' }, h('span', {}, 'Preço de venda sugerido'), h('b', { class: 'destaque' }, brl(r.preco))),
        h('div', { class: 'kv' }, h('span', {}, 'Lucro por unidade'), h('b', {}, brl(lucro)))),
      h('p', { class: 'nota' }, 'Considera só o custo dos ingredientes. Embalagem, gás, mão de obra e impostos não entram.'));
    void m;
  }

  const seg = h('div', { class: 'segmentos' },
    ...[['receita', 'Receita'], ['tabela', 'Tabela'], ['custo', 'Custo']].map(([k, t]) =>
      h('button', { class: k === segAtual ? 'ativo' : '', 'data-k': k, onclick: (e) => {
        segAtual = k;
        seg.querySelectorAll('button').forEach((b) => b.classList.toggle('ativo', b.dataset.k === k));
        Object.entries(paineis).forEach(([kk, p]) => p.classList.toggle('oculto', kk !== k));
        refresh();
        void e;
      } }, t)));
  Object.entries(paineis).forEach(([kk, p]) => p.classList.toggle('oculto', kk !== segAtual));

  renderLinhas();
  return h('div', { class: 'tela' }, topo(rec.nome || 'Receita', '#/'), seg, pnlReceita, pnlTabela, pnlCusto);
}

async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); toast('Texto copiado.'); }
  catch (e) {
    const t = h('textarea', {}, txt); document.body.append(t); t.select();
    try { document.execCommand('copy'); toast('Texto copiado.'); } catch (x) { toast('Não foi possível copiar.', true); }
    t.remove();
  }
}

// ---------- seletor de insumos (modal) ----------
let tacoCache = null;
async function carregarTaco() {
  if (!tacoCache) tacoCache = (await import('../data/taco.js')).TACO;
  return tacoCache;
}

function abrirPicker(aoEscolher, voltarPara) {
  const busca = h('input', { type: 'search', placeholder: 'Buscar insumo ou alimento da TACO', autocomplete: 'off' });
  const res = h('div', { class: 'picker-lista' });
  const fechar = () => ov.remove();
  const sheet = h('div', { class: 'sheet' },
    h('div', { class: 'sheet-topo' }, h('h3', {}, 'Adicionar insumo'), h('button', { class: 'mini', onclick: fechar }, 'Fechar')),
    busca, res,
    h('button', { class: 'btn', onclick: () => { fechar(); ir(`#/i/novo?volta=${encodeURIComponent(voltarPara)}`); } }, 'Cadastrar novo insumo'));
  const ov = h('div', { class: 'overlay', onclick: (e) => { if (e.target === ov) fechar(); } }, sheet);
  document.body.append(ov);

  async function filtrar() {
    const q = norm(busca.value.trim());
    res.replaceChildren();
    const meus = S.ings.filter((i) => !q || norm(i.nome).includes(q)).sort(sorter).slice(0, 40);
    if (meus.length) res.append(h('h4', {}, 'Meus insumos'));
    meus.forEach((i) => res.append(h('button', { class: 'item', onclick: () => { fechar(); aoEscolher(i.id); } }, h('span', {}, i.nome), h('small', {}, `${fmt(i.carbo)} g carbo · ${fmt(i.prot)} g prot · ${fmt(i.gord)} g gord`))));
    if (q.length >= 2) {
      let taco = [];
      try { taco = await carregarTaco(); } catch (e) { res.append(h('p', { class: 'nota' }, 'Base TACO indisponível.')); }
      if (norm(busca.value.trim()) !== q) return; // busca mudou durante o carregamento
      const ja = new Set(S.ings.map((i) => i.id));
      const ach = taco.filter((t) => !ja.has(t.id) && q.split(' ').every((w) => norm(t.nome).includes(w))).slice(0, 40);
      if (ach.length) res.append(h('h4', {}, 'Tabela TACO'));
      ach.forEach((t) => res.append(h('button', { class: 'item', onclick: () => {
        const novo = store.novoInsumo({ ...t, alergenos: [], unidades: [] });
        S.ings.push(novo); salvar(); fechar(); toast(`"${t.nome}" adicionado aos seus insumos.`); aoEscolher(novo.id);
      } }, h('span', {}, t.nome), h('small', {}, `${t.grupo} · ${fmt(t.carbo)} g carbo · ${fmt(t.prot)} g prot · ${fmt(t.gord)} g gord`))));
    }
    if (!res.children.length) res.append(h('p', { class: 'vazio' }, 'Nada encontrado.'));
  }
  busca.addEventListener('input', filtrar);
  filtrar();
  setTimeout(() => busca.focus(), 50);
}

// ---------- insumos ----------
function viewInsumos() {
  const busca = h('input', { type: 'search', placeholder: 'Buscar nos meus insumos', autocomplete: 'off' });
  const lista = h('div', { class: 'lista' });
  const usados = new Set(S.recipes.flatMap((r) => r.linhas.map((l) => l.ing)));
  function pintar() {
    const q = norm(busca.value.trim());
    lista.replaceChildren();
    const itens = S.ings.filter((i) => !q || norm(i.nome).includes(q)).sort(sorter);
    if (!itens.length) lista.append(h('p', { class: 'vazio' }, 'Nenhum insumo encontrado.'));
    itens.forEach((i) => {
      const incompleto = i.acucTot === null || i.acucTot === undefined;
      lista.append(h('a', { class: 'card card-corpo', href: `#/i/${i.id}` },
        h('strong', {}, i.nome),
        h('small', {}, `por 100 g: ${fmt(i.carbo)} carbo · ${fmt(i.prot)} prot · ${fmt(i.gord)} gord · ${fmt(i.sodio)} mg Na${incompleto ? ' · sem açúcares' : ''}${usados.has(i.id) ? ' · em uso' : ''}`)));
    });
  }
  busca.addEventListener('input', pintar);
  pintar();
  return h('div', { class: 'tela' },
    topo('Insumos', null, h('button', { class: 'btn primario', onclick: () => abrirPicker((id) => ir(`#/i/${id}`), 'i') }, 'Adicionar')),
    busca, lista);
}

const draftCache = {};
function viewInsumo(id, p) {
  const existente = S.ings.find((i) => i.id === id);
  if (id !== 'novo' && !existente) { ir('#/i'); return h('div'); }
  const key = id + (p.get('volta') || '');
  const ing = draftCache[key] || (draftCache[key] = existente ? JSON.parse(JSON.stringify(existente)) : store.novoInsumo());
  const volta = p.get('volta') ? `#/${decodeURIComponent(p.get('volta'))}` : '#/i';
  const refs = {};

  const nut = (k, rot, nulavel) => {
    const c = campoNum(rot, ing[k], (v) => { ing[k] = v; }, { nulavel, placeholder: nulavel ? 'desconhecido' : '0' });
    refs[k] = c.querySelector('input');
    return c;
  };

  const conv = h('div', { class: 'bloco' },
    h('h3', {}, 'Converter para 100 g'),
    h('p', { class: 'nota' }, 'Se o rótulo informa os valores por outra quantidade (ex.: por porção de 30 g), digite os valores nos campos abaixo, informe a quantidade e toque em Converter.'));
  const qref = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'ex.: 30' });
  conv.append(h('label', { class: 'campo' }, h('span', {}, 'Quantidade de referência (g)'), qref),
    h('button', { class: 'btn', onclick: () => {
      const q = toNum(qref.value);
      if (q <= 0) { toast('Informe a quantidade de referência.', true); return; }
      ['carbo', 'acucTot', 'acucAdd', 'prot', 'gord', 'sat', 'trans', 'fibra', 'sodio'].forEach((k) => {
        if (ing[k] !== null && ing[k] !== undefined) { ing[k] = Math.round((ing[k] * 100 / q) * 100) / 100; refs[k].value = String(ing[k]).replace('.', ','); }
      });
      qref.value = ''; toast('Valores convertidos para 100 g.');
    } }, 'Converter'));

  const chips = h('div', { class: 'chips' }, ALERGENOS.map((a) => {
    const b = h('button', { class: 'chip' + (ing.alergenos.includes(a) ? ' ativo' : ''), onclick: () => {
      ing.alergenos = ing.alergenos.includes(a) ? ing.alergenos.filter((x) => x !== a) : [...ing.alergenos, a];
      b.classList.toggle('ativo', ing.alergenos.includes(a));
    } }, a);
    return b;
  }));

  const boxUn = h('div');
  function pintarUn() {
    boxUn.replaceChildren(...ing.unidades.map((u, i) => h('div', { class: 'grade-un' },
      h('input', { type: 'text', value: u.nome, placeholder: 'ex.: xícara', oninput: (e) => { u.nome = e.target.value; } }),
      h('input', { type: 'text', inputmode: 'decimal', value: String(u.g).replace('.', ','), placeholder: 'g por 1', oninput: (e) => { u.g = toNum(e.target.value); } }),
      h('button', { class: 'mini perigo', onclick: () => { ing.unidades.splice(i, 1); pintarUn(); } }, '×'))));
  }
  pintarUn();

  const precoKg = h('p', { class: 'nota' });
  const atualizaKg = () => { precoKg.textContent = num(ing.preco) && num(ing.precoQtd) ? `Equivale a ${brl((num(ing.preco) / num(ing.precoQtd)) * 1000)} por kg.` : ''; };
  atualizaKg();

  const em_uso = S.recipes.filter((r) => r.linhas.some((l) => l.ing === id));

  function gravar() {
    ing.nome = ing.nome.trim();
    if (!ing.nome) { toast('Informe o nome do insumo.', true); return; }
    if (S.ings.some((x) => x.id !== ing.id && norm(x.nome) === norm(ing.nome))) { toast('Já existe um insumo com esse nome.', true); return; }
    ing.unidades = ing.unidades.filter((u) => u.nome.trim() && num(u.g) > 0).map((u) => ({ nome: u.nome.trim(), g: num(u.g) }));
    const i = S.ings.findIndex((x) => x.id === ing.id);
    if (i >= 0) S.ings[i] = ing; else S.ings.push(ing);
    delete draftCache[key];
    salvar(); toast('Insumo salvo.');
    if (p.get('volta') && p.get('volta').startsWith('r/') && id === 'novo') {
      const r = S.recipes.find((x) => x.id === p.get('volta').slice(2));
      if (r) { r.linhas.push({ ing: ing.id, qtd: 0, un: 'g' }); salvar(); }
    }
    ir(volta);
  }

  return h('div', { class: 'tela' },
    topo(existente ? 'Editar insumo' : 'Novo insumo', volta),
    h('div', { class: 'bloco' },
      campoTxt('Nome', ing.nome, (v) => { ing.nome = v; }),
      campoTxt('Fonte dos dados', ing.fonte, (v) => { ing.fonte = v; }, { placeholder: 'ex.: rótulo da marca X, TACO' }),
      h('h3', {}, 'Valores por 100 g'),
      h('div', { class: 'grade2' },
        nut('carbo', 'Carboidratos (g)'), nut('acucTot', 'Açúcares totais (g)', true),
        nut('acucAdd', 'Açúcares adicionados (g)', true), nut('prot', 'Proteínas (g)'),
        nut('gord', 'Gorduras totais (g)'), nut('sat', 'Gorduras saturadas (g)'),
        nut('trans', 'Gorduras trans (g)'), nut('fibra', 'Fibras (g)'), nut('sodio', 'Sódio (mg)')),
      h('p', { class: 'nota' }, 'Deixe os açúcares em branco quando não souber o valor: o app avisa nas receitas e considera 0.')),
    conv,
    h('div', { class: 'bloco' }, h('h3', {}, 'Alérgenos'), chips),
    h('div', { class: 'bloco' }, h('h3', {}, 'Outras unidades'),
      h('p', { class: 'nota' }, 'Cadastre quanto pesa 1 unidade (ex.: xícara = 120 g, ovo = 50 g). Para líquidos use "mL" com a densidade (água = 1).'),
      boxUn, h('button', { class: 'btn', onclick: () => { ing.unidades.push({ nome: '', g: 0 }); pintarUn(); } }, 'Adicionar unidade')),
    h('div', { class: 'bloco' }, h('h3', {}, 'Preço'),
      h('div', { class: 'grade2' },
        campoNum('Preço pago (R$)', ing.preco, (v) => { ing.preco = v; atualizaKg(); }, { nulavel: true }),
        campoNum('Quantidade comprada (g)', ing.precoQtd, (v) => { ing.precoQtd = v; atualizaKg(); }, { nulavel: true })),
      precoKg),
    h('div', { class: 'barra-fixa' },
      existente ? h('button', { class: 'btn perigo', onclick: () => {
        if (em_uso.length) { toast(`Em uso em: ${em_uso.map((r) => r.nome).join(', ')}. Remova da receita antes.`, true); return; }
        if (!confirm(`Excluir "${existente.nome}"?`)) return;
        S.ings = S.ings.filter((x) => x.id !== id); delete draftCache[key]; salvar(); ir('#/i');
      } }, 'Excluir') : null,
      h('button', { class: 'btn primario', onclick: gravar }, 'Salvar')));
}

// ---------- ajustes ----------
function viewAjustes() {
  const quando = S.settings.ultimoBackup ? new Date(S.settings.ultimoBackup).toLocaleString('pt-BR') : 'nunca';
  const arquivo = h('input', { type: 'file', accept: 'application/json,.json', class: 'oculto', onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const novo = store.lerBackup(await f.text());
      if (!confirm(`Substituir TODOS os dados atuais pelo backup (${novo.recipes.length} receitas, ${novo.ings.length} insumos)?`)) return;
      S = novo; salvar(); toast('Backup restaurado.'); render();
    } catch (err) { toast(err.message || 'Arquivo inválido.', true); }
  } });
  return h('div', { class: 'tela' }, topo('Ajustes'),
    h('div', { class: 'bloco' }, h('h3', {}, 'Backup'),
      h('p', { class: 'nota' }, `Seus dados ficam só neste iPhone. Último backup: ${quando}. Exporte de vez em quando e guarde no iCloud Drive ou envie para você mesmo.`),
      h('button', { class: 'btn primario', onclick: async () => {
        const r = await salvarOuCompartilhar(store.backupBlob(S), `backup-tabelas-${new Date().toISOString().slice(0, 10)}.json`);
        if (r !== 'cancelado') { S.settings.ultimoBackup = new Date().toISOString(); salvar(); render(); }
      } }, 'Exportar backup'),
      h('button', { class: 'btn', onclick: () => arquivo.click() }, 'Importar backup'), arquivo),
    h('div', { class: 'bloco' }, h('h3', {}, 'Cálculo de energia'),
      h('label', { class: 'campo' }, h('span', {}, 'Método'),
        h('select', { onchange: (e) => { S.settings.metodo = e.target.value; salvar(); } },
          h('option', { value: 'planilha', selected: S.settings.metodo === 'planilha' }, '(carbo + proteína) × 4 + gordura × 9  (como na planilha)'),
          h('option', { value: 'fibra', selected: S.settings.metodo === 'fibra' }, 'Carbo disponível × 4 + fibra × 2 + proteína × 4 + gordura × 9'))),
      h('p', { class: 'nota' }, 'O primeiro método reproduz a planilha original. O segundo desconta a fibra do carboidrato e aplica o fator 2 kcal/g da IN 75.')),
    h('div', { class: 'bloco' }, h('h3', {}, 'Valores diários de referência (IN 75/2020)'),
      h('table', { class: 'tab' }, h('tbody', {}, [['Energia', `${VD.energia} kcal`], ['Carboidratos', `${VD.carbo} g`], ['Açúcares adicionados', `${VD.acucAdd} g`], ['Proteínas', `${VD.prot} g`], ['Gorduras totais', `${VD.gord} g`], ['Gorduras saturadas', `${VD.sat} g`], ['Fibras', `${VD.fibra} g`], ['Sódio', `${VD.sodio} mg`]].map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b))))),
      h('p', { class: 'nota' }, 'Atenção: a planilha antiga usava valores anteriores (proteína 75 g, gordura total 55 g, saturada 22 g, sódio 2400 mg).')),
    h('div', { class: 'bloco' }, h('h3', {}, 'Dados de exemplo'),
      h('button', { class: 'btn perigo', onclick: () => {
        if (!confirm('Apagar TODOS os dados e voltar aos insumos e à receita de exemplo?')) return;
        S = store.estadoInicial(); salvar(); render(); toast('Dados restaurados.');
      } }, 'Restaurar dados iniciais')),
    h('p', { class: 'rodape' }, 'Tabelas Nutricionais · Padaria Dona Janine · v1'));
}

// ---------- inicialização ----------
render();
store.pedirPersistencia();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
