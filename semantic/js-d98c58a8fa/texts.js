// What each paper is embedded as. The same recipe builds the test's vectors (eval.mjs) and, later, the site's
// index, so a change here is a new RECIPE and every vector is made again.
// It reads either form of a paper: the lab's kb.json (authors_labels, index_labels, abstract) or the public
// page's copy (labels; no abstract).

export const RECIPE = "card-1";

const clean = s => String(s ?? "").replace(/\s+/g, " ").trim();
const uniq = a => [...new Set(a.filter(Boolean).map(clean).filter(Boolean))];

export function keywords(p) {
  const L = p.labels || p.authors_labels || {};
  const kw = [...(L.keywords || [])];
  const ccs = (L.ccs_2012 || []).map(x => x[x.length - 1]);
  const ix = p.index_labels || {};
  const oa = [...(ix.openalex_keywords || []), ...(ix.openalex_topics || []).map(t => t.topic)];
  return uniq([...kw, ...ccs, ...oa]);
}

// The "card": what the paper is, in our words and the public record's (title, TLDR, our labels, tags,
// scenario, keywords). `extra` takes more lines, such as the paper's "says" lines in the Sensing World.
export function cardText(p, extra = []) {
  const o = p.ours, t = p.tags || {};
  const title = clean(p.title), name = clean(p.name);
  const head = !name || /et al\./.test(name) || title.toLowerCase().startsWith(name.toLowerCase()) ? title : `${name}: ${title}`;
  const parts = [head];
  if (p.tldr) parts.push(clean(p.tldr));
  if (o) {
    const facts = uniq([
      o.application,
      o.sensor && `sensor: ${o.sensor}`,
      o.device && `device: ${o.device}`,
      o.technique && `technique: ${o.technique}`,
      o.observable && `observes: ${o.observable}`,
      o.modality && `${o.modality} sensing`,
      o.phenomenon,
      o.phenomenon_secondary,
    ]);
    if (facts.length) parts.push(facts.join("; ") + ".");
    if (o.model_reason) parts.push(clean(o.model_reason));
  } else if (p.considered && p.considered.modality) {
    parts.push(`${p.considered.modality} sensing.`);
  }
  const tags = uniq([...(t.application || []), ...(t.sensor || []), ...(t.device || []), ...(t.observable || [])]).filter(x => x !== "Other");
  if (tags.length) parts.push(tags.join(", ") + ".");
  const sc = p.scenario ? uniq([p.scenario.primary, ...(p.scenario.secondary || [])]).filter(x => x !== "Not scenario-specific") : [];
  if (sc.length) parts.push(`Used in: ${sc.join(", ")}.`);
  const kw = keywords(p);
  if (kw.length) parts.push(kw.join(", ") + ".");
  for (const e of extra) if (e) parts.push(clean(e));
  return parts.join(" ");
}

// The abstract, with the title in front; null when the knowledge base has none (and always on the public copy).
export function abstractText(p) {
  return p.abstract ? `${clean(p.title)}. ${clean(String(p.abstract).replace(/<[^>]+>/g, " "))}` : null;
}

// The words a topic query's relevance is judged on (eval.mjs): never the abstract, never the TLDR.
export function labelHay(p) {
  const o = p.ours || {}, t = p.tags || {};
  return uniq([
    p.title, o.application, o.sensor, o.device, o.technique, o.observable,
    ...(t.application || []), ...(t.sensor || []), ...(t.device || []), ...(t.observable || []),
  ]).join(" | ").toLowerCase();
}

export function modalityOf(p) {
  return (p.ours && p.ours.modality) || (p.considered && p.considered.modality) || null;
}
