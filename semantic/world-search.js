// The Sensing World page's search by meaning, as the public site adds it (after semantic/client.js; patch-world.py puts
// both in pages/world/index.html). The World page itself is unchanged: this script adds a box beside its title; a query
// (a phrase or a question, in English or in Chinese through the glossary) lists the papers the spaces run or place that
// come closest, by space and room, and marks the spaces that hold them in the selector, without numbers (AmI,
// 2026-11-17: no counts in the menus). A click, or Enter, opens the paper in its space by the page's own link
// (#space-paperKey). Opened from the disk it adds nothing.
(function () {
  var S = window.S2S_SEMANTIC;
  if (!S || location.protocol === "file:" || typeof Worker === "undefined") return;
  var SPACES = 6, PER_SPACE = 4;

  var css = [
    "#s2s-ws { position: relative; flex: 1 1 auto; max-width: 420px; margin-left: auto; }",
    "#s2s-ws input { width: 100%; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--panel); color: var(--ink); font: 14px/1 var(--body); }",
    "#s2s-ws input::placeholder { color: var(--muted); }",
    "#s2s-ws input:focus { outline: none; border-color: var(--accent); }",
    "#s2s-wl { position: absolute; right: 0; top: 42px; width: min(520px, calc(100vw - 32px)); max-height: 70vh; overflow: auto; z-index: 30; padding: 8px; border-radius: 12px; border: 1px solid var(--line-strong); background: var(--card); color: var(--ink); box-shadow: 0 14px 40px rgb(0 0 0 / 0.35); }",
    "#s2s-wl .hd { color: var(--muted); font: 12px/1.4 var(--body); padding: 2px 6px 6px; }",
    "#s2s-wl .sp { display: flex; align-items: center; gap: 6px; padding: 8px 6px 3px; font: 600 12.5px/1.2 var(--body); color: var(--accent); }",
    "#s2s-wl .sp svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }",
    "#s2s-wl button { display: grid; grid-template-columns: 1fr auto; gap: 1px 10px; width: 100%; padding: 5px 6px 5px 28px; border: 0; border-radius: 7px; background: transparent; color: var(--ink); text-align: left; cursor: pointer; font: 13px/1.3 var(--body); }",
    "#s2s-wl button:hover, #s2s-wl button.on { background: var(--accent-soft); }",
    "#s2s-wl button .rm { color: var(--muted); font-size: 12px; }",
    "#s2s-wl button .ds { grid-column: 1 / -1; color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".tabs button.s2s-hit { position: relative; }",
    ".tabs button.s2s-hit::after { content: ''; position: absolute; top: 7px; right: 7px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }",
  ].join("\n");

  var box, input, list, last = null, seq = 0, on = -1;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function spaceName(id) { var s = (S.spaces || []).filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  function roomName(sp, id) {
    var s = (S.spaces || []).filter(function (x) { return x.id === sp; })[0], r = s && s.rooms.filter(function (x) { return x.id === id; })[0];
    return r ? r.label : "";
  }
  function icon(sp) { var b = document.querySelector('#tabs button[data-id="' + sp + '"] svg'); return b ? b.cloneNode(true) : null; }
  function mark(spaces) {
    var all = document.querySelectorAll("#tabs button[data-id]");
    for (var i = 0; i < all.length; i++) all[i].classList.toggle("s2s-hit", !!spaces && spaces.indexOf(all[i].dataset.id) >= 0);
  }
  function close() { list.hidden = true; on = -1; }
  function clear() { last = null; mark(null); list.replaceChildren(); close(); }
  function go(sp, key) { close(); input.blur(); location.hash = sp + "-" + key; }

  // the rows found, by space (the space of the closest first) and in each space its closest papers
  function render(r) {
    list.replaceChildren();
    on = -1;
    var groups = [], bySp = {}, seen = {};
    for (var i = 0; i < r.hits.length; i++) {
      var h = r.hits[i], id = h.space + "/" + h.key;
      if (seen[id]) continue;
      seen[id] = 1;
      var g = bySp[h.space];
      if (!g) { if (groups.length >= SPACES) continue; g = bySp[h.space] = { space: h.space, rows: [] }; groups.push(g); }
      if (g.rows.length < PER_SPACE) g.rows.push(h);
    }
    var head = groups.length ? "Closest first, by space: a paper opens in its space" : "No paper found";
    if (r.text && r.text !== r.q) head += " · searched as “" + r.text + "”";
    if (!r.semantic) head += " · keywords only while the model loads";
    list.append(el("div", "hd", head));
    groups.forEach(function (g) {
      var t = el("div", "sp"), ic = icon(g.space);
      if (ic) t.append(ic);
      t.append(el("span", null, spaceName(g.space)));
      list.append(t);
      g.rows.forEach(function (h) {
        var p = (S.papers || {})[h.key] || [h.key, ""], b = el("button");
        b.type = "button"; b.setAttribute("role", "option");
        b.append(el("span", null, /et al\./.test(p[0]) && p[1] ? p[1] : p[0]), el("span", "rm", roomName(g.space, h.room)), el("span", "ds", h.says || p[1]));
        b.addEventListener("pointerdown", function (e) { e.preventDefault(); });
        b.addEventListener("click", function () { go(g.space, h.key); });
        list.append(b);
      });
    });
    mark(groups.map(function (g) { return g.space; }));
    list.hidden = document.activeElement !== input;
  }
  function search() {
    var q = input.value.trim(), my = ++seq;
    if (q.length < 2) { clear(); return; }
    if (S.state !== "words" && S.state !== "ready") { list.replaceChildren(el("div", "hd", "The search is loading…")); list.hidden = false; return; }
    S.search(q).then(function (r) {
      if (!r || r.stale || my !== seq || r.q !== input.value.trim()) return;
      last = r; render(r);
    });
  }
  function keys(e) {
    var rows = list.querySelectorAll("button");
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && rows.length) {
      e.preventDefault();
      on = e.key === "ArrowDown" ? (on + 1) % rows.length : (on <= 0 ? rows.length : on) - 1;
      for (var i = 0; i < rows.length; i++) rows[i].classList.toggle("on", i === on);
      rows[on].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && rows.length) { e.preventDefault(); rows[on >= 0 ? on : 0].click(); }
    else if (e.key === "Escape") { input.value = ""; clear(); input.blur(); }
  }

  function setup() {
    var row = document.querySelector(".brand-row");
    if (!row || document.getElementById("s2s-ws")) return;
    var style = el("style"); style.textContent = css; document.head.append(style);
    box = el("div"); box.id = "s2s-ws";
    input = el("input"); input.type = "search"; input.placeholder = "Search the papers by meaning…"; input.autocomplete = "off";
    input.setAttribute("aria-label", "Search the papers of every space by meaning"); input.setAttribute("aria-controls", "s2s-wl");
    list = el("div"); list.id = "s2s-wl"; list.hidden = true; list.setAttribute("role", "listbox");
    box.append(input, list);
    var theme = document.getElementById("theme");
    if (theme && theme.parentNode === row) row.insertBefore(box, theme); else row.append(box);
    input.addEventListener("input", search);
    input.addEventListener("focus", function () { if (last && input.value.trim().length >= 2) { list.hidden = false; } });
    input.addEventListener("keydown", keys);
    document.addEventListener("pointerdown", function (e) { if (!box.contains(e.target)) close(); });
    S.onstate = function () { if (input.value.trim().length >= 2) search(); };
    S.init({ which: "world" });
    window.S2S_WORLD_SEARCH = { input: input, list: list, last: function () { return last; } }; // for the checks
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup); else setup();
})();
