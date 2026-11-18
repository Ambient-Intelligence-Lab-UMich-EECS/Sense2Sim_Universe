// Ranking without a model: the page's search as it is today, and BM25 over each paper's card, the keyword half of
// the hybrid. Both work on what the public page holds; the abstract is never searched as text.

import { cardText } from "./texts.js";

// the Universe page's fold (build/site_template.html): case, accents and punctuation go
export const fold = t => String(t ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[øØ]/g, "o").replace(/[łŁ]/g, "l")
  .replace(/æ/g, "ae").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Today: the page finds a paper when the whole query, folded, starts a word of one of its fields; it ranks by citations.
export function todayIndex(papers) {
  return papers.map(p => {
    const L = p.labels || p.authors_labels || {}, o = p.ours, v = p.venue || {};
    const f = [p.name, p.title, ...(p.authors || []).map(a => a.name), v.short, v.full, v.year, ...(L.keywords || []),
      ...(L.ccs_2012 || []).map(x => x.join(" ")),
      ...(o ? [o.modality, o.phenomenon, o.simulator, o.technique, o.sensor, o.device, o.application,
        ...Object.values(p.tags || {}).filter(Array.isArray).flat(),
        ...(p.scenario ? [p.scenario.primary, ...(p.scenario.secondary || [])] : [])] : [p.considered && p.considered.modality])];
    return " " + f.map(fold).filter(Boolean).join(" \u0001 ") + " ";
  });
}

export function todayRank(index, papers, q) {
  const fq = fold(q);
  if (!fq) return [];
  const cites = p => (p.citations && (p.citations.semantic_scholar ?? p.citations.openalex)) || 0;
  return index.map((h, i) => h.includes(" " + fq) ? i : -1).filter(i => i >= 0).sort((a, b) => cites(papers[b]) - cites(papers[a]));
}

const STOP = new Set(("a an the and or of to in on at by for with from into using use used via its it is are be as that this which " +
  "what how when where who whose than then their there these those any each every no not without can could do does did so such own " +
  "s t one".split(" ")));

export function stem(w) {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export const words = t => fold(t).split(" ").filter(w => w && !STOP.has(w)).map(stem);

// BM25 (k1 1.2, b 0.75) over each paper's card
export const bm25Index = papers => bm25Texts(papers.map(p => cardText(p)));

// BM25 over any texts (the cards the index ships, the World's rows)
export function bm25Texts(texts) {
  const docs = texts.map(t => words(t));
  const df = new Map();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) || 0) + 1);
  const tf = docs.map(d => { const m = new Map(); for (const w of d) m.set(w, (m.get(w) || 0) + 1); return m; });
  const avg = docs.reduce((s, d) => s + d.length, 0) / docs.length;
  return { tf, len: docs.map(d => d.length), df, N: docs.length, avg };
}

export function bm25Scores(ix, q, k1 = 1.2, b = 0.75) {
  const s = new Float64Array(ix.N);
  for (const w of new Set(words(q))) {
    const n = ix.df.get(w);
    if (!n) continue;
    const idf = Math.log(1 + (ix.N - n + 0.5) / (n + 0.5));
    for (let i = 0; i < ix.N; i++) {
      const f = ix.tf[i].get(w);
      if (f) s[i] += idf * f * (k1 + 1) / (f + k1 * (1 - b + b * ix.len[i] / ix.avg));
    }
  }
  return s;
}

// indices by score, highest first; keep: only scores above this count
export function order(scores, keep = -Infinity) {
  const idx = [];
  for (let i = 0; i < scores.length; i++) if (scores[i] > keep) idx.push(i);
  return idx.sort((a, b) => scores[b] - scores[a]);
}

// Reciprocal Rank Fusion: each list adds w/(k + its rank) to the papers it holds (w: that list's weight, 1 unless given)
export function rrf(lists, n, k = 60, weights = []) {
  const s = new Float64Array(n);
  lists.forEach((L, j) => { const w = weights[j] ?? 1; L.forEach((i, r) => { s[i] += w / (k + r + 1); }); });
  return order(s, 0);
}

// how the page ranks: the vectors' list and BM25's, fused. check-index.mjs (job 66339400, 2026-11-18): chosen on one
// half of the test set, k 20 with the vectors ×4; on the other, k 20 with ×1.5; ×2 between them finds 97% of the
// papers in the first 10 on both halves (k 60 ×1 found 91% on one)
export const RANK = { k: 20, vector_weight: 2 };
