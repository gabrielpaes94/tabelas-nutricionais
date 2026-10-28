// Núcleo de cálculo: sem dependência de DOM, testável em Node.
// Regras: RDC 429/2020 e IN 75/2020 (Anvisa).

export const VD = {
  energia: 2000, carbo: 300, acucAdd: 50, prot: 50,
  gord: 65, sat: 20, fibra: 25, sodio: 2000,
};

// Linhas da tabela, na ordem da norma. vd=false => sem %VD na tabela.
export const LINHAS = [
  { key: 'energia', nome: 'Valor energético (kcal)', un: 'kcal', vd: true },
  { key: 'carbo', nome: 'Carboidratos (g)', un: 'g', vd: true },
  { key: 'acucTot', nome: 'Açúcares totais (g)', un: 'g', vd: false },
  { key: 'acucAdd', nome: 'Açúcares adicionados (g)', un: 'g', vd: true },
  { key: 'prot', nome: 'Proteínas (g)', un: 'g', vd: true },
  { key: 'gord', nome: 'Gorduras totais (g)', un: 'g', vd: true },
  { key: 'sat', nome: 'Gorduras saturadas (g)', un: 'g', vd: true },
  { key: 'trans', nome: 'Gorduras trans (g)', un: 'g', vd: false },
  { key: 'fibra', nome: 'Fibras alimentares (g)', un: 'g', vd: true },
  { key: 'sodio', nome: 'Sódio (mg)', un: 'mg', vd: true },
];

// Anexo IV: quantidade não significativa (declara 0)
const NAO_SIG = { energia: 4, carbo: 0.5, acucTot: 0.5, prot: 0.5, gord: 0.5, sat: 0.1, trans: 0.1, fibra: 0.5, sodio: 5 };

const NUTR = ['carbo', 'acucTot', 'acucAdd', 'prot', 'gord', 'sat', 'trans', 'fibra', 'sodio'];

export const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? 0 : Number(v));

// Arredondamento por casas decimais sem erro de ponto flutuante (0.35 -> 0.4)
function r(v, casas) {
  const f = 10 ** casas;
  return Math.round((v + Number.EPSILON) * f) / f;
}

// Anexo III: >=10 inteiro; 1..<10 uma casa (inteiro se casa for 0); <1 g uma casa; <1 mg duas casas
export function arredondar(key, v) {
  if (!isFinite(v) || v < 0) return 0;
  if (key in NAO_SIG && v <= NAO_SIG[key]) return 0;
  if (key === 'energia') return r(v, 0); // kcal sempre inteiro (prática de rótulo; confirmar com RT)
  const mg = key === 'sodio';
  if (v >= 10) return r(v, 0);
  if (v >= 1) return r(v, 1);
  return mg ? r(v, 2) : r(v, 1);
}

export function fmt(n) {
  return String(n).replace('.', ',');
}

export function pctVD(key, valorDeclarado) {
  const vd = VD[key];
  if (!vd) return null;
  return Math.round((valorDeclarado / vd) * 100);
}

export function gramasDaLinha(linha, ing) {
  if (!ing) return 0;
  const q = num(linha.qtd);
  if (!linha.un || linha.un === 'g') return q;
  const u = (ing.unidades || []).find((x) => x.nome === linha.un);
  return u ? q * num(u.g) : 0;
}

export function energiaDe(t, metodo = 'planilha') {
  // planilha: (carbo + prot) x 4 + gord x 9  (mantém a fórmula original)
  // fibra: carboidrato disponível x4 + fibra x2 (fator da IN 75 para fibras solúveis)
  if (metodo === 'fibra') return (t.carbo - t.fibra) * 4 + t.fibra * 2 + t.prot * 4 + t.gord * 9;
  return (t.carbo + t.prot) * 4 + t.gord * 9;
}

export function pesoFinalDe(rec, somaG) {
  const pf = num(rec.unidades) * num(rec.pesoUn);
  return pf > 0 ? pf : somaG;
}

export function custoLinha(linha, ing) {
  if (!ing || !num(ing.preco) || !num(ing.precoQtd)) return null;
  return (gramasDaLinha(linha, ing) / num(ing.precoQtd)) * num(ing.preco);
}

// Calcula tudo de uma receita. ingMap: Map/objeto id -> insumo
export function calcular(rec, ingMap, opts = {}) {
  const get = (id) => (ingMap instanceof Map ? ingMap.get(id) : ingMap[id]);
  const metodo = opts.metodo || 'planilha';
  const tot = Object.fromEntries(NUTR.map((k) => [k, 0]));
  const avisos = [];
  const semAcucar = [];
  const semPreco = [];
  let somaG = 0;
  let custo = 0;
  const linhas = [];

  for (const l of rec.linhas || []) {
    const ing = get(l.ing);
    if (!ing) { avisos.push('Insumo removido ou não encontrado em uma linha.'); linhas.push({ l, ing: null, g: 0, custo: null }); continue; }
    const g = gramasDaLinha(l, ing);
    if (l.un && l.un !== 'g' && !(ing.unidades || []).some((x) => x.nome === l.un)) {
      avisos.push(`"${ing.nome}": unidade "${l.un}" não cadastrada.`);
    }
    somaG += g;
    for (const k of NUTR) {
      if ((k === 'acucTot' || k === 'acucAdd') && (ing[k] === null || ing[k] === undefined)) {
        if (g > 0 && !semAcucar.includes(ing.nome)) semAcucar.push(ing.nome);
        continue;
      }
      tot[k] += (g * num(ing[k])) / 100;
    }
    const c = custoLinha(l, ing);
    if (c === null && g > 0) semPreco.push(ing.nome); else if (c !== null) custo += c;
    linhas.push({ l, ing, g, custo: c });
  }

  if (semAcucar.length) avisos.push(`Sem dados de açúcares (considerado 0): ${semAcucar.join(', ')}.`);
  if (tot.acucAdd > tot.acucTot + 1e-9) avisos.push('Açúcares adicionados maiores que açúcares totais: revise os insumos.');
  if (tot.acucTot > tot.carbo + 1e-9) avisos.push('Açúcares totais maiores que carboidratos: revise os insumos.');
  tot.energia = energiaDe(tot, metodo);

  const pesoFinal = pesoFinalDe(rec, somaG);
  const porcaoG = num(rec.porcaoG);
  const porcoes = porcaoG > 0 && pesoFinal > 0 ? num(rec.pesoUn) > 0 ? num(rec.pesoUn) / porcaoG : pesoFinal / porcaoG : 0;
  const per100 = {};
  const perPorcao = {};
  for (const k of [...NUTR, 'energia']) {
    per100[k] = pesoFinal > 0 ? (tot[k] / pesoFinal) * 100 : 0;
    perPorcao[k] = pesoFinal > 0 ? (tot[k] / pesoFinal) * porcaoG : 0;
  }

  // valores declarados (arredondados) e %VD calculado sobre o valor declarado
  const decl100 = {};
  const declPorcao = {};
  const vd = {};
  for (const k of [...NUTR, 'energia']) {
    decl100[k] = arredondar(k, per100[k]);
    declPorcao[k] = arredondar(k, perPorcao[k]);
    vd[k] = pctVD(k, declPorcao[k]);
  }

  // Selo frontal (RDC 429 / IN 75): por 100 g (sólidos) ou 100 mL (líquidos)
  const lim = rec.liquido ? { acucAdd: 7.5, sat: 3, sodio: 300 } : { acucAdd: 15, sat: 6, sodio: 600 };
  const selo = [];
  if (per100.acucAdd >= lim.acucAdd) selo.push('açúcar adicionado');
  if (per100.sat >= lim.sat) selo.push('gordura saturada');
  if (per100.sodio >= lim.sodio) selo.push('sódio');

  // Alérgenos e glúten
  const al = new Set();
  for (const x of linhas) if (x.ing && x.g > 0) (x.ing.alergenos || []).forEach((a) => al.add(a));
  const glutenGrupo = ['trigo', 'centeio', 'cevada', 'aveia'];
  const temGluten = glutenGrupo.some((a) => al.has(a));

  // Lista de ingredientes em ordem decrescente de quantidade
  const ingredientes = linhas
    .filter((x) => x.ing && x.g > 0)
    .sort((a, b) => b.g - a.g)
    .map((x) => x.ing.nome.charAt(0).toUpperCase() + x.ing.nome.slice(1));

  const custoUn = num(rec.unidades) > 0 ? custo / num(rec.unidades) : null;
  const preco = custoUn !== null ? custoUn * (1 + num(rec.markup) / 100) : null;

  return {
    linhas, total: tot, somaG, pesoFinal, porcoes, per100, perPorcao, decl100, declPorcao, vd,
    selo, alergenos: [...al], temGluten, ingredientes, avisos, semPreco,
    custo, custoUn, preco, perdaPct: somaG > 0 ? ((somaG - pesoFinal) / somaG) * 100 : 0,
  };
}

export function textoAlergenos(res) {
  const lista = res.alergenos;
  const partes = [];
  if (lista.length) partes.push(`ALÉRGICOS: CONTÉM ${lista.map((a) => a.toUpperCase()).join(', ')}.`);
  partes.push(res.temGluten ? 'CONTÉM GLÚTEN.' : 'NÃO CONTÉM GLÚTEN.');
  return partes.join(' ');
}

export const ALERGENOS = [
  'trigo', 'centeio', 'cevada', 'aveia', 'crustáceos', 'ovos', 'peixes', 'amendoim', 'soja', 'leite',
  'amêndoas', 'avelãs', 'castanha-de-caju', 'castanha-do-brasil', 'macadâmia', 'nozes', 'pecã', 'pistache', 'látex natural',
];
