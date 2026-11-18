// Search by meaning for the Sense2Sim pages (the Sensing Universe and the Sensing World). A classic script: it reads
// the site's semantic/manifest.json and starts the module worker the manifest names, which does the work.
// Opened from the disk (the offline zip) it stays off and fetches nothing: the page keeps its own search.
//   S2S_SEMANTIC.init({ base, which: "universe" | "world", keys, idle })
//     base: where semantic/ is (default: where this script was loaded from); keys: the page's own paper keys, to refuse an index
//     made for other papers; idle: start when the page is idle (default), not at once
//   S2S_SEMANTIC.search(q) -> Promise of the worker's result, or null (not ready), or { stale: true } (a newer query
//     came first)
//   S2S_SEMANTIC.state: "off" | "loading" | "words" (keywords can answer) | "ready" (the model too); onstate(S) on change;
//     S2S_SEMANTIC.error: why it is off, or why the model is not there ("words" after "ready": the model failed);
//     S2S_SEMANTIC.keys: the index's paper keys once it is loaded (a Universe result's order indexes them); for the World,
//     S2S_SEMANTIC.spaces (its spaces and rooms, named) and S2S_SEMANTIC.papers (key -> [name, title])
(function () {
  var S = window.S2S_SEMANTIC = { state: "off", error: null, log: [], onstate: null };
  var worker = null, seq = 0, waiting = {}, ME = document.currentScript && document.currentScript.src;
  function set(state, extra) {
    S.state = state;
    for (var k in extra || {}) S[k] = extra[k];
    if (S.onstate) try { S.onstate(S); } catch (e) { /* the page's own trouble */ }
  }
  function off(why) { if (worker) worker.terminate(); worker = null; set("off", { error: why }); for (var id in waiting) waiting[id](null); waiting = {}; }
  S.init = function (o) {
    o = o || {};
    if (location.protocol === "file:" || typeof Worker === "undefined" || typeof WebAssembly === "undefined" || !window.fetch) return off("not on this page");
    var root = o.base ? new URL(o.base, location.href).href : ME ? new URL("./", ME).href : new URL("../../semantic/", location.href).href;
    var which = o.which || "universe";
    function go() {
      fetch(root + "manifest.json", { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error("no semantic/manifest.json");
        return r.json();
      }).then(function (M) {
        if (!M[which]) throw new Error("the index has no " + which);
        set("loading", { manifest: M, which: which });
        worker = new Worker(root + M.worker, { type: "module" });
        worker.onmessage = function (e) {
          var m = e.data;
          if (m.type === "state") {
            if (m.keys && o.keys && !sameKeys(o.keys, m.keys, which)) return off("the index was made for other papers");
            if (m.keys) S.keys = m.keys;
            if (m.spaces) { S.spaces = m.spaces; S.papers = m.papers; }
            if (m.state === "off") return off(m.error);
            set(m.state, { error: m.error || null });
          } else if (m.type === "log") {
            S.log.push(m.error);
            if (S.log.length > 20) S.log.shift();
          } else if (m.type === "result") {
            var w = waiting[m.id];
            delete waiting[m.id];
            if (w) w(m);
          }
        };
        worker.onerror = function (e) { off("the worker failed: " + (e.message || "") + " " + (e.filename || "") + ":" + (e.lineno || "")); };
        worker.postMessage({ type: "init", base: root, manifest: M, which: which });
      }).catch(function (e) { off(String(e.message || e)); });
    }
    if (o.idle === false) go();
    else if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 3000 });
    else setTimeout(go, 200);
  };
  // the Universe's index must hold exactly the page's papers; the World's, only papers the page knows
  function sameKeys(page, index, which) {
    var mine = {}, i;
    for (i = 0; i < page.length; i++) mine[page[i]] = 1;
    for (i = 0; i < index.length; i++) if (!mine[index[i]]) return false;
    return which !== "universe" || index.length === page.length;
  }
  S.search = function (q) {
    if (!worker || (S.state !== "words" && S.state !== "ready")) return Promise.resolve(null);
    for (var id in waiting) waiting[id]({ stale: true });
    waiting = {};
    var my = ++seq;
    return new Promise(function (res) { waiting[my] = res; worker.postMessage({ type: "search", id: my, q: String(q) }); });
  };
})();
