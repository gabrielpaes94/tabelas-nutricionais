// Persistência local (localStorage) + backup em arquivo.
import { SEED_INGS, SEED_RECIPE } from '../data/seed.js';

const KEY = 'tn-dona-janine-v1';
export const VERSAO = 1;

const clone = (o) => JSON.parse(JSON.stringify(o));
export const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function estadoInicial() {
  return { versao: VERSAO, ings: clone(SEED_INGS), recipes: [clone(SEED_RECIPE)], settings: { metodo: 'planilha' } };
}

export function carregar() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.ings) && Array.isArray(s.recipes)) {
        s.settings = { metodo: 'planilha', ...(s.settings || {}) };
        return s;
      }
    }
  } catch (e) { /* sem acesso ao armazenamento: usa estado em memória */ }
  return estadoInicial();
}

export function salvar(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
}

export async function pedirPersistencia() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) { return false; }
}

export function backupBlob(s) {
  const dados = { app: 'tabelas-nutricionais-dona-janine', versao: VERSAO, exportadoEm: new Date().toISOString(), ings: s.ings, recipes: s.recipes, settings: s.settings };
  return new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' });
}

// Valida e normaliza um backup lido de arquivo
export function lerBackup(texto) {
  const d = JSON.parse(texto);
  if (!d || d.app !== 'tabelas-nutricionais-dona-janine' || !Array.isArray(d.ings) || !Array.isArray(d.recipes)) {
    throw new Error('Arquivo de backup inválido.');
  }
  return { versao: VERSAO, ings: d.ings, recipes: d.recipes, settings: { metodo: 'planilha', ...(d.settings || {}) } };
}

export function novaReceita() {
  return { id: uid('r'), nome: 'Nova receita', unidades: 1, pesoUn: 100, porcaoG: 50, medida: '', liquido: false, linhas: [], markup: 100, larguraMm: 60, alturaMm: 70 };
}

export function novoInsumo(base = {}) {
  return { id: uid('u'), nome: '', fonte: '', carbo: 0, acucTot: null, acucAdd: null, prot: 0, gord: 0, sat: 0, trans: 0, fibra: 0, sodio: 0, alergenos: [], unidades: [], preco: null, precoQtd: null, ...base };
}
