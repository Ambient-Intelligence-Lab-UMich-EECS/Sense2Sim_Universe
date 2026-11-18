// The page's entrance (the user, 2026-11-18: an animation on the way in, the page entered once it has loaded and
// runs smoothly). A point cloud forms as the page really loads, in the look of the Sense2Sim landing page's last
// part: the Sensing World's small town of everyday spaces, or the Sensing Universe's galaxies of papers. When the
// page says it is ready, and its frames come evenly, the points fly past and the page is there.
//
// One classic script, loaded before anything else, no library, no picture, no network:
//   <script src="entrance.js" data-title="Sensing World" data-shape="world" data-hold data-night="#04070d" data-day="#f4f6fa"></script>
//   data-shape   world | universe
//   data-hold    the page calls S2S_ENTRANCE.ready() itself (else: ready at the window's load)
//   data-line    the words under the title until the page gives its own
// The page:  S2S_ENTRANCE.progress(0..1, "words")   how far it is; the cloud forms that far
//            S2S_ENTRANCE.ready()                   loaded; the entrance leaves once the frames come evenly
//            S2S_ENTRANCE.open, .entered (ms since the page's start, once it has left), event "s2s-entered" on window
// ?entrance=0 in the address: no entrance.
// The points are drawn in a worker on an OffscreenCanvas, so they keep moving while the page's own script parses
// models and compiles shaders; without one they are drawn on the page's thread. The entrance never keeps anybody
// out: it leaves by itself after CAP_MS, and at once if anything in it fails.
(function () {
  "use strict";
  if (window.S2S_ENTRANCE) return;
  // ?entrance=0: the page without it (a check's still pictures, a measurement of the page alone)
  if (/[?&]entrance=0(&|$)/.test(location.search)) { window.S2S_ENTRANCE = { open: false, entered: 0, progress: function () {}, ready: function () {} }; return; }
  var me = document.currentScript, ds = (me && me.dataset) || {};
  var SHAPE = ds.shape === "universe" ? "universe" : "world", HOLD = ds.hold != null;
  var NIGHT = ds.night || "#04070d", DAY = ds.day || "#f4f6fa";
  var MIN_MS = 1100;   // shown at least this long, so it never flashes
  var CAP_MS = 45000;  // and never longer than this
  var SETTLE_MS = 2000; // after ready: at most this long waiting for even frames
  var EVEN = 6, EVEN_MS = 45; // even: this many frames in a row, none longer than this
  var FORM_MS = 380, EXIT_MS = 520;

  // ---------------------------------------------------------------- the points (runs in the worker, or on the page)
  function engine(G) {
    var TAU = Math.PI * 2;
    var raf = G.requestAnimationFrame ? function (f) { G.requestAnimationFrame(f); } : function (f) { setTimeout(f, 16); };
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
    function easeIO(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
    function mix(a, b, f) { return a + (b - a) * f; }
    function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6d2b79f5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function rgb(c) { return "rgb(" + Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255) + ")"; }
    function hex(c) { return [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255]; }

    // the world, as a point cloud (the landing page's buildWorld): a small town of the Sensing World's everyday
    // spaces on a round ground, each surface sampled in scan rows as a laser scanner leaves them
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
      function at2(dx, dz) { fx += dx * fc - dz * fs; fz += dx * fs + dz * fc; } // the frame moved in its own directions
      function car() {
        box(1.7, 0.74, 0.4, 0.18, 12); at2(-0.1, 0); box(0.95, 0.68, 0.34, 0.58, 12); at2(0.1, 0);
        [[-0.55, 0.39], [0.55, 0.39], [-0.55, -0.39], [0.55, -0.39]].forEach(function (q) { for (var k = 0; k < 10; k++) { var a = (TAU * k) / 10; put(q[0] + 0.18 * Math.cos(a), 0.18 + 0.18 * Math.sin(a), q[1]); } });
      }
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

      // `count` points at most, in no order: a part of them, evenly, where there are more
      var n0 = P.length / 3, n = Math.min(count, n0), out = new Float32Array(n * 3), idx = [];
      for (var i0 = 0; i0 < n0; i0++) idx.push(i0);
      for (var i1 = n0 - 1; i1 > 0; i1--) { var j1 = Math.floor(R() * (i1 + 1)), t1 = idx[i1]; idx[i1] = idx[j1]; idx[j1] = t1; }
      for (var o = 0; o < n; o++) { var s = idx[o] * 3; out[o * 3] = P[s]; out[o * 3 + 1] = P[s + 1]; out[o * 3 + 2] = P[s + 2]; }
      return out;
    }

    // the universe: six galaxies round an ellipse and a small one in the middle, each a spiral, its heart first
    // (the landing page's layoutStars, lying flat; the sizes are a picture's, not the papers' counts)
    var GAL = [["#6b98ff", "#2c5fd6", 0.36], ["#d9f272", "#6a8a00", 0.2], ["#ff8a5b", "#d6501f", 0.16], ["#c7a2ff", "#7a4ccc", 0.1], ["#aab5c7", "#5a677d", 0.1], ["#f0c674", "#b07c08", 0.06], ["#9ba8bb", "#7d8799", 0.02]];
    function buildUniverse(count) {
      var R = rng(1443), out = new Float32Array(count * 3), gal = new Uint8Array(count), rad = new Float32Array(count), o = 0;
      for (var g = 0; g < 7; g++) {
        var n = g < 6 ? Math.round(count * GAL[g][2]) : count - o, a = -Math.PI / 2 + (g * TAU) / 6 + 0.32;
        var gx = g < 6 ? 7.4 * Math.cos(a) : 0, gz = g < 6 ? 7.4 * Math.sin(a) : 0, RR = g < 6 ? 5.4 * Math.sqrt(GAL[g][2]) + 0.9 : 0.7;
        for (var i = 0; i < n && o < count; i++, o++) {
          var r = RR * Math.sqrt((i + 0.5) / n) * (0.82 + 0.36 * R()), th = i * 2.39996 + r * 1.9;
          out[o * 3] = gx + r * Math.cos(th); out[o * 3 + 1] = 0.12 * (R() - 0.5) * (1.2 - r / RR); out[o * 3 + 2] = gz + r * Math.sin(th);
          gal[o] = g; rad[o] = r / RR;
        }
      }
      return { pos: out, gal: gal, rad: rad };
    }

    var cv = null, g = null, W = 0, H = 0, dpr = 1, band = 0, night = true, still = false, shape = "world";
    var n = 0, X, SX, DL, RN, DM, BK, cols = [], from = [], tilt = 0.5;
    var skip = 0, F = 0, Ft = 0, t0 = 0, last = 0, exitAt = -1, exitMs = 520, stopped = false, stride = 1, cost = 0, costN = 0;

    function colours() {
      cols = [];
      if (shape === "universe") { for (var q = 0; q < 7; q++) cols.push(night ? GAL[q][0] : GAL[q][1]); return; }
      // the scanner's colours by height (the landing page's): blue on the ground, pale above, white at the tops
      for (var b = 0; b < 8; b++) {
        var h = b / 7, c;
        if (night) { var lo = smooth(h / 0.3), hi = smooth((h - 0.25) / 0.75); c = [mix(mix(0.26, 0.58, lo), 1, hi), mix(mix(0.44, 0.84, lo), 1, hi), 1]; }
        else { var d = smooth(h); c = [mix(0.13, 0.05, d), mix(0.33, 0.1, d), mix(0.86, 0.3, d)]; }
        cols.push(rgb(c));
      }
    }
    function build() {
      var R = rng(7), pos, i, order = [], bk, gal = null, rad = null;
      if (shape === "universe") { var u = buildUniverse(2600); pos = u.pos; gal = u.gal; rad = u.rad; tilt = 0.42; }
      else { pos = buildWorld(9000); tilt = 0.5; }
      n = pos.length / 3;
      bk = new Uint8Array(n);
      for (i = 0; i < n; i++) { bk[i] = gal ? gal[i] : Math.round(clamp(pos[i * 3 + 1] / 5, 0, 1) * 7); order.push(i); }
      order.sort(function (a, b) { return bk[a] - bk[b] || a - b; }); // by colour, so a colour is set once a frame
      X = new Float32Array(n * 3); SX = new Float32Array(n * 3); DL = new Float32Array(n); RN = new Float32Array(n); DM = new Float32Array(n); BK = new Uint8Array(n);
      from = [];
      for (var k = 0; k < n; k++) {
        i = order[k];
        var x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        X[k * 3] = x; X[k * 3 + 1] = y; X[k * 3 + 2] = z; BK[k] = bk[i]; RN[k] = R();
        if (!k || BK[k] !== BK[k - 1]) from.push(k);
        // where it waits: dust far round the place, each grain at its own distance
        var u2 = R() * 2 - 1, a = R() * TAU, q = Math.sqrt(1 - u2 * u2), rr = 11 + 13 * R();
        SX[k * 3] = rr * q * Math.cos(a); SX[k * 3 + 1] = 3 + rr * u2 * 0.6; SX[k * 3 + 2] = rr * q * Math.sin(a);
        // when it comes: the world from its mast outwards; the universe a galaxy after another, each heart first
        if (gal) { DM[k] = 0; DL[k] = clamp(0.06 * gal[i] + 0.16 * rad[i] + 0.1 * R(), 0, 0.6); }
        else { DM[k] = Math.hypot(x - 1.05, z - 1.05); DL[k] = clamp(0.44 * (DM[k] / 11) + 0.16 * R(), 0, 0.6); }
      }
      from.push(n);
      colours();
    }

    function draw(t) {
      var age = (t - t0) / 1000, k, b;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      g.clearRect(0, 0, W, H);
      if (!n || W < 2 || H < 2) return;
      g.globalCompositeOperation = night ? "lighter" : "source-over";
      var ex = exitAt < 0 ? 0 : clamp((t - exitAt) / exitMs, 0, 1), zoom = 1 + 1.5 * ex * ex, fade = 1 - smooth(ex);
      var room = Math.max(40, H - band), uni = shape === "universe";
      var s = (uni ? Math.min((W * 0.88) / 23.5, (room * 0.8) / 10.2) : Math.min((W * 0.9) / 23, (room * 0.86) / 13.8));
      var dens = clamp(s / 30, 0.45, 1.25), cx = W / 2, cy = band + room / 2 + (uni ? 0 : 1.05 * s);
      s *= zoom; cy = H / 2 + (cy - H / 2) * zoom; // (leaving: the cloud grows from the middle of the screen)
      var yaw = 0.6 + (still ? 0 : age * (uni ? 0.05 : 0.11)), cyw = Math.cos(yaw), syw = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
      var ph = (age * 0.16) % 1, lift = still ? 1 : Math.sqrt(stride), ga = -1;
      for (b = 0; b + 1 < from.length; b++) {
        g.fillStyle = cols[BK[from[b]]];
        for (k = from[b]; k < from[b + 1]; k += stride) {
          var a = easeIO(clamp((F - DL[k]) / 0.4, 0, 1)), o = k * 3, r = RN[k];
          var x = X[o], y = X[o + 1], z = X[o + 2];
          if (a < 1) {
            var w = still ? 0 : age * 0.25 + r * TAU, sx = SX[o] + 0.7 * Math.sin(w), sy = SX[o + 1] + 0.5 * Math.cos(w * 1.3), sz = SX[o + 2] + 0.7 * Math.cos(w);
            x = sx + (x - sx) * a; y = sy + (y - sy) * a; z = sz + (z - sz) * a;
          }
          var qx = x * cyw + z * syw, qz = -x * syw + z * cyw, up = y * ct - qz * st, dep = y * st + qz * ct, pd = 1 - dep * 0.02;
          if (pd < 0.3) continue;
          var p = 1 / pd, px = cx + qx * s * p, py = cy - up * s * p;
          if (px < -4 || px > W + 4 || py < -4 || py > H + 4) continue;
          var al, size;
          if (uni) {
            var tw = still ? 1 : 0.6 + 0.4 * Math.sin(age * 2.3 + r * TAU);
            al = mix(0.2, 0.95 * tw, a); size = mix(1.3, 1.5 + 1.9 * r * r, a) * (0.7 + 0.3 * dens) * p;
          } else {
            var pr = (DM[k] - ph * 13) * 1.3, pulse = still ? 0 : Math.exp(-pr * pr) * (1 - ph) * a;
            al = mix(0.15, 0.78 * dens, a) * (1 + 1.6 * pulse); size = mix(1.5, (1.05 + 1.0 * p) * clamp(Math.sqrt(dens), 0.6, 1.15), a) + 1.2 * pulse;
          }
          al = clamp(al * fade * lift * (night ? 1 : 0.9), 0, 1);
          if (al < 0.02) continue;
          if (Math.abs(al - ga) > 0.03) { ga = al; g.globalAlpha = al; }
          g.fillRect(px - size / 2, py - size / 2, size, size);
        }
      }
    }
    function frame() {
      if (stopped) return;
      raf(frame);
      var t = performance.now(), dt = Math.min(0.1, (t - last) / 1000); last = t;
      // with no word from the page yet, the cloud starts to gather by itself, a part of the way: the World's town
      // shows its first shapes within about 2 s on a slow line (run 21: at 10 Mbit/s only faint dust for 5 s, its
      // first models came late; run 22, to 0.32 over 1.6 s: still dust at 2 s, as a point forms only once the cloud
      // is past its own delay, up to 0.6), the Universe's galaxies within about 1 s (run 21: in the last 0.5 s)
      var creep = (shape === "universe" ? 0.85 : 0.55) * (1 - Math.exp(-(t - t0) / 1000 / (shape === "universe" ? 0.7 : 1.0)));
      var to = Ft >= 1 ? 1 : Math.max(Ft, creep);
      F = still ? to : F + (to - F) * (1 - Math.exp(-dt * (Ft >= 1 ? 9 : 3.6)));
      if (!g) return;
      // while the page loads, the points are drawn every third frame (20 a second on a 60 Hz screen; the cloud turns
      // slowly): each drawn frame takes processor time from the page's own loading. On a software GPU the World was
      // ready 9.9 % later drawn at every frame, 7.0 % at every second, 4.1 % at every third (run 21 tune 3, 5 runs
      // each, unthrottled; 2.5 / 3.7 / 1.0 % at 10 Mbit/s). The exit, when the page is ready, is drawn at every frame.
      if (exitAt < 0 && (skip = (skip + 1) % 3)) return;
      try { draw(t); } catch (e) { stopped = true; return; }
      // a slow machine draws fewer points, each a little brighter
      cost += performance.now() - t; costN += 1;
      if (costN >= 30) { if (cost / costN > 9 && stride < 4) stride += 1; cost = 0; costN = 0; }
    }
    function size(m) {
      W = m.w; H = m.h; dpr = m.dpr; band = m.band || 0;
      if (cv) { cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr)); }
    }
    G.onmessage = function (e) {
      var m = e.data || {};
      if (m.type === "init") {
        cv = m.canvas; shape = m.shape; night = m.night; still = m.still; size(m);
        // drawn on the CPU (willReadFrequently: a canvas the browser keeps in memory, not on the GPU): one picture a
        // frame goes to the screen, not thousands of drawing commands for the GPU process, which the page's own WebGL
        // (its models' shaders and textures) waits on. On a software GPU (llvmpipe, SwiftShader: a machine with no
        // usable graphics card) those commands, 60 times a second, held the Sensing World's loading back until the
        // entrance left at its 45 s cap (run 21 check B, 2026-11-18: ready 5.2 s without the entrance, 49 s with it)
        g = cv.getContext("2d", { willReadFrequently: true });
        build();
        t0 = last = performance.now();
        raf(frame);
      } else if (m.type === "size") size(m);
      else if (m.type === "progress") Ft = Math.max(Ft, clamp(m.f, 0, 1));
      else if (m.type === "theme") { night = m.night; colours(); }
      else if (m.type === "exit") { exitMs = m.ms || 520; exitAt = performance.now(); Ft = 1; }
      else if (m.type === "stop") stopped = true;
    };
  }

  // ---------------------------------------------------------------- the page's side
  var root = document.documentElement, T0 = performance.now();
  var api = { open: true, entered: 0, progress: function () {}, ready: function () {} };
  window.S2S_ENTRANCE = api;
  var el = null, capEl = null, lineEl = null, worker = null, post = function () {}, left = false, readyAt = 0, loaded = document.readyState === "complete";
  var isNight = function () { return root.dataset.theme !== "light"; };

  function leave(now) {
    if (left) return;
    left = true;
    var done = function () {
      try { post({ type: "stop" }); if (worker) worker.terminate(); } catch (e) { /* gone already */ }
      if (el && el.parentNode) el.parentNode.removeChild(el);
      api.open = false; api.entered = performance.now();
      try { window.dispatchEvent(new Event("s2s-entered")); } catch (e) { /* an old browser */ }
    };
    if (now || !el) { done(); return; }
    post({ type: "exit", ms: EXIT_MS });
    el.style.pointerEvents = "none";
    el.style.opacity = "0";
    setTimeout(done, EXIT_MS + 40);
  }
  // after ready: the cloud closes, then the entrance waits for even frames (the page's own first frames upload its
  // pictures and can stall), then leaves
  function settle() {
    post({ type: "progress", f: 1 });
    var t1 = performance.now(), lastT = 0, run = 0, gone = false;
    var go = function () { if (gone) return; gone = true; setTimeout(function () { leave(false); }, Math.max(0, FORM_MS - (performance.now() - t1), MIN_MS - (performance.now() - T0))); };
    var tick = function (t) {
      if (gone) return;
      if (lastT) run = t - lastT <= EVEN_MS ? run + 1 : 0;
      lastT = t;
      if (run >= EVEN) go(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(go, SETTLE_MS); // (also when the tab is hidden and no frame comes)
  }
  function maybeReady() {
    if (readyAt || left) return;
    if (HOLD ? !api._ready : !loaded) return;
    readyAt = performance.now();
    settle();
  }
  api.ready = function () { api._ready = true; maybeReady(); };
  api.progress = function (f, words) {
    if (left) return;
    if (typeof f === "number") post({ type: "progress", f: Math.min(0.94, f) });
    if (words != null && lineEl && lineEl.textContent !== words) lineEl.textContent = words;
  };

  try {
    var style = document.createElement("style");
    style.textContent =
      "#s2s-entrance{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:var(--s2s-bg);opacity:1;transition:opacity " + EXIT_MS + "ms cubic-bezier(.4,0,.2,1);contain:strict}" +
      "#s2s-entrance canvas{position:absolute;inset:0;width:100%;height:100%;display:block}" +
      "#s2s-entrance .s2s-cap{position:absolute;left:16px;right:16px;top:max(7vh,28px);text-align:center;pointer-events:none;font-family:Inter,\"IBM Plex Sans\",system-ui,-apple-system,\"Segoe UI\",\"Helvetica Neue\",Arial,sans-serif}" +
      "#s2s-entrance .s2s-title{margin:0;font-weight:700;font-size:clamp(30px,min(5vw,8vh),64px);line-height:1.1;letter-spacing:-.02em;color:var(--s2s-ink)}" +
      "#s2s-entrance .s2s-line{margin-top:12px;min-height:1.3em;font:500 13px/1.3 \"JetBrains Mono\",\"IBM Plex Mono\",ui-monospace,Menlo,Consolas,monospace;color:var(--s2s-muted)}" +
      "@media (prefers-reduced-motion:reduce){#s2s-entrance{transition-duration:200ms}}";
    el = document.createElement("div");
    el.id = "s2s-entrance";
    el.setAttribute("role", "status");
    var paint = function () {
      var nt = isNight();
      el.style.setProperty("--s2s-bg", nt ? NIGHT : DAY);
      el.style.setProperty("--s2s-ink", nt ? "#eef1f6" : "#14161a");
      el.style.setProperty("--s2s-muted", nt ? "#8a93a6" : "#6a7180");
      return nt;
    };
    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    capEl = document.createElement("div"); capEl.className = "s2s-cap";
    var h = document.createElement("div"); h.className = "s2s-title"; h.textContent = ds.title || document.title || "";
    lineEl = document.createElement("div"); lineEl.className = "s2s-line"; lineEl.textContent = ds.line || "Loading";
    capEl.appendChild(h); capEl.appendChild(lineEl);
    el.appendChild(style); el.appendChild(canvas); el.appendChild(capEl);
    var night = paint();
    (document.body || root).appendChild(el);

    var still = false;
    try { still = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* no matchMedia */ }
    var dims = function () {
      var r = el.getBoundingClientRect(), c = capEl.getBoundingClientRect();
      var w = r.width || window.innerWidth, hh = r.height || window.innerHeight;
      // the points at no more than about two million pixels, so a large screen costs no more than a laptop's
      var d = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2.2e6 / Math.max(1, w * hh)));
      return { w: w, h: hh, dpr: Math.max(0.5, d), band: Math.max(0, c.bottom - r.top) + 8 };
    };
    var init = dims();
    init.type = "init"; init.shape = SHAPE; init.night = night; init.still = still;
    var off = null;
    try {
      if (canvas.transferControlToOffscreen && window.Worker && window.Blob && window.URL) {
        var url = URL.createObjectURL(new Blob(["(" + engine.toString() + ")(self);"], { type: "text/javascript" }));
        worker = new Worker(url);
        worker.onerror = function () { leave(true); };
        off = canvas.transferControlToOffscreen();
        init.canvas = off;
        worker.postMessage(init, [off]);
        post = function (m) { try { worker.postMessage(m); } catch (e) { /* the worker is gone */ } };
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      }
    } catch (e) { worker = null; }
    if (!worker) {
      if (off) { leave(true); } // the canvas was given away and there is no worker: no entrance
      else {
        var G = { requestAnimationFrame: function (f) { return window.requestAnimationFrame(f); } };
        engine(G);
        post = function (m) { try { G.onmessage({ data: m }); } catch (e) { leave(true); } };
        init.canvas = canvas;
        post(init);
      }
    }
    var resize = function () { if (left) return; var d = dims(); d.type = "size"; post(d); };
    window.addEventListener("resize", resize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize); // the title's own font moves the band
    try { new MutationObserver(function () { if (!left) post({ type: "theme", night: paint() }); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) { /* no observer */ }
    if (!loaded) window.addEventListener("load", function () { loaded = true; maybeReady(); });
    else maybeReady();
    setTimeout(function () { leave(false); }, CAP_MS);
    // a page whose script failed to load never says ready: its own error shows instead of the entrance
    window.addEventListener("error", function (e) { var t = e && e.target; if (t && t.tagName === "SCRIPT" && HOLD && !api._ready) leave(false); }, true);
  } catch (e) { leave(true); }
})();
