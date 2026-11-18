// A Chinese query turned into English words with the glossary (glossary.zh.tsv: one "中文<TAB>English" a line,
// # for a comment): the longest glossary entry that starts at each place wins, a Chinese character no entry
// covers is dropped, Latin letters and digits (WiFi, RFID, 60 GHz) are kept as they are.
// The page does the same in the browser (this file, imported by worker.js), so what a reader typed and what was
// searched can both be shown.

// the glossary's text -> Map(中文 -> English)
export function parseGlossary(text) {
  const map = new Map();
  for (const line of String(text).split("\n")) {
    const s = line.replace(/#.*$/, "").trim();
    if (!s) continue;
    const [zh, en] = s.split("\t").map(x => (x || "").trim());
    if (zh && en !== undefined) map.set(zh, en);
  }
  return map;
}

const CJK = /[㐀-鿿豈-﫿]/;

export function hasChinese(q) {
  return CJK.test(q);
}

export function translate(q, map) {
  let longest = 0;
  for (const k of map.keys()) longest = Math.max(longest, k.length);
  const out = [];
  let i = 0, latin = "";
  const flush = () => { if (latin.trim()) out.push(latin.trim()); latin = ""; };
  while (i < q.length) {
    const c = q[i];
    if (!CJK.test(c)) { latin += /[\p{L}\p{N}.\-]/u.test(c) ? c : " "; i++; continue; }
    flush();
    let hit = null;
    for (let n = Math.min(longest, q.length - i); n >= 1; n--) {
      const w = q.slice(i, i + n);
      if (map.has(w)) { hit = w; break; }
    }
    if (hit) { const en = map.get(hit); if (en) out.push(en); i += hit.length; } else i++;
  }
  flush();
  return [...new Set(out)].join(" ");
}
