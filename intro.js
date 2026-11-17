/* Sense2Sim landing: the way into the Sensing Universe and the Sensing World.
   One scene, driven by the page's scroll (eased, so it plays fluidly both ways):
     1  three papers' first pages, large, under the title
     2  the view pulls back: more and more papers, smaller and smaller, a wall of them, nearer and farther
        ones moving apart (parallax)
     3  each paper shrinks to a star and flies to its place in the Sensing Universe: the galaxies of the LLAP
        page's flight (one cluster for each way of sensing, the oldest paper at its heart, the newest at its rim)
     4  the stars and their dust turn to particles and settle as a point cloud of the Sensing World's everyday
        spaces, a sensing pulse running through it
     5  the papers' stars fly out again: the Universe on the left, the World on the right, two entrances
   One classic script, no modules, no network, no picture files: it opens from a zip by double-click (file://).
   The papers come from intro-data.js (tools/landing/build-data.mjs writes it from the knowledge base).
   For checks: S2S_INTRO.freeze(p, t) draws the scene at scroll progress p (0..1) and time t; unfreeze() lets go. */
(function () {
  "use strict";
  var DATA = window.S2S_INTRO_DATA;
  var root = document.documentElement;
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage"), track = $("track"), canvas = $("gl"), labels = $("labels");
  var capHero = $("cap-hero"), capUni = $("cap-uni"), capWorld = $("cap-world"), gates = $("gates");
  var API = (window.S2S_INTRO = { ready: false, live: false, error: null, p: 0, frames: 0 });

  // where the entrances lead: the site's own pages, or what the page sets before this script (a preview)
  var LINKS = window.S2S_INTRO_LINKS || (DATA && DATA.links) || {};
  [].forEach.call(document.querySelectorAll("[data-go]"), function (a) {
    var u = LINKS[a.getAttribute("data-go")];
    if (!u) return;
    a.setAttribute("href", u);
    if (/^https?:/.test(u)) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
  });
  $("brand").addEventListener("click", function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); });

  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var gl = null;
  if (DATA && DATA.counts && !reduce) {
    try { gl = canvas.getContext("webgl2", { antialias: true, alpha: false, depth: true, powerPreference: "high-performance" }); } catch (e) { gl = null; }
  }
  if (!gl) { API.ready = true; return; } // the words and the two entrances stay, in the page's flow

  // ---------------------------------------------------------------- small maths
  var TAU = Math.PI * 2;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function seg(x, a, b) { return clamp((x - a) / (b - a), 0, 1); }
  function smooth(x) { return x * x * (3 - 2 * x); }
  function easeIO(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function mix(a, b, f) { return a + (b - a) * f; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6d2b79f5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hex(c) { return [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255]; }

  // the story's parts along the scroll (0..1)
  var T = { dolly: [0, 0.38], fly: [0.38, 0.6], burst: [0.68, 0.87], split: [0.9, 1.0] };
  var FLY_DUR = 0.42;

  // ---------------------------------------------------------------- the papers
  // the galaxies' colours, as the LLAP page's flight (night sky), and darker ones for a white sheet
  var MOD_NIGHT = { RF: "#6b98ff", Acoustic: "#d9f272", Optical: "#ff8a5b", Electric: "#c7a2ff", Mechanical: "#aab5c7", Magnetic: "#f0c674" };
  var MOD_SHEET = { RF: "#2c5fd6", Acoustic: "#6a8a00", Optical: "#d6501f", Electric: "#7a4ccc", Mechanical: "#5a677d", Magnetic: "#b07c08" };
  var MODS = DATA.mods, COUNTS = DATA.counts, HEROES = DATA.heroes || [];
  var N = 0, OFF = [];
  COUNTS.forEach(function (n) { OFF.push(N); N += n; });
  var colNight = new Float32Array(21), colSheet = new Float32Array(21);
  for (var gi = 0; gi < 7; gi++) {
    colNight.set(hex(MOD_NIGHT[MODS[gi]] || "#9ba8bb"), gi * 3);
    colSheet.set(hex(MOD_SHEET[MODS[gi]] || "#7d8799"), gi * 3);
  }
  var seedR = rng(1443);
  var HH = new Float32Array(N), HZ = new Float32Array(N); // each paper's own two numbers (from its key, where the data holds them)
  for (var k0 = 0; k0 < N; k0++) {
    HH[k0] = DATA.h && DATA.h[k0] != null ? DATA.h[k0] / 1000 : seedR();
    HZ[k0] = DATA.z && DATA.z[k0] != null ? DATA.z[k0] / 1000 : seedR();
  }

  // the universe: each cluster round an ellipse, its size by its count; its papers on a spiral, the oldest at the
  // heart (the LLAP page's uniBuild, in units of 840 px; upright on a narrow screen)
  function layoutStars(portrait) {
    var rx = portrait ? 0.4 : 640 / 840, ry = portrait ? 0.86 : 250 / 840;
    var pos = new Float32Array(N * 2), gal = [];
    var b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
    for (var g = 0; g < 7; g++) {
      var n = COUNTS[g], a = -Math.PI / 2 + (g * TAU) / 6 + 0.32;
      var gx = g < 6 ? rx * Math.cos(a) : 0, gy = g < 6 ? ry * Math.sin(a) : 0;
      var R = g < 6 ? (8.6 * Math.sqrt(n)) / 840 : 34 / 840;
      for (var i = 0; i < n; i++) {
        var k = OFF[g] + i, r = R * Math.sqrt((i + 0.5) / Math.max(1, n)) * (0.82 + 0.36 * HH[k]), th = i * 2.39996 + (r * 840) / 40;
        var x = gx + r * Math.cos(th), y = gy + 0.78 * r * Math.sin(th);
        pos[k * 2] = x; pos[k * 2 + 1] = y;
        if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      }
      gal.push({ g: g, x: gx, y: gy, R: R, n: n, ly: gy + 0.78 * R + 34 / 840 });
    }
    var stars = { x0: b.x0 - 0.02, x1: b.x1 + 0.02, y0: b.y0 - 0.02, y1: b.y1 + 0.02 };
    var withNames = { x0: stars.x0, x1: stars.x1, y0: stars.y0, y1: stars.y1 };
    gal.forEach(function (q) { if (q.g < 6 && q.n && q.ly + 0.03 > withNames.y1) withNames.y1 = q.ly + 0.03; });
    return { pos: pos, gal: gal, stars: stars, named: withNames };
  }

  // the wall: one cell for each paper, the nearest to the middle first; the papers the data names sit there
  var PX = 0.95, PY = 1.2, SHEET_W = 0.773;
  var wall = (function () {
    var rows = Math.ceil(Math.sqrt(N / 2.25)); if (rows % 2 === 0) rows++;
    var cols = Math.ceil(N / rows); if (cols % 2 === 0) cols++;
    var cells = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) { var dx = c - (cols - 1) / 2, dy = r - (rows - 1) / 2; cells.push({ dx: dx, dy: dy, d: Math.hypot(dx * PX, dy * PY) }); }
    cells.sort(function (a, b) { return a.d - b.d || a.dy - b.dy || a.dx - b.dx; });
    cells.length = N;
    var heroOf = new Int16Array(N).fill(-1), order = [], taken = {};
    HEROES.forEach(function (h, j) { var k = OFF[h.g] + h.i; if (k >= 0 && k < N && !taken[k]) { taken[k] = 1; heroOf[k] = j; order.push(k); } });
    var rest = []; for (var k = 0; k < N; k++) if (!taken[k]) rest.push(k);
    var R = rng(77); for (var i = rest.length - 1; i > 0; i--) { var j2 = Math.floor(R() * (i + 1)), t = rest[i]; rest[i] = rest[j2]; rest[j2] = t; }
    order = order.concat(rest);
    var cellOf = new Array(N), maxD = cells[N - 1].d || 1;
    order.forEach(function (k, ci) { cellOf[k] = cells[ci]; });
    return { rows: rows, cols: cols, cellOf: cellOf, heroOf: heroOf, maxD: maxD, w: cols * PX, h: rows * PY };
  })();

  // ---------------------------------------------------------------- the world, as a point cloud
  // A small town of the Sensing World's everyday spaces on a round ground, each surface sampled in scan rows as
  // a laser scanner leaves them: homes, offices, a school, a hospital, a transit hall and its train, a factory,
  // a store, a warehouse, a farm, a park and its lake, roads with their lights and cars, a mast at the crossing.
  function buildWorld(count) {
    var R = rng(20261117), P = [];
    var fx = 0, fz = 0, fc = 1, fs = 0;
    function at(x, z, rot) { fx = x; fz = z; fc = Math.cos(rot || 0); fs = Math.sin(rot || 0); }
    function put(x, y, z) { P.push(fx + x * fc - z * fs, y, fz + x * fs + z * fc); }
    function line(a, b, den) {
      var d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.round(d * den));
      for (var k = 0; k <= n; k++) { var f = k / n; put(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f); }
    }
    function face(o, u, v, den, rows) {
      var lu = Math.hypot(u[0], u[1], u[2]), lv = Math.hypot(v[0], v[1], v[2]);
      var nr = Math.max(1, Math.round(lv * (rows || 4.5))), n = Math.max(2, Math.round(lu * (den || 9)));
      for (var r = 0; r <= nr; r++) { var fv = r / nr; for (var k = 0; k < n; k++) { var fu = (k + R()) / n; put(o[0] + u[0] * fu + v[0] * fv, o[1] + u[1] * fu + v[1] * fv, o[2] + u[2] * fu + v[2] * fv); } }
    }
    function walls(w, d, h, y0, den) {
      y0 = y0 || 0; var x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
      face([x0, y0, z1], [w, 0, 0], [0, h, 0], den); face([x0, y0, z0], [w, 0, 0], [0, h, 0], den);
      face([x0, y0, z0], [0, 0, d], [0, h, 0], den); face([x1, y0, z0], [0, 0, d], [0, h, 0], den);
    }
    function edges(w, d, y0, y1) {
      var c = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
      for (var i = 0; i < 4; i++) { var a = c[i], b = c[(i + 1) % 4]; line([a[0], y0, a[1]], [a[0], y1, a[1]], 16); line([a[0], y1, a[1]], [b[0], y1, b[1]], 16); }
    }
    function box(w, d, h, y0, den) { y0 = y0 || 0; walls(w, d, h, y0, den); face([-w / 2, y0 + h, -d / 2], [w, 0, 0], [0, 0, d], (den || 9) * 0.7, 3.4); edges(w, d, y0, y0 + h); }
    function gable(w, d, h, rh, den) {
      walls(w, d, h, 0, den); edges(w, d, 0, h);
      face([-w / 2, h, -d / 2], [w, 0, 0], [0, rh, d / 2], den, 4.5); face([-w / 2, h, d / 2], [w, 0, 0], [0, rh, -d / 2], den, 4.5);
      [-w / 2, w / 2].forEach(function (x) {
        var n = Math.max(2, Math.round(rh * 4.5));
        for (var k = 0; k < n; k++) { var f = k / n; line([x, h + rh * f, (-d / 2) * (1 - f)], [x, h + rh * f, (d / 2) * (1 - f)], 9); }
        line([x, h, -d / 2], [x, h + rh, 0], 16); line([x, h, d / 2], [x, h + rh, 0], 16);
      });
      line([-w / 2, h + rh, 0], [w / 2, h + rh, 0], 16);
    }
    function circle(r, y, den, x, z) { var n = Math.max(6, Math.round(TAU * r * den)), ph = R() * TAU; for (var k = 0; k < n; k++) { var a = ph + (TAU * k) / n; put((x || 0) + r * Math.cos(a), y, (z || 0) + r * Math.sin(a)); } }
    function cyl(r, h, y0, den, rows) { var nr = Math.max(1, Math.round(h * (rows || 4.5))); for (var k = 0; k <= nr; k++) circle(r, (y0 || 0) + (h * k) / nr, den || 9); }
    function dome(r, y0, den) { for (var k = 0; k <= 5; k++) { var a = ((k / 6) * Math.PI) / 2; circle(r * Math.cos(a), y0 + r * Math.sin(a), den || 9); } put(0, y0 + r, 0); }
    function vault(w, r, y0, den) {
      var n = Math.max(6, Math.round(Math.PI * r * 4.5));
      for (var k = 0; k <= n; k++) { var a = (Math.PI * k) / n; line([-w / 2, y0 + r * Math.sin(a), r * Math.cos(a)], [w / 2, y0 + r * Math.sin(a), r * Math.cos(a)], den || 9); }
      [-w / 2, w / 2].forEach(function (x) {
        for (var j = 1; j <= 3; j++) { var rr = (r * j) / 3, m = Math.max(3, Math.round(Math.PI * rr * 10)); for (var q = 0; q <= m; q++) { var a2 = (Math.PI * q) / m; put(x, y0 + rr * Math.sin(a2), rr * Math.cos(a2)); } }
      });
    }
    function tree(s) {
      line([0, 0, 0], [0, s * 0.7, 0], 14);
      var n = Math.round(110 * s * s);
      for (var k = 0; k < n; k++) { var u = R() * 2 - 1, a = R() * TAU, q = Math.sqrt(1 - u * u), rr = s * 0.55 * (0.82 + 0.25 * R()); put(rr * q * Math.cos(a), s * 1.05 + rr * u * 0.9, rr * q * Math.sin(a)); }
    }
    function pine(s) { line([0, 0, 0], [0, s * 0.4, 0], 14); for (var k = 0; k < 7; k++) { var f = k / 7; circle(s * 0.42 * (1 - f) + 0.03, s * (0.4 + 1.1 * f), 11); } put(0, s * 1.52, 0); }
    function car() {
      box(1.7, 0.74, 0.4, 0.18, 12); at2(-0.1, 0); box(0.95, 0.68, 0.34, 0.58, 12); at2(0.1, 0);
      [[-0.55, 0.39], [0.55, 0.39], [-0.55, -0.39], [0.55, -0.39]].forEach(function (q) { for (var k = 0; k < 10; k++) { var a = (TAU * k) / 10; put(q[0] + 0.18 * Math.cos(a), 0.18 + 0.18 * Math.sin(a), q[1]); } });
    }
    function at2(dx, dz) { fx += dx * fc - dz * fs; fz += dx * fs + dz * fc; } // the frame moved in its own directions
    function light() { line([0, 0, 0], [0, 2.2, 0], 12); line([0, 2.2, 0], [0.55, 2.32, 0], 12); for (var k = 0; k < 6; k++) put(0.55 + 0.08 * (R() - 0.5), 2.3 + 0.05 * R(), 0.08 * (R() - 0.5)); }
    function person() { var h = 0.4 + 0.06 * R(); line([0, 0, 0], [0, h, 0], 16); circle(0.05, h + 0.06, 40); }

    // the ground: rings, the rim, two roads crossing and one round the edge
    at(0, 0, 0);
    for (var gr = 0.5; gr < 9.99; gr += 0.5) circle(gr, 0, 3.0);
    circle(10, 0, 12); circle(10.12, 0, 12);
    circle(9.3, 0.01, 5); circle(9.9, 0.01, 5);
    [-0.5, 0.5].forEach(function (o) { line([-9.3, 0.01, o], [9.3, 0.01, o], 7); line([o, 0.01, -9.3], [o, 0.01, 9.3], 7); });
    for (var dsh = -9; dsh < 9; dsh += 0.9) { line([dsh, 0.01, 0], [dsh + 0.4, 0.01, 0], 10); line([0, 0.01, dsh], [0, 0.01, dsh + 0.4], 10); }

    // offices
    at(-3.4, -3.6, 0); box(2.0, 2.0, 6.2);
    at(-5.9, -3.0, 0.15); box(1.8, 2.2, 3.9);
    at(-2.5, -6.4, 0); box(1.6, 1.6, 4.6);
    // a school, its flag
    at(-5.7, -6.1, 0.55); box(2.8, 1.4, 1.5); at2(1.9, 0.9); line([0, 0, 0], [0, 2.6, 0], 12); face([0, 2.2, 0], [0.5, 0, 0], [0, 0.34, 0], 12, 12);
    // a hospital, a cross on its front, a wing
    at(3.6, -3.4, 0); box(3.2, 2.2, 2.8);
    [1.9, 2.0, 2.1].forEach(function (y) { line([-0.42, y, 1.12], [0.42, y, 1.12], 22); });
    [-0.05, 0.05].forEach(function (x) { line([x, 1.58, 1.12], [x, 2.42, 1.12], 22); });
    at(5.9, -3.9, 0); box(1.4, 1.6, 1.9);
    // a transit hall under a vault, a train beside it
    at(3.3, -6.9, 0.08); walls(3.8, 2.0, 1.0, 0, 9); vault(3.8, 1.0, 1.0, 9);
    at(6.5, -6.2, -0.75); box(2.6, 0.8, 0.9, 0.15, 12); line([-2.2, 0.03, -0.3], [2.2, 0.03, -0.3], 10); line([-2.2, 0.03, 0.3], [2.2, 0.03, 0.3], 10);
    // a factory: a saw-tooth roof, two chimneys
    at(6.0, 2.9, 0); walls(3.0, 2.2, 1.6, 0, 9); edges(3.0, 2.2, 0, 1.6);
    for (var tooth = 0; tooth < 3; tooth++) { var tx = -1.5 + tooth; face([tx, 1.6, -1.1], [0, 0, 2.2], [1.0, 0.7, 0], 9, 4.5); face([tx + 1.0, 1.6, -1.1], [0, 0, 2.2], [0, 0.7, 0], 9, 4.5); }
    at(7.1, 4.4, 0); cyl(0.26, 4.0, 0, 10, 4.5); at(6.3, 4.4, 0); cyl(0.22, 3.2, 0, 10, 4.5);
    // a store, its awning
    at(2.7, 2.9, 0); box(2.4, 2.0, 1.3); face([-1.2, 1.0, 1.0], [2.4, 0, 0], [0, -0.25, 0.5], 12, 8);
    // a warehouse
    at(2.9, 6.2, 0); gable(3.0, 1.8, 1.5, 0.45);
    [-0.9, 0, 0.9].forEach(function (x) { line([x - 0.3, 0, 0.92], [x - 0.3, 0.9, 0.92], 14); line([x + 0.3, 0, 0.92], [x + 0.3, 0.9, 0.92], 14); line([x - 0.3, 0.9, 0.92], [x + 0.3, 0.9, 0.92], 14); });
    // homes
    at(-3.1, 3.0, 0); gable(2.6, 2.0, 1.4, 1.0); at2(0.7, -0.4); box(0.3, 0.3, 1.0, 1.7, 14);
    at(-5.9, 2.8, -0.3); gable(2.0, 1.8, 1.3, 0.9);
    // a farm: a barn, a silo, rows of crops
    at(-5.9, 5.9, 0.4); gable(2.4, 1.7, 1.6, 1.1);
    at(-4.1, 7.3, 0); cyl(0.55, 2.6, 0, 10, 4.5); dome(0.55, 2.6, 10);
    at(0, 0, 0);
    for (var cr = 0; cr < 8; cr++) { var cx = -3.3 + cr * 0.3; for (var cz = 4.7; cz < 7.5; cz += 0.11) put(cx + 0.03 * (R() - 0.5), 0.26 * R(), cz); }
    // a park and its lake
    at(5.6, 5.7, 0); for (var lr = 0.15; lr < 0.95; lr += 0.13) circle(lr, 0.02, 9); circle(0.95, 0.02, 16);
    [[6.9, 4.9, 1.0], [6.6, 6.7, 0.9], [4.9, 7.2, 1.1], [4.6, 4.7, 0.8], [-1.7, 2.1, 1.0], [-4.6, 4.4, 1.2], [-7.4, 4.3, 0.9], [-7.7, 1.9, 1.1], [-7.4, -4.7, 1.0], [-4.3, -7.7, 0.9], [1.9, -1.9, 1.0], [7.0, -1.8, 1.1], [7.8, -4.4, 0.9], [-1.7, -1.9, 0.9], [-7.8, -1.6, 1.0], [1.6, 4.6, 0.8]].forEach(function (q, i) { at(q[0], q[1], 0); if (i % 3 === 2) pine(q[2]); else tree(q[2]); });
    // the roads' lights, cars and a bus
    [-7.5, -5, -2.5, 2.5, 5, 7.5].forEach(function (v, i) { at(v, i % 2 ? 0.85 : -0.85, i % 2 ? -Math.PI / 2 : Math.PI / 2); light(); at(i % 2 ? -0.85 : 0.85, v, i % 2 ? 0 : Math.PI); light(); });
    at(2.3, 0.25, 0); car(); at(-4.6, -0.25, Math.PI); car(); at(-0.25, -5.3, Math.PI / 2); car(); at(0.25, 4.5, -Math.PI / 2); car();
    at(5.7, -0.26, 0); box(2.2, 0.6, 0.75, 0.14, 12);
    // a mast at the crossing: the pulse starts here
    at(1.05, 1.05, 0);
    [[1, 1], [1, -1], [-1, -1], [-1, 1]].forEach(function (q) { line([0.34 * q[0], 0, 0.34 * q[1]], [0.07 * q[0], 5.4, 0.07 * q[1]], 12); });
    for (var my = 0.7; my < 5.4; my += 0.7) { var mr = 0.34 - (0.27 * my) / 5.4; line([-mr, my, -mr], [mr, my, -mr], 14); line([mr, my, -mr], [mr, my, mr], 14); line([mr, my, mr], [-mr, my, mr], 14); line([-mr, my, mr], [-mr, my, -mr], 14); }
    line([0, 5.4, 0], [0, 6.3, 0], 14);
    [4.3, 4.8].forEach(function (y, i) { for (var k = 0; k < 14; k++) { var a = (TAU * k) / 14; put((i ? -0.28 : 0.28), y + 0.2 * Math.sin(a), 0.2 * Math.cos(a)); } });
    // people
    var PR = rng(5);
    for (var pe = 0; pe < 18; pe++) { var pa = PR() * TAU, pr = 1.4 + PR() * 7; at(pr * Math.cos(pa), pr * Math.sin(pa), 0); person(); }

    // exactly `count` points: the surplus dropped, a shortfall filled with points a hair off others
    var n0 = P.length / 3, out = new Float32Array(count * 3), idx = [];
    for (var i0 = 0; i0 < n0; i0++) idx.push(i0);
    for (var i1 = n0 - 1; i1 > 0; i1--) { var j1 = Math.floor(R() * (i1 + 1)), t1 = idx[i1]; idx[i1] = idx[j1]; idx[j1] = t1; }
    for (var o = 0; o < count; o++) {
      var s = idx[o % n0] * 3, jit = o < n0 ? 0 : 0.035;
      out[o * 3] = P[s] + jit * (R() - 0.5) * 2; out[o * 3 + 1] = Math.max(0, P[s + 1] + jit * (R() - 0.5) * 2); out[o * 3 + 2] = P[s + 2] + jit * (R() - 0.5) * 2;
    }
    return out;
  }

  // ---------------------------------------------------------------- the particles
  // One paper is CH particles: the first is its star, the rest its dust. Each holds its place in the universe, on
  // the wall and in the world.
  var CH = 30, M = N * CH, STRIDE = 19;
  var buf = new Float32Array(M * STRIDE);
  var starsNow = null, portraitNow = null;
  function fillParticles() {
    var world = buildWorld(M), R = rng(9);
    // which world point a particle goes to: both lists in order of x (with some noise), so the cloud flows over
    // rather than crossing the whole screen
    var wi = [], pi = [];
    for (var a = 0; a < M; a++) { wi.push([world[a * 3] + (R() - 0.5) * 5, a]); }
    var sp = layoutStars(false).pos;
    for (var b = 0; b < M; b++) { pi.push([sp[(b % N) * 2] * 10 + (R() - 0.5) * 5, b]); }
    var by0 = function (x, y) { return x[0] - y[0]; };
    wi.sort(by0); pi.sort(by0);
    var toWorld = new Int32Array(M);
    for (var c = 0; c < M; c++) toWorld[pi[c][1]] = wi[c][1];
    for (var m = 0; m < M; m++) {
      var k = m % N, ch = Math.floor(m / N), o = m * STRIDE, cell = wall.cellOf[k], hero = wall.heroOf[k];
      var g = 0; while (g < 6 && k >= OFF[g] + COUNTS[g]) g++;
      var h1 = R(), h2 = R(), h3 = R(), h4 = R(), near = cell.d < 1.6;
      // 0 star (written by writeStars) · 2 wall · 5 world · 8 four numbers · 12 kind, child, when it flies, star size · 16 named sheet, ring, tilt
      buf[o + 2] = cell.dx * PX + (near ? 0 : (HH[k] - 0.5) * 0.08); buf[o + 3] = -cell.dy * PY + (near ? 0 : (HZ[k] - 0.5) * 0.08); buf[o + 4] = near ? 0 : -6 * HZ[k];
      var w = toWorld[m] * 3; buf[o + 5] = world[w]; buf[o + 6] = world[w + 1]; buf[o + 7] = world[w + 2];
      buf[o + 8] = h1; buf[o + 9] = h2; buf[o + 10] = ch ? h3 : HH[k]; buf[o + 11] = h4;
      buf[o + 12] = g; buf[o + 13] = ch; buf[o + 14] = (0.5 * cell.d) / wall.maxD + 0.08 * HH[k]; buf[o + 15] = 4.2 + 6.5 * HZ[k];
      buf[o + 16] = hero; buf[o + 17] = cell.d; buf[o + 18] = cell.d < 0.01 ? 0 : cell.d < 1 ? 0.06 * Math.sign(cell.dx) : (HH[k] - 0.5) * 0.05;
    }
  }
  function writeStars(portrait) {
    starsNow = layoutStars(portrait); portraitNow = portrait;
    for (var m = 0; m < M; m++) { var k = m % N, o = m * STRIDE; buf[o] = starsNow.pos[k * 2]; buf[o + 1] = starsNow.pos[k * 2 + 1]; }
  }

  // ---------------------------------------------------------------- the named papers' first pages, drawn once
  // A sheet in the look of a conference paper: where it appeared, its title, its authors, then two columns of
  // lines standing for its text (no words of the paper beyond its title page's) and a figure in its kind's colour.
  var SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", Times, serif';
  function wrapText(g, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (cur && g.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  function fitText(g, text, maxW) { var s = String(text); if (g.measureText(s).width <= maxW) return s; while (s.length > 1 && g.measureText(s + "…").width > maxW) s = s.slice(0, -1); return s.replace(/[\s,;]+$/, "") + "…"; }
  function drawSheet(g, x0, y0, w, h, hero, seed) {
    var u = w / 1000, R = rng(seed), tint = MOD_SHEET[MODS[hero.g]] || "#7d8799", cx = x0 + w / 2;
    g.fillStyle = "#f8f8f4"; g.fillRect(x0, y0, w, h);
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillStyle = "#70747c"; g.font = "500 " + 17 * u + "px " + SANS; g.fillText(hero.venue || "", cx, y0 + 0.064 * h);
    var ts = 47, lines;
    do { g.font = "700 " + ts * u + "px " + SANS; lines = wrapText(g, hero.title, 820 * u); ts -= 4; } while (lines.length > 3 && ts > 26);
    ts += 4; var y = y0 + 0.064 * h + (ts + 26) * u;
    g.fillStyle = "#16181c";
    lines.forEach(function (ln) { g.fillText(ln, cx, y); y += ts * 1.16 * u; });
    y += 14 * u;
    var au = hero.authors || [];
    if (au.length <= 6) {
      var per = Math.min(3, Math.max(1, au.length)), cw = 820 / per;
      au.forEach(function (a, i) {
        var col = i % per, row = Math.floor(i / per), nIn = Math.min(per, au.length - row * per);
        var ax = cx + (col - (nIn - 1) / 2) * cw * u, ay = y + row * 62 * u;
        g.fillStyle = "#1d2025"; g.font = "500 " + 21 * u + "px " + SERIF; g.fillText(fitText(g, a[0], (cw - 16) * u), ax, ay + 20 * u);
        g.fillStyle = "#6c7078"; g.font = "400 " + 15.5 * u + "px " + SERIF; g.fillText(fitText(g, a[1] || "", (cw - 16) * u), ax, ay + 42 * u);
      });
      y += Math.ceil(au.length / per) * 62 * u;
    } else {
      g.fillStyle = "#1d2025"; g.font = "500 " + 19.5 * u + "px " + SERIF;
      wrapText(g, au.map(function (a) { return a[0]; }).join(", "), 800 * u).slice(0, 3).forEach(function (ln) { g.fillText(ln, cx, y + 20 * u); y += 29 * u; });
      y += 8 * u;
    }
    // the two columns
    var top = Math.max(y + 34 * u, y0 + 0.262 * h), bottom = y0 + 0.932 * h, pitch = 0.0212 * h, th = 0.0093 * h;
    var cols = [[x0 + 90 * u, x0 + 470 * u], [x0 + 530 * u, x0 + 910 * u]];
    function head(c, yy, words) { g.textAlign = "left"; g.fillStyle = "#1d2025"; g.font = "700 " + 15 * u + "px " + SANS; g.fillText(words, cols[c][0], yy + pitch * 0.62); return yy + pitch * 1.25; }
    function bars(c, yy, to) {
      g.fillStyle = "#c9cbcf";
      while (yy + th < to) { var end = R() > 0.87; g.fillRect(cols[c][0], yy + pitch * 0.2, (cols[c][1] - cols[c][0]) * (end ? 0.3 + 0.5 * R() : 1), th); yy += pitch * (end ? 1.9 : 1); }
      return yy;
    }
    var yl = head(0, top, "ABSTRACT"); yl = bars(0, yl, top + (bottom - top) * 0.44); yl = head(0, yl + pitch * 0.6, "1   INTRODUCTION"); bars(0, yl, bottom);
    var fh = 0.17 * h, fx = cols[1][0], fw = cols[1][1] - cols[1][0];
    g.fillStyle = tint; g.globalAlpha = 0.1; g.fillRect(fx, top, fw, fh); g.globalAlpha = 0.55; g.strokeStyle = tint; g.lineWidth = 1.5 * u; g.strokeRect(fx, top, fw, fh);
    for (var c = 0; c < 3; c++) {
      g.globalAlpha = 0.9 - 0.25 * c; g.lineWidth = (3.2 - 0.7 * c) * u; g.beginPath();
      var f1 = 1.5 + 2.5 * R(), f2 = 4 + 5 * R(), ph = R() * TAU, amp = (0.3 - 0.07 * c) * fh;
      for (var s = 0; s <= 60; s++) { var q = s / 60, yy = top + fh * (0.5 + 0.08 * (c - 1)) + amp * (0.7 * Math.sin(TAU * f1 * q + ph) + 0.3 * Math.sin(TAU * f2 * q + ph * 2)) * (0.35 + 0.65 * Math.sin(Math.PI * q)); if (s) g.lineTo(fx + fw * (0.06 + 0.88 * q), yy); else g.moveTo(fx + fw * 0.06, yy); }
      g.stroke();
    }
    g.globalAlpha = 1; g.fillStyle = "#c9cbcf";
    g.fillRect(fx + fw * 0.18, top + fh + pitch * 0.7, fw * 0.64, th);
    bars(1, top + fh + pitch * 2.4, bottom);
  }
  function makeAtlas() {
    var n = Math.max(1, HEROES.length), cols = Math.min(4, n), rows = Math.ceil(n / cols);
    var max = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048, cw = 1024, chh = 1325;
    while (cw * cols > max || chh * rows > max) { cw = Math.round(cw / 2); chh = Math.round(chh / 2); }
    var cv = document.createElement("canvas"); cv.width = cw * cols; cv.height = chh * rows;
    var g = cv.getContext("2d");
    g.fillStyle = "#f8f8f4"; g.fillRect(0, 0, cv.width, cv.height);
    HEROES.forEach(function (hero, j) { drawSheet(g, (j % cols) * cw, Math.floor(j / cols) * chh, cw, chh, hero, 100 + j); });
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var an = gl.getExtension("EXT_texture_filter_anisotropic");
    if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1));
    return { tex: tex, cols: cols, rows: rows };
  }

  // ---------------------------------------------------------------- the shaders
  var HEAD = [
    "#version 300 es",
    "precision highp float;",
    "layout(location=0) in vec2 aStar;",
    "layout(location=1) in vec3 aPaper;",
    "layout(location=2) in vec3 aWorld;",
    "layout(location=3) in vec4 aRnd;",
    "layout(location=4) in vec4 aInfo;",
    "layout(location=5) in vec3 aExtra;",
    "uniform vec2 uRes; uniform float uDpr; uniform float uTime;",
    "uniform float uD; uniform float uF; uniform float uB; uniform float uS; uniform float uLag; uniform float uTrail;",
    "uniform float uFocal; uniform vec3 uCam; uniform vec2 uPaperC;",
    "uniform vec2 uUniC; uniform float uUniS; uniform float uStarK;",
    "uniform vec2 uWorldC; uniform float uWorldS; uniform float uYaw; uniform float uTilt; uniform float uDens;",
    "uniform vec3 uMod[7];",
    "const float FLY = " + FLY_DUR.toFixed(2) + ";",
    "float easeIO(float x){ return x < .5 ? 4.*x*x*x : 1. - pow(-2.*x + 2., 3.) / 2.; }",
    "vec4 clipOf(vec2 px, float z){ vec2 n = px / uRes * 2. - 1.; return vec4(n.x, -n.y, z, 1.); }",
    "vec2 wallPx(out float sc){ sc = uFocal / (uCam.z - aPaper.z); return uPaperC + vec2(aPaper.x - uCam.x, -(aPaper.y - uCam.y)) * sc; }",
    // from the wall to the universe along an arc, to one side or the other
    "vec2 flight(vec2 a, vec2 b, float e, float side){ vec2 d = b - a; return mix(a, b, e) + vec2(-d.y, d.x) * (.22 * side) * sin(3.14159265 * e); }",
  ].join("\n");

  var VS_PAPER = HEAD + "\n" + [
    "layout(location=6) in vec2 aCorner;",
    "out vec2 vUV; out float vA; out float vLit; out float vPx; out float vFog;",
    "flat out float vHero; flat out vec4 vRnd; flat out float vMod;",
    "void main(){",
    "  float ring = aExtra.y;",
    "  float reveal = ring < 1. ? 1. : smoothstep(0., 1., (uD - .05 - .0035 * ring) / .05);",
    "  float tf = clamp((uF - aInfo.z) / FLY, 0., 1.);",
    "  float e = easeIO(tf);",
    "  float sc; vec2 pp = wallPx(sc);",
    "  vec2 pu = uUniC + aStar * uUniS;",
    "  float side = aRnd.z < .5 ? -1. : 1.;",
    "  vec2 c = flight(pp, pu, e, side);",
    "  float hpx = sc * (1. - .99 * smoothstep(0., .55, tf));",
    "  float rot = aExtra.z - .5 * side * smoothstep(0., .55, tf);",
    "  float cr = cos(rot), sr = sin(rot);",
    "  vec2 o = aCorner * vec2(" + SHEET_W.toFixed(3) + ", 1.) * hpx;",
    "  o = vec2(o.x * cr - o.y * sr, o.x * sr + o.y * cr);",
    // (a sheet comes out of the dark: solid almost at once, so a nearer one hides a farther one, then lit)
    "  vA = smoothstep(0., .3, reveal) * (1. - smoothstep(.3, .58, tf)); vLit = mix(.16, 1., reveal);",
    "  vUV = aCorner + .5; vHero = aExtra.x; vPx = hpx * uDpr; vRnd = aRnd; vMod = aInfo.x;",
    "  vFog = clamp(-aPaper.z / 6., 0., 1.);",
    "  float z = clamp((uCam.z - aPaper.z) / 400., 0., 1.) * 2. - 1.;",
    "  gl_Position = vA > .002 ? clipOf(c + o, z) : vec4(2., 2., 2., 1.);",
    "}",
  ].join("\n");

  var FS_PAPER = [
    "#version 300 es",
    "precision highp float;",
    "in vec2 vUV; in float vA; in float vLit; in float vPx; in float vFog;",
    "flat in float vHero; flat in vec4 vRnd; flat in float vMod;",
    "uniform sampler2D uAtlas; uniform vec3 uTint[7]; uniform vec2 uGrid;",
    "out vec4 o;",
    "float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }",
    "float bx(vec2 uv, vec2 a, vec2 b, vec2 w){ vec2 s = smoothstep(a - w, a + w, uv) - smoothstep(b - w, b + w, uv); return s.x * s.y; }",
    "void main(){",
    // (the named sheet's picture and the widths are taken outside the branch: both need the neighbours' values)
    "  float hk = max(vHero, 0.);",
    "  vec2 cell = vec2(mod(hk, uGrid.x), floor(hk / uGrid.x + .001));",
    "  vec3 pic = texture(uAtlas, (cell + vUV) / uGrid).rgb;",
    // a sheet drawn here: title, authors, two columns of lines, a figure in its kind's colour
    "  vec2 uv = vUV; vec2 w = fwidth(uv) * .75 + 1e-4;",
    "  vec3 paper = vec3(.972, .972, .957), ink = vec3(.10, .11, .13), grey = vec3(.775, .78, .79);",
    "  vec3 tint = uTint[int(vMod + .5)];",
    "  vec3 col = paper;",
    "  float tw1 = .50 + .26 * vRnd.x, tw2 = .26 + .30 * vRnd.y;",
    "  float t = bx(uv, vec2(.5 - tw1 * .5, .082), vec2(.5 + tw1 * .5, .108), w) + bx(uv, vec2(.5 - tw2 * .5, .122), vec2(.5 + tw2 * .5, .148), w);",
    "  col = mix(col, ink, clamp(t, 0., 1.) * .9);",
    "  float au = 0.;",
    "  for (int i = 0; i < 3; i++) { float cx = .25 + .25 * float(i); au += bx(uv, vec2(cx - .065, .186), vec2(cx + .065, .197), w) + .55 * bx(uv, vec2(cx - .085, .207), vec2(cx + .085, .214), w); }",
    "  col = mix(col, vec3(.42, .43, .46), clamp(au, 0., 1.));",
    "  float y0 = .262, y1 = .932, pitch = .0212;",
    "  float cI = step(.5, uv.x); float x0 = mix(.09, .53, cI), x1 = mix(.47, .91, cI);",
    "  float inCol = step(x0, uv.x) * step(uv.x, x1) * step(y0, uv.y) * step(uv.y, y1);",
    "  float row = floor((uv.y - y0) / pitch), fy = fract((uv.y - y0) / pitch);",
    "  float hh = h21(vec2(row + vRnd.z * 91., cI + vRnd.w * 17.));",
    "  float len = hh > .86 ? .3 + .55 * fract(hh * 7.3) : 1.;",
    "  float blank = step(.93, h21(vec2(row * 1.7 + vRnd.x * 53., cI * 3.1 + 2.)));",
    "  float wy = w.y / pitch;",
    "  float ln = (smoothstep(.20 - wy, .20 + wy, fy) - smoothstep(.64 - wy, .64 + wy, fy)) * step(uv.x, x0 + (x1 - x0) * len) * (1. - blank);",
    "  float lod = clamp(vPx * pitch * .9 - .7, 0., 1.);",
    "  col = mix(col, grey, mix(.42, ln, lod) * inCol);",
    "  float fc = step(.5, vRnd.x); float fx0 = mix(.09, .53, fc), fx1 = mix(.47, .91, fc);",
    "  float fy0 = .30 + .36 * vRnd.y, fy1 = fy0 + .15 + .05 * vRnd.z;",
    "  float fig = bx(uv, vec2(fx0, fy0), vec2(fx1, fy1), w);",
    "  col = mix(col, mix(paper, tint, .34 + .34 * (uv.y - fy0) / (fy1 - fy0)), fig);",
    "  if (vHero > -.5) col = pic;",
    "  vec2 q = vUV - .5;",
    "  col *= (1. - .22 * dot(q, q)) * mix(1., .6, vFog);",
    "  o = vec4(col * vLit * vA, vA);",
    "}",
  ].join("\n");

  var VS_POINT = HEAD + "\n" + [
    "out vec3 vCol; out float vA;",
    "void main(){",
    "  float star = aInfo.y < .5 ? 1. : 0.;",
    "  float tf0 = clamp((uF - aInfo.z) / FLY, 0., 1.);",
    "  float tf = clamp((uF - uLag - aInfo.z) / FLY, 0., 1.);",
    "  float e = easeIO(tf);",
    "  float sc; vec2 pp = wallPx(sc);",
    // the dust round a star: thicker near it
    "  vec2 dv = (aRnd.xy - .5) * 2.; dv *= length(dv);",
    "  vec2 pu = uUniC + (aStar + (1. - star) * dv * .05) * uUniS;",
    "  float side = aRnd.z < .5 ? -1. : 1.;",
    "  vec2 pos = flight(pp, pu, e, side);",
    // to the world: each particle in its own time, the middle of the universe first
    "  float bd = aRnd.w * .28 + clamp(length(aStar), 0., 1.) * .17;",
    "  float tb = clamp((uB - bd) / .55, 0., 1.), eb = easeIO(tb);",
    "  float cy = cos(uYaw), sy = sin(uYaw);",
    "  vec3 q = vec3(aWorld.x * cy + aWorld.z * sy, aWorld.y, -aWorld.x * sy + aWorld.z * cy);",
    "  float ct = cos(uTilt), st = sin(uTilt);",
    "  float up = q.y * ct - q.z * st, dep = q.y * st + q.z * ct;",
    "  float persp = 1. / (1. - dep * .02);",
    "  vec2 pw = uWorldC + vec2(q.x, -up) * uWorldS * persp;",
    // at the end the stars leave the world again for the universe (now in its entrance)
    "  float back = star * easeIO(clamp((uS - aRnd.y * .35) / .65, 0., 1.));",
    "  float w = eb * (1. - back);",
    "  vec2 dir = normalize(dv + vec2(.0001, .0002));",
    "  pos = mix(pos, pw, w) + dir * uUniS * .06 * sin(3.14159265 * tb) * (1. - .5 * star) * (1. - back);",
    "  float tw = .55 + .45 * sin(uTime * 2.3 + aRnd.x * 6.2831853);",
    "  vec3 mc = uMod[int(aInfo.x + .5)];",
    "  float hgt = clamp(aWorld.y / 5., 0., 1.);",
    "  vec3 lidar = mix(vec3(.26, .44, 1.), vec3(.58, .84, 1.), smoothstep(0., .3, hgt));",
    "  lidar = mix(lidar, vec3(1., 1., 1.), smoothstep(.25, 1., hgt));",
    // the sensing pulse: a ring running out from the mast over the ground
    "  float ph = fract(uTime * .16);",
    "  float pr = (length(aWorld.xz - vec2(1.05, 1.05)) - ph * 13.) * 1.3;",
    "  float pulse = exp(-pr * pr) * (1. - ph) * eb;",
    "  float size; float a; vec3 col;",
    "  if (star > .5) {",
    "    float inflight = sin(3.14159265 * tf);",
    "    size = aInfo.w * (1. + 1.7 * inflight) * mix(1., .6 * min(1., sqrt(uDens)), w) * uStarK;",
    "    a = smoothstep(.1, .45, tf) * mix(tw, 1., max(inflight, w));",
    "    col = mix(mc, vec3(1.), .3 * inflight);",
    "    if (uLag > 0.) { a *= (tf > 0. && tf < 1.) ? uTrail : 0.; size *= .85; }",
    "    a *= 1. + .8 * pulse * w;",
    "  } else {",
    // (uDens: how large the world is drawn; a small one is denser, so its points are smaller and fainter)
    "    a = uLag > 0. ? 0. : smoothstep(.96, 1., tf0) * mix(.13, .78 * uDens, eb);",
    "    size = mix(1.8, (1.25 + 1.15 * persp) * clamp(sqrt(uDens), .55, 1.15), eb);",
    "    col = mix(mc, lidar, smoothstep(.1, .75, tb));",
    "    a *= 1. + 1.6 * pulse; size += 1.3 * pulse;",
    "  }",
    "  vCol = col; vA = a;",
    "  gl_PointSize = max(size * uDpr, 1.);",
    "  gl_Position = a > .003 ? clipOf(pos, 0.) : vec4(2., 2., 2., 1.);",
    "}",
  ].join("\n");

  var FS_POINT = [
    "#version 300 es",
    "precision highp float;",
    "in vec3 vCol; in float vA;",
    "out vec4 o;",
    "void main(){",
    "  vec2 c = gl_PointCoord * 2. - 1.; float r2 = dot(c, c);",
    "  if (r2 > 1.) discard;",
    "  float g = exp(-r2 * 4.2), core = exp(-r2 * 20.);",
    "  o = vec4((vCol * g + vec3(.5) * core) * vA, 1.);",
    "}",
  ].join("\n");

  function shader(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs, fs) {
    var p = gl.createProgram(); gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i), name = info.name.replace(/\[0\]$/, ""); u[name] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  }

  // ---------------------------------------------------------------- set up
  var progPaper, progPoint, vaoPaper, vaoPoint, vbo, atlas;
  var W = 1, H = 1, dpr = 1, heroBottom = 200, bandBottom = 200;
  var mediaUni = $("gate-uni").querySelector(".gate-media"), mediaWorld = $("gate-world").querySelector(".gate-media");
  var textUni = $("gate-uni").querySelector(".gate-text"), textWorld = $("gate-world").querySelector(".gate-text");
  var galLabels = [], heroLabels = [];

  function bindParticles(divisor) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    var off = 0;
    [[0, 2], [1, 3], [2, 3], [3, 4], [4, 4], [5, 3]].forEach(function (a) {
      gl.enableVertexAttribArray(a[0]); gl.vertexAttribPointer(a[0], a[1], gl.FLOAT, false, STRIDE * 4, off * 4); gl.vertexAttribDivisor(a[0], divisor); off += a[1];
    });
  }
  function setup() {
    progPaper = program(VS_PAPER, FS_PAPER); progPoint = program(VS_POINT, FS_POINT);
    fillParticles(); writeStars(false);
    vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.DYNAMIC_DRAW);
    vaoPoint = gl.createVertexArray(); gl.bindVertexArray(vaoPoint); bindParticles(0);
    vaoPaper = gl.createVertexArray(); gl.bindVertexArray(vaoPaper); bindParticles(1);
    var quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(6, 0);
    gl.bindVertexArray(null);
    atlas = makeAtlas();
    // the names drawn in the scene: each galaxy's, and the first three named papers' stars
    MODS.forEach(function (m, g) { var el = document.createElement("span"); el.className = "glabel"; el.textContent = m; el.style.color = MOD_NIGHT[m] || "#9ba8bb"; labels.appendChild(el); galLabels.push({ el: el, g: g }); });
    HEROES.slice(0, 3).forEach(function (h) { var el = document.createElement("span"); el.className = "hlabel"; el.textContent = h.name; labels.appendChild(el); heroLabels.push({ el: el, k: OFF[h.g] + h.i }); });
  }

  function measure() {
    var r = stage.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(2, window.devicePixelRatio || 1);
    var cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    heroBottom = capHero.offsetTop + capHero.offsetHeight;
    bandBottom = Math.max(capUni.offsetTop + capUni.offsetHeight, capWorld.offsetTop + capWorld.offsetHeight) + 14;
    var portrait = W < H * 0.9;
    if (portrait !== portraitNow) { writeStars(portrait); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf); }
  }

  // ---------------------------------------------------------------- each frame
  var p = 0, forced = false, forcedP = 0, forcedT = 0, last = 0, mx = 0, my = 0, mxT = 0, myT = 0;
  function scrollTarget() {
    var r = track.getBoundingClientRect(), navh = stage.getBoundingClientRect().top;
    var len = r.height - H - (parseFloat(getComputedStyle(track).paddingTop) || 0);
    return len > 0 ? clamp((navh - r.top - (parseFloat(getComputedStyle(track).paddingTop) || 0)) / len, 0, 1) : 0;
  }
  function show(el, a, rise) {
    var v = a > 0.01;
    if (el._v !== v) { el._v = v; el.style.visibility = v ? "visible" : "hidden"; }
    var key = Math.round(a * 500);
    if (el._a !== key) { el._a = key; el.style.opacity = a.toFixed(3); if (rise) el.style.transform = "translate3d(0," + ((1 - a) * rise).toFixed(1) + "px,0)"; }
  }
  function place(el, x, y, a) {
    var key = Math.round(x * 2) + "," + Math.round(y * 2) + "," + Math.round(a * 200);
    if (el._k === key) return; el._k = key;
    el.style.opacity = a.toFixed(3); el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var t = forced ? forcedT : now / 1000, dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (forced) p = forcedP; else { var pt = scrollTarget(); p += (pt - p) * (1 - Math.exp(-dt * 6.5)); if (Math.abs(pt - p) < 0.00002) p = pt; }
    mx += (mxT - mx) * (1 - Math.exp(-dt * 4)); my += (myT - my) * (1 - Math.exp(-dt * 4));
    API.p = p; API.frames++;

    var d = smooth(seg(p, T.dolly[0], T.dolly[1])), f = seg(p, T.fly[0], T.fly[1]), b = seg(p, T.burst[0], T.burst[1]), s = seg(p, T.split[0], T.split[1]), es = easeIO(s);

    // the papers' camera: from three sheets under the title to the whole wall
    var aspect = W / H, focal = H / 2 / Math.tan((20 * Math.PI) / 180);
    var D0 = Math.max(2.2, 0.98 / (0.728 * aspect)), D1 = Math.max(46, (wall.h * 1.06) / 0.728);
    var D = D0 * Math.pow(D1 / D0, d);
    var sc0 = focal / D0, cy0 = Math.max(0, (heroBottom + 30 + 0.52 * sc0 - H / 2) / sc0);
    var camY = cy0 * (1 - smooth(seg(d, 0, 0.4))) - my * 0.012 * D, camX = mx * 0.02 * D;

    // the universe: below the words' band; then in its entrance
    var S = starsNow, B = S.named, top = bandBottom, bot = H - 26, mid = (top + bot) / 2;
    var uniS0 = Math.min((W * 0.92) / (B.x1 - B.x0), (bot - top) / (B.y1 - B.y0));
    var uniC0 = [W / 2 - ((B.x0 + B.x1) / 2) * uniS0, mid - ((B.y0 + B.y1) / 2) * uniS0];
    var worldS0 = Math.min((W * 0.9) / 23, (bot - top) / 13.8), worldC0 = [W / 2, mid + 1.05 * worldS0];
    var uniS = uniS0, uniC = uniC0, worldS = worldS0, worldC = worldC0;
    if (s > 0) {
      var sr = stage.getBoundingClientRect(), ru = mediaUni.getBoundingClientRect(), rw = mediaWorld.getBoundingClientRect(), B2 = S.stars;
      var uniS1 = Math.min((ru.width * 0.9) / (B2.x1 - B2.x0), (ru.height * 0.84) / (B2.y1 - B2.y0));
      var uniC1 = [ru.left - sr.left + ru.width / 2 - ((B2.x0 + B2.x1) / 2) * uniS1, ru.top - sr.top + ru.height / 2 - ((B2.y0 + B2.y1) / 2) * uniS1];
      var worldS1 = Math.min((rw.width * 0.82) / 23, (rw.height * 0.8) / 13.8);
      var worldC1 = [rw.left - sr.left + rw.width / 2, rw.top - sr.top + rw.height / 2 + 1.05 * worldS1];
      uniS = mix(uniS0, uniS1, es); uniC = [mix(uniC0[0], uniC1[0], es), mix(uniC0[1], uniC1[1], es)];
      worldS = mix(worldS0, worldS1, es); worldC = [mix(worldC0[0], worldC1[0], es), mix(worldC0[1], worldC1[1], es)];
    }
    var starK = clamp(Math.sqrt(uniS / uniS0), 0.45, 1) * clamp(Math.sqrt(uniS0 / 700), 0.6, 1.15);

    // the words, each in its own time
    show(capHero, 1 - seg(p, 0.012, 0.05), -18);
    show(capUni, seg(f, 0.84, 1) * (1 - seg(b, 0, 0.12)), 18);
    show(capWorld, seg(b, 0.82, 1) * (1 - seg(s, 0, 0.25)), 18);
    // (the entrances' frames first; their words only once the scene has left the place where they stand)
    show(gates, seg(s, 0.45, 1), 0);
    var gt = smooth(seg(s, 0.72, 1)), tk = Math.round(gt * 250);
    if (textUni._t !== tk) {
      textUni._t = tk;
      [textUni, textWorld].forEach(function (el) { el.style.opacity = gt.toFixed(3); el.style.transform = "translate3d(0," + ((1 - gt) * 16).toFixed(1) + "px,0)"; });
    }
    var la = seg(f, 0.88, 1) * (1 - seg(b, 0, 0.1));
    galLabels.forEach(function (L) {
      var q = S.gal[L.g]; if (!q.n) return place(L.el, 0, 0, 0);
      place(L.el, uniC0[0] + q.x * uniS0 - L.el.offsetWidth / 2, uniC0[1] + q.ly * uniS0 - 6, la * 0.92);
    });
    heroLabels.forEach(function (L) { place(L.el, uniC0[0] + S.pos[L.k * 2] * uniS0 + 12, uniC0[1] + S.pos[L.k * 2 + 1] * uniS0 - 16, la); });

    // draw
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    function common(P) {
      var u = P.u; gl.useProgram(P.p);
      gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uDpr, dpr); gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uD, d); gl.uniform1f(u.uF, f); gl.uniform1f(u.uB, b); gl.uniform1f(u.uS, s);
      gl.uniform1f(u.uFocal, focal); gl.uniform3f(u.uCam, camX, camY, D); gl.uniform2f(u.uPaperC, W / 2, H / 2);
      gl.uniform2f(u.uUniC, uniC[0], uniC[1]); gl.uniform1f(u.uUniS, uniS); gl.uniform1f(u.uStarK, starK);
      gl.uniform2f(u.uWorldC, worldC[0], worldC[1]); gl.uniform1f(u.uWorldS, worldS); gl.uniform1f(u.uDens, clamp(worldS / 30, 0.3, 1.35));
      gl.uniform1f(u.uYaw, 0.6 + t * 0.045 + p * 1.4); gl.uniform1f(u.uTilt, 0.5);
      gl.uniform3fv(u.uMod, colNight);
      return u;
    }
    if (f < 1) {
      var up = common(progPaper);
      gl.uniform3fv(up.uTint, colSheet); gl.uniform2f(up.uGrid, atlas.cols, atlas.rows); gl.uniform1i(up.uAtlas, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlas.tex);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(vaoPaper); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, N);
    }
    if (f > 0) {
      var uq = common(progPoint);
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(vaoPoint);
      if (f < 1) for (var k = 4; k >= 1; k--) { gl.uniform1f(uq.uLag, k * 0.011); gl.uniform1f(uq.uTrail, 0.5 * (1 - k / 5)); gl.drawArrays(gl.POINTS, 0, N); }
      gl.uniform1f(uq.uLag, 0); gl.uniform1f(uq.uTrail, 1);
      gl.drawArrays(gl.POINTS, 0, M);
    }
    gl.bindVertexArray(null);
  }

  try {
    setup();
    root.classList.add("live");
    measure();
    window.addEventListener("resize", measure);
    if (window.ResizeObserver) new ResizeObserver(measure).observe(stage);
    window.addEventListener("pointermove", function (e) { if (e.pointerType === "touch") return; mxT = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1); myT = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1); }, { passive: true });
    API.live = true;
    API.freeze = function (pp, tt) { forced = true; forcedP = clamp(+pp || 0, 0, 1); forcedT = tt == null ? 10 : +tt; mx = my = mxT = myT = 0; return new Promise(function (res) { requestAnimationFrame(function () { requestAnimationFrame(function () { res({ p: p }); }); }); }); };
    API.unfreeze = function () { forced = false; };
    API.info = function () { return { papers: N, particles: M, wall: [wall.cols, wall.rows], W: W, H: H, dpr: dpr, heroBottom: heroBottom, bandBottom: bandBottom, renderer: gl.getParameter(gl.RENDERER) }; };
    requestAnimationFrame(function (now) { last = now; frame(now); API.ready = true; });
  } catch (err) {
    // the scene could not be made: the words and the entrances stay
    root.classList.remove("live");
    API.error = String((err && err.message) || err); API.ready = true;
    if (window.console) console.error("Sense2Sim landing:", err);
  }
})();
