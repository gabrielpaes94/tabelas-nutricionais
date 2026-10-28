// Geração da tabela nutricional (SVG em milímetros), selo frontal, PNG e PDF.
import { LINHAS, fmt } from './calc.js';

const PT_MM = 0.3528; // 1 pt em mm
const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Unidades verticais (em múltiplos da fonte f) de cada bloco
const V = { titulo: 1.6, sub: 1.2, cab: 1.35, linha: 1.2, rodape: 1.0 };
const V_TOTAL = V.titulo + 2 * V.sub + V.cab + LINHAS.length * V.linha + 2 * V.rodape + 0.3;
const PAD = 0.8;
const COL = { nome: 0.47, c1: 0.19, c2: 0.19, c3: 0.15 };

export function layoutLabel(W, H) {
  const win = W - 2 * PAD;
  const fH = (H - 2 * PAD) / V_TOTAL;
  const fW = (COL.nome * win) / 12.5; // "Açúcares adicionados (g)" cabe sem espremer
  const f = Math.max(0.4, Math.min(fH, fW));
  const pt = f / PT_MM;
  return { f, pt, sy: (H - 2 * PAD) / (V_TOTAL * f) };
}

// Avaliação do tamanho de letra (IN 75: padrão 8 pt; reduzido 6 pt)
export function avaliarFonte(pt) {
  if (pt >= 8) return { nivel: 'ok', msg: `Letra de ${pt.toFixed(1)} pt: atende ao formato padrão (8 pt).` };
  if (pt >= 6) return { nivel: 'aviso', msg: `Letra de ${pt.toFixed(1)} pt: só serve ao formato reduzido (6 pt), previsto para embalagens pequenas. Confirme com o responsável técnico.` };
  return { nivel: 'erro', msg: `Letra de ${pt.toFixed(1)} pt: abaixo do mínimo de 6 pt da IN 75. Aumente o tamanho da tabela.` };
}

// Tamanho mínimo (mm) para uma largura dada, a 8 pt ou 6 pt
export function tamanhoMinimo(pt) {
  const f = pt * PT_MM;
  return { W: Math.ceil((12.5 * f) / COL.nome + 2 * PAD), H: Math.ceil(V_TOTAL * f + 2 * PAD) };
}

export function buildLabelSVG(rec, res, { W, H }) {
  const { f, sy } = layoutLabel(W, H);
  const u = f * sy; // unidade vertical
  const win = W - 2 * PAD;
  const xNome = PAD + 0.5;
  const xC1 = PAD + win * (COL.nome + COL.c1) - 0.3;
  const xC2 = PAD + win * (COL.nome + COL.c1 + COL.c2) - 0.3;
  const xC3 = PAD + win - 0.4;
  const un = rec.liquido ? 'mL' : 'g';
  const p = [];
  const txt = (x, y, s, size, o = {}) =>
    p.push(`<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" font-size="${size.toFixed(3)}" font-family="${FONT}" font-weight="${o.bold ? 700 : 400}" text-anchor="${o.anchor || 'start'}" fill="#000">${esc(s)}</text>`);
  const linha = (y, w) => p.push(`<line x1="${PAD.toFixed(2)}" x2="${(W - PAD).toFixed(2)}" y1="${y.toFixed(3)}" y2="${y.toFixed(3)}" stroke="#000" stroke-width="${w.toFixed(3)}"/>`);

  p.push(`<rect x="0.1" y="0.1" width="${W - 0.2}" height="${H - 0.2}" fill="#fff" stroke="#000" stroke-width="0.2"/>`);
  let y = PAD;
  const base = (h) => y + h * 0.74;

  txt(xNome, base(V.titulo * u), 'INFORMAÇÃO NUTRICIONAL', f * 1.1, { bold: true });
  y += V.titulo * u;
  linha(y, f * 0.2);

  const porcoes = res.porcoes > 0 ? fmt(Math.round(res.porcoes * 10) / 10) : '-';
  txt(xNome, base(V.sub * u), `Porções por embalagem: ${porcoes}`, f);
  y += V.sub * u;
  const medida = rec.medida ? ` (${rec.medida})` : '';
  txt(xNome, base(V.sub * u), `Porção: ${fmt(Number(rec.porcaoG) || 0)} ${un}${medida}`, f);
  y += V.sub * u;
  linha(y, f * 0.08);

  txt(xC1, base(V.cab * u), `100 ${un}`, f, { bold: true, anchor: 'end' });
  txt(xC2, base(V.cab * u), `${fmt(Number(rec.porcaoG) || 0)} ${un}`, f, { bold: true, anchor: 'end' });
  txt(xC3, base(V.cab * u), '%VD*', f, { bold: true, anchor: 'end' });
  y += V.cab * u;
  linha(y, f * 0.2);

  LINHAS.forEach((l, i) => {
    const filho = l.key === 'acucTot' || l.key === 'acucAdd' ? 0.9 : 1; // recuo visual dos açúcares
    const recuo = l.key === 'acucTot' ? f * 0.8 : l.key === 'acucAdd' ? f * 1.6 : 0;
    const bold = l.key === 'energia';
    txt(xNome + recuo, base(V.linha * u), l.nome, f * filho, { bold });
    txt(xC1, base(V.linha * u), fmt(res.decl100[l.key]), f, { anchor: 'end' });
    txt(xC2, base(V.linha * u), fmt(res.declPorcao[l.key]), f, { anchor: 'end' });
    if (l.vd && res.vd[l.key] !== null) txt(xC3, base(V.linha * u), `${res.vd[l.key]}`, f, { anchor: 'end' });
    y += V.linha * u;
    linha(y, i === LINHAS.length - 1 ? f * 0.2 : f * 0.05);
  });

  txt(xNome, base(V.rodape * u), '*Percentual de valores diários', f * 0.78);
  y += V.rodape * u;
  txt(xNome, base(V.rodape * u), 'fornecidos pela porção.', f * 0.78);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${p.join('')}</svg>`;
}

// Selo frontal "ALTO EM" (um único quadro com todos os nutrientes)
export function buildSeloSVG(selo, W = 36) {
  const linhasTxt = selo.map((s) => s.toUpperCase());
  const f = W * 0.085;
  const pad = W * 0.07;
  const H = pad * 2 + f * 2.2 + linhasTxt.length * f * 1.45;
  const p = [`<rect width="${W}" height="${H}" fill="#000"/>`];
  const r = f * 0.8;
  const cx = pad + r + 0.2, cy = pad + f * 1.1;
  p.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="${f * 0.28}"/>`);
  p.push(`<line x1="${cx + r * 0.72}" y1="${cy + r * 0.72}" x2="${cx + r * 1.7}" y2="${cy + r * 1.7}" stroke="#fff" stroke-width="${f * 0.34}" stroke-linecap="round"/>`);
  p.push(`<text x="${cx + r * 2.3}" y="${cy + f * 0.35}" font-size="${f * 1.1}" font-family="${FONT}" font-weight="700" fill="#fff">ALTO EM</text>`);
  linhasTxt.forEach((s, i) => {
    p.push(`<text x="${pad}" y="${pad + f * 2.9 + i * f * 1.45}" font-size="${f * 1.15}" font-family="${FONT}" font-weight="700" fill="#fff">${esc(s)}</text>`);
  });
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H.toFixed(2)}mm" viewBox="0 0 ${W} ${H.toFixed(2)}">${p.join('')}</svg>`, W, H };
}

// ---------- exportação ----------
export function svgParaCanvas(svg, wMm, hMm, dpi = 600) {
  const w = Math.round((wMm / 25.4) * dpi);
  const h = Math.round((hMm / 25.4) * dpi);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao gerar a imagem.')); };
    img.src = url;
  });
}

const canvasBlob = (c, tipo, q) => new Promise((res) => c.toBlob(res, tipo, q));

export async function gerarPNG(svg, wMm, hMm, dpi = 600) {
  return canvasBlob(await svgParaCanvas(svg, wMm, hMm, dpi), 'image/png');
}

// PDF de uma página com a imagem (JPEG alta qualidade), no tamanho exato da tabela
export async function gerarPDF(svg, wMm, hMm, dpi = 600) {
  const c = await svgParaCanvas(svg, wMm, hMm, dpi);
  const jpeg = new Uint8Array(await (await canvasBlob(c, 'image/jpeg', 0.98)).arrayBuffer());
  const wPt = (wMm / 25.4) * 72, hPt = (hMm / 25.4) * 72;
  const enc = new TextEncoder();
  const partes = [];
  const offs = [];
  let tam = 0;
  const add = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); tam += b.length; };
  const obj = (n, corpo) => { offs[n] = tam; add(`${n} 0 obj\n${corpo}\nendobj\n`); };
  add('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(2)} ${hPt.toFixed(2)}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>`);
  const cont = `q ${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} 0 0 cm /Im0 Do Q`;
  obj(4, `<< /Length ${cont.length} >>\nstream\n${cont}\nendstream`);
  offs[5] = tam;
  add(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  add(jpeg);
  add('\nendstream\nendobj\n');
  const xref = tam;
  let x = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  add(x + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(partes, { type: 'application/pdf' });
}

// Compartilha pelo menu do iPhone (Salvar em Arquivos/Imagens) ou baixa
export async function salvarOuCompartilhar(blob, nome) {
  const file = new File([blob], nome, { type: blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: nome });
      return 'compartilhado';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelado';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return 'baixado';
}
