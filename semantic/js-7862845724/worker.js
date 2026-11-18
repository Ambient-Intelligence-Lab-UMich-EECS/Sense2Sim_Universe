// The search by meaning of the Sense2Sim pages, off the page's thread (a module worker that client.js starts).
// In: {type: "init", base, manifest, which} once, then {type: "search", id, q}.
// Out: {type: "state", state, error?} as it gets ready ("words": BM25 can answer; "ready": the model too; "off": it cannot;
//      "words" again, with an error, when the model fails on a query), {type: "log", error} for what escapes,
//      {type: "result", id, q, text, semantic, order, vec, words, ms, hits (the World's rows)}: the newest query only (one waiting while another
//      is worked on is replaced by the next).
// build-index.mjs copies this file beside search.js and its modules (all renamed .js, as GitHub Pages serves them).
import { openUniverse, openWorld, rank, queryText } from "./search.js";
import { parseGlossary } from "./zh.js";

let ix = null, G = null, ext = null, M = null, pending = null, busy = false, step = "start";
const post = (m) => self.postMessage(m);
// an error as text: its message, then where it was thrown (the check reads it; a reader never sees it)
const why = (err) => `${step}: ${String((err && err.message) || err)}${err && err.stack ? " | " + String(err.stack).split("\n").slice(0, 4).join(" | ") : ""}`.slice(0, 900);

// a listener, not self.onmessage, so that nothing the runtime loads can take the page's messages
self.addEventListener("message", (e) => {
  const m = e.data;
  if (!m || typeof m !== "object") return;
  if (m.type === "init") init(m).catch((err) => post({ type: "state", state: ix ? "words" : "off", error: why(err) }));
  else if (m.type === "search") { pending = m; pump(); }
});
// whatever escapes: said before it ends the worker
self.addEventListener("error", (e) => post({ type: "log", error: `uncaught (${step}): ${e.message} ${e.filename || ""}:${e.lineno || ""}` }));
self.addEventListener("unhandledrejection", (e) => post({ type: "log", error: why(e.reason) }));

async function init({ base, manifest, which }) {
  M = manifest;
  const part = M[which];
  if (!part) throw new Error(`the index has no ${which}`);
  const get = (f, how) => fetch(base + f).then((r) => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r[how](); });
  step = "index";
  const [json, bin, gl] = await Promise.all([get(part.json, "json"), get(part.bin, "arrayBuffer"), get(M.glossary, "text")]);
  ix = which === "universe" ? openUniverse(json, bin) : openWorld(json, bin);
  G = parseGlossary(gl);
  post({ type: "state", state: "words", keys: which === "universe" ? json.keys : [...new Set(json.items.map((r) => r.key))],
    spaces: which === "world" ? json.spaces : undefined, papers: which === "world" ? json.papers : undefined });
  pump();
  step = "runtime";
  const T = await import(base + M.runtime.dir + M.runtime.lib);
  const env = T.env;
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  // a path from the site's root, not a whole URL: transformers.js looks for a local file (the tokenizer's) only when
  // its path is not an http(s) URL, and would then leave the tokenizer out
  env.localModelPath = new URL(base + M.model.dir).pathname;
  const w = env.backends && env.backends.onnx && env.backends.onnx.wasm;
  if (w) {
    w.wasmPaths = Object.fromEntries(Object.entries(M.runtime.wasm).map(([k, f]) => [k, base + M.runtime.dir + f]));
    w.numThreads = 1;
    w.proxy = false;
  }
  step = "model";
  const p = await T.pipeline("feature-extraction", M.model.local, { dtype: M.model.dtype, device: "wasm" });
  step = "first vector";
  await p("warm up", { pooling: M.model.pooling, normalize: true });  // a model that cannot answer is never "ready"
  ext = p;
  step = "search";
  post({ type: "state", state: "ready" });
  pump();
}

async function pump() {
  if (busy || !pending || !ix) return;
  busy = true;
  try {
    while (pending) {
      const m = pending;
      pending = null;
      const t0 = performance.now(), text = queryText(m.q, G);
      let qv = null;
      if (ext && text) {
        try { qv = (await ext(M.model.query + text, { pooling: M.model.pooling, normalize: true })).data; }
        catch (err) { ext = null; post({ type: "state", state: "words", error: "the model failed, keywords only: " + why(err) }); }
      }
      if (pending) continue;                      // a newer query came while this one was turned into its vector
      const r = rank(ix, qv, text, M.rank);
      post({ type: "result", id: m.id, q: m.q, text, semantic: !!qv, order: Array.from(r.order.slice(0, 300)), vec: Array.from(r.vec.slice(0, 30)),
        words: Array.from(r.words.slice(0, 30)), ms: performance.now() - t0,
        // the World's rows found, as the page lists them (its space, its room, the paper, run or placed, what it reads)
        hits: ix.kind === "world" ? r.order.slice(0, 80).map((i) => ix.items[i]) : undefined });
    }
  } catch (err) {
    post({ type: "state", state: "off", error: why(err) });
  }
  busy = false;
}
