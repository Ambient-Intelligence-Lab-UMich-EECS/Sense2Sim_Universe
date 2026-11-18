// How the page ranks: the same code in the browser (site/worker.js imports it) and in Node (check-index.mjs), so the
// test judges what the reader gets. Plain JavaScript modules only (rank.mjs, vectors.mjs, texts.mjs).

import { bm25Texts, bm25Scores, order, rrf, RANK } from "./rank.js";
import { scoreRows } from "./vectors.js";

// an index file pair (build-index.mjs) as the search reads it; bin: an ArrayBuffer
export function openUniverse(json, bin) {
  const n = json.rows, d = json.dims, q = new Int8Array(bin);
  return { kind: "universe", n, d, keys: json.keys, card: q.subarray(0, n * d), abs: q.subarray(n * d, 2 * n * d),
    cs: json.card_scale, as: json.abstract_scale, bm: bm25Texts(json.cards) };
}
export function openWorld(json, bin) {
  return { kind: "world", n: json.rows, d: json.dims, items: json.items, spaces: json.spaces, rows: new Int8Array(bin),
    scale: json.scale, bm: bm25Texts(json.texts) };
}

// what a query is searched as: as typed (English only, AmI 2026-11-18: the Chinese glossary is gone; the pages do not
// search a Chinese query by meaning)
export const queryText = (q) => String(q).trim();
export const hasCJK = (t) => /[\u3400-\u9fff\uf900-\ufaff]/.test(t || "");

// the vectors' scores: a paper scores the nearer of its card and its abstract; a World row, its one vector
export function vectorScores(ix, qv) {
  if (ix.kind === "world") return scoreRows(qv, ix.rows, ix.scale, ix.d);
  const a = scoreRows(qv, ix.card, ix.cs, ix.d), b = scoreRows(qv, ix.abs, ix.as, ix.d);
  for (let i = 0; i < ix.n; i++) if (b[i] > a[i]) a[i] = b[i];
  return a;
}

// qv: the query's vector, or null while the model is not there (BM25 alone); text: queryText's answer.
// order: every row with a score, best first; vec, words: the two lists the order fused.
export function rank(ix, qv, text, cfg = RANK) {
  const words = text ? order(bm25Scores(ix.bm, text), 0) : [];
  if (!qv) return { order: words, vec: [], words };
  const vec = order(vectorScores(ix, qv));
  return { order: rrf([vec, words], ix.n, cfg.k, [cfg.vector_weight, 1]), vec, words };
}
