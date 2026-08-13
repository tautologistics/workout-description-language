#!/usr/bin/env node
/**
 * Deduplicate the merged movement corpus.
 *
 *   node scripts/dedupe-movements.mjs [--apply]
 *
 * Without --apply this reports only. With it, the canonical file is rewritten
 * and every decision is recorded in registry/dedupe-audit.json, so any cluster
 * can be inspected or unpicked afterwards.
 *
 * Three ideas do the work:
 *
 * 1. LEMMAS. Token sets are compared after depluralising and folding a small
 *    synonym table, so `Tricep Extensions` and `Triceps Extension` become the
 *    same set rather than a near miss. Most of what looked like partial overlap
 *    is this.
 *
 * 2. VETO TOKENS. A token that distinguishes rather than describes — implement,
 *    side, grip, stance — present in one name and absent from the other blocks
 *    the pair outright, however similar the rest looks.
 *
 * 3. SUBSET MEANS VARIANT, NOT DUPLICATE. If one token set strictly contains
 *    the other, the longer name is a *more specific* exercise: `45 Degree Cable
 *    External Rotation` is not `Cable External Rotation`. These are recorded as
 *    variant-of relationships instead of being merged, which is where a naive
 *    similarity threshold does its worst damage.
 *
 * Merging is transitive via union-find, so A=B and B=C collapse to one cluster
 * rather than two overlapping pairs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deriveMuscles } from './lib/muscles.mjs';

const apply = process.argv.includes('--apply');
const STOP = new Set(['and', 'or', 'the', 'a', 'of', 'to', 'with', 'for', 'on', 'in']);

/** Spelling variants that mean the same thing. */
const SYNONYM = {
  tricep: 'triceps', bicep: 'biceps', ab: 'abs', abdominal: 'abs', quad: 'quads',
  glute: 'glutes', ext: 'extension', flex: 'flexion', rot: 'rotation', db: 'dumbbell',
  bb: 'barbell', kb: 'kettlebell', bw: 'bodyweight', situp: 'sit', pushup: 'push',
  pullup: 'pull', chinup: 'chin', deg: 'degree', degrees: 'degree', w: 'with',
};

const depluralize = (w) =>
  /(ss|sis|us)$/.test(w) ? w
  : /ies$/.test(w) ? `${w.slice(0, -3)}y`
  // `ss`, not a lone `s`: `presses` is `press`, but `raises` is `raise`.
  : /(ch|sh|x|z|ss)es$/.test(w) ? w.slice(0, -2)
  : /s$/.test(w) && w.length > 3 ? w.slice(0, -1) : w;

const lemma = (w) => { const s = SYNONYM[w] ?? w; return SYNONYM[depluralize(s)] ?? depluralize(s); };

const toks = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).map(lemma).filter(Boolean);

const DISCRIMINATIVE = new Set([
  'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'smith', 'band', 'bodyweight',
  'landmine', 'sandbag', 'medicine', 'ball', 'ring', 'trap', 'hex', 'ez', 'sled', 'rope', 'bar',
  'single', 'one', 'two', 'both', 'alternating', 'alternate', 'left', 'right', 'unilateral',
  'internal', 'external', 'forward', 'backward', 'lateral', 'front', 'back', 'side', 'rear',
  'reverse', 'overhead', 'underhand', 'overhand', 'neutral', 'pronated', 'supinated',
  'incline', 'decline', 'flat', 'seated', 'standing', 'lying', 'kneeling', 'prone', 'supine',
  'bent', 'close', 'wide', 'narrow', 'staggered', 'split', 'bulgarian', 'sumo', 'conventional',
  'strict', 'kipping', 'butterfly', 'deficit', 'pause', 'tempo', 'eccentric', 'isometric',
  'explosive', 'assisted', 'weighted', 'negative', 'half', 'quarter', 'full', 'hang', 'power',
  'goblet', 'zercher', 'hack', 'pistol', 'romanian', 'stiff', 'straight', 'walking', 'jumping',
  'degree', 'wall', 'floor', 'bench', 'box', 'step',
]);

const doc = JSON.parse(readFileSync('registry/movements.canonical.json', 'utf8'));
const movements = doc.movements;

/** Same family means deliberately distinct — never collapse siblings. */
const family = new Map();
for (const f of doc.families ?? []) for (const m of f.members) family.set(m, f.id);
const sets = movements.map((r) => new Set(toks(r.title)));
const key = movements.map((_, i) => [...sets[i]].sort().join(' '));

/**
 * The same name with the word boundaries taken out.
 *
 * `Pullups` is one token and `Pull-Up` is two, so a comparison of token sets
 * calls them different movements — and the corpus carried both, each marked
 * core, so muscle analysis read a different record depending on how you spelt
 * it. Joining the lemmas and depluralizing the result collapses hyphenation and
 * plurality together, which is the only difference between them.
 */
const solid = movements.map((r) => lemma(toks(r.title).join('')));

// --- union-find, so equality is transitive -------------------------------
const parent = movements.map((_, i) => i);
const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
const union = (a, b) => { const [x, y] = [find(a), find(b)]; if (x !== y) parent[Math.max(x, y)] = Math.min(x, y); };

// Identical lemma sets are the same movement. Group by the set itself, so this
// is linear rather than a comparison of every pair against every other.
const byKey = new Map();
movements.forEach((_, i) => {
  if (!byKey.has(key[i])) byKey.set(key[i], []);
  byKey.get(key[i]).push(i);
});

// The same, keyed on the solid form.
const bySolid = new Map();
movements.forEach((_, i) => {
  if (!solid[i]) return;
  if (!bySolid.has(solid[i])) bySolid.set(solid[i], []);
  bySolid.get(solid[i]).push(i);
});

const merges = [];
let familyBlocked = 0;
let solidFound = 0;
for (const [k, idxs] of [...byKey, ...bySolid]) {
  if (idxs.length < 2 || !k) continue;
  if (idxs.every((i) => key[i] !== k)) solidFound++;   // found only by the solid form
  const keep = [idxs[0]];
  for (const i of idxs.slice(1)) {
    const fa = family.get(movements[idxs[0]].id), fb = family.get(movements[i].id);
    if (fa && fb && fa !== fb) { familyBlocked++; continue; }   // different families: distinct
    keep.push(i);
  }
  if (keep.length < 2) continue;
  for (let i = 1; i < keep.length; i++) union(keep[0], keep[i]);
  merges.push({ key: k, members: keep.map((i) => ({ id: movements[i].id, title: movements[i].title, sources: movements[i].sources })) });
}

// --- collapse ------------------------------------------------------------
const clusters = new Map();
movements.forEach((r, i) => {
  const root = find(i);
  if (!clusters.has(root)) clusters.set(root, []);
  clusters.get(root).push(i);
});

const merged = [];
for (const [root, idxs] of clusters) {
  if (idxs.length === 1) { merged.push(movements[root]); continue; }
  // Prefer a curated title, then the one the most sources used, then the shortest.
  const pick = idxs.slice().sort((a, b) => {
    const cur = (i) => (movements[i].sources.includes('wdl-curated') ? 0 : 1);
    return cur(a) - cur(b) || movements[b].sources.length - movements[a].sources.length
        || movements[a].title.length - movements[b].title.length;
  })[0];
  const out = { ...movements[pick] };
  const union2 = (field) => {
    const all = idxs.flatMap((i) => movements[i][field] ?? []);
    return all.length ? [...new Set(all)].sort() : undefined;
  };
  out.aliases = [...new Set(idxs.flatMap((i) => [movements[i].title, ...(movements[i].aliases ?? [])]))]
    .filter((t) => t !== out.title).sort();
  for (const f of ['pattern', 'equipment']) { const v = union2(f); if (v) out[f] = v; }
  out.sources = [...new Set(idxs.flatMap((i) => movements[i].sources))];
  out.origin = Object.assign({}, ...idxs.map((i) => movements[i].origin ?? {}));
  out.external = Object.assign({}, ...idxs.map((i) => movements[i].external ?? {}));
  if (!Object.keys(out.external).length) delete out.external;
  // Claims merge per source and the muscle lists are re-derived from them.
  // Unioning the derived lists instead loses the attribution: two records both
  // carrying a Garmin claim would keep one and silently orphan the other's
  // muscles, which is how Thruster ended up claiming nine secondaries.
  const claims = {};
  for (const i of idxs) {
    for (const [src, c] of Object.entries(movements[i].muscleClaims ?? {})) {
      const into = (claims[src] ??= { primary: [], secondary: [] });
      for (const k of ['primary', 'secondary']) {
        for (const m of c[k] ?? []) if (!into[k].includes(m)) into[k].push(m);
      }
    }
  }
  if (Object.keys(claims).length) { out.muscleClaims = claims; out.muscles = deriveMuscles(claims); }
  else { delete out.muscleClaims; delete out.muscles; }
  out.mergedFrom = idxs.filter((i) => i !== pick).map((i) => movements[i].id);
  merged.push(out);
}
merged.sort((a, b) => a.id.localeCompare(b.id));

// --- strict subsets are variants, not duplicates --------------------------
// Computed *after* the collapse, so a link can only ever point at a surviving
// record. Run before it, and half the targets are records about to be absorbed:
// `barbell-burpee` came out as a variant of both `burpee` and `burpees`.
const mSets = merged.map((r) => new Set(toks(r.title)));
const variants = [];
const order = merged.map((_, i) => i).sort((a, b) => mSets[a].size - mSets[b].size);
for (const small of order) {
  if (mSets[small].size === 0 || mSets[small].size > 6) continue;
  for (const big of order) {
    if (mSets[big].size <= mSets[small].size) continue;
    if (![...mSets[small]].every((t) => mSets[big].has(t))) continue;
    const extra = [...mSets[big]].filter((t) => !mSets[small].has(t));
    if (!extra.every((t) => DISCRIMINATIVE.has(t))) continue;
    variants.push({ variant: merged[big].id, of: merged[small].id, adds: extra });
  }
}

// Keep the most specific parent: a link to the closest superset is more useful
// than one to the broadest.
const bestParent = new Map();
for (const v of variants) {
  const prev = bestParent.get(v.variant);
  if (!prev || prev.adds.length > v.adds.length) bestParent.set(v.variant, v);
}
let variantsApplied = 0;
for (const r of merged) {
  const v = bestParent.get(r.id);
  if (v) { r.variantOf = v.of; variantsApplied++; }
}

console.log(`${movements.length} records in`);
console.log(`  clusters merged:        ${merges.length}  (${movements.length - merged.length} records absorbed)`);
console.log(`  variant links recorded: ${variantsApplied}`);
console.log(`  blocked by family:      ${familyBlocked}`);
console.log(`  found only by ignoring hyphenation: ${solidFound}`);
console.log(`  records out:            ${merged.length}`);

if (!apply) { console.log('\nReport only. Re-run with --apply to rewrite the canonical file.'); process.exit(0); }

writeFileSync('registry/dedupe-audit.json', JSON.stringify({
  $comment: 'Every merge this pass made, and every variant-of link. Each cluster lists the records absorbed, so a merge can be inspected or unpicked.',
  generated: new Date().toISOString().slice(0, 10),
  clusters: merges, variants: variants.slice(0, 5000),
}, null, 1) + '\n');

doc.movements = merged;
if (doc.families) doc.families = doc.families.filter((f) => f.members.some((m) => merged.some((r) => r.id === m)));
doc.count = merged.length;
doc.deduplicated = true;
writeFileSync('registry/movements.canonical.json', JSON.stringify(doc, null, 0) + '\n');
console.log('\nWrote registry/movements.canonical.json and registry/dedupe-audit.json');
