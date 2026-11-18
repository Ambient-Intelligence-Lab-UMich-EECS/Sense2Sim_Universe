// Vectors as the site ships them: one byte a number and a scale a row. Plain JavaScript, the same in Node and in
// the browser (worker.js).

// unit vectors -> one byte a number and a scale a row (scale 0: no vector); a dot product is scale × Σ q·byte
export function quantize(vecs, d) {
  const q = new Int8Array(vecs.length * d), scale = new Float32Array(vecs.length);
  vecs.forEach((v, i) => {
    if (!v) return;
    let m = 0;
    for (let k = 0; k < d; k++) m = Math.max(m, Math.abs(v[k]));
    const s = m / 127 || 1;
    scale[i] = s;
    for (let k = 0; k < d; k++) q[i * d + k] = Math.round(v[k] / s);
  });
  return { q, scale };
}

// one query against rows of bytes: scores[i] = scale[i] × (q · row i); rows with scale 0 score -Infinity
export function scoreRows(qv, q, scale, d) {
  const n = scale.length, s = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (!scale[i]) { s[i] = -Infinity; continue; }
    let x = 0;
    const o = i * d;
    for (let k = 0; k < d; k++) x += qv[k] * q[o + k];
    s[i] = x * scale[i];
  }
  return s;
}
