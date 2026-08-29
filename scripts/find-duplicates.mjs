#!/usr/bin/env node
/**
 * Find likely-duplicate movements across sources.
 *
 *   node scripts/find-duplicates.mjs                 # summary to stderr, JSON to stdout
 *   node scripts/find-duplicates.mjs > pairs.json    # capture the candidate list
 *
 * A run-on-demand report, like check-aliases.mjs — not a pipeline step, and it
 * writes no committed file. It used to write registry/duplicate-candidates.json;
 * that artefact was retired 2026-08-29 because nothing downstream read it, so a
 * once-generated copy just rotted in the tree (pairs a later alias pass found
 * were already sitting in it, unnoticed). Run it when you want a fresh list to
 * triage; pipe stdout somewhere if you want to keep one.
 *
 * Reports for review; never merges. A wrong merge silently destroys a
 * distinction, and the sources disagree often enough that automatic merging
 * would bake those disagreements in invisibly.
 *
 * Matching is at the *word* level, not the character level. Character edit
 * distance is the wrong tool here: "Barbell Bench Press" and "Dumbbell Bench
 * Press" are two characters apart and are different exercises, while "Band
 * External Rotation" and "External Rotation with Band" are far apart and are
 * the same one. Comparing token sets is both order-insensitive and blind to
 * spelling noise, which is exactly the shape of the problem.
 *
 * The scoring has two halves:
 *
 *   similarity  Jaccard overlap of the folded, stopword-stripped token sets.
 *   veto        a token that *distinguishes* rather than describes — the
 *               implement, the side, the grip, the stance — present in one
 *               name and absent from the other rules the pair out entirely.
 *
 * The veto list is the whole game. Without it, half the strength catalogue
 * collapses into itself; the earlier draft omitted `internal` and `external`
 * and duly proposed merging internal and external rotations.
 */
import { readFileSync } from 'node:fs';
import { today } from './lib/stamp.mjs';

const STOP = new Set(['and', 'or', 'the', 'a', 'of', 'to', 'with', 'for', 'on', 'in']);
const toks = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));

/** Tokens whose presence or absence changes which exercise this is. */
const DISCRIMINATIVE = new Set([
  // implement
  'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'smith', 'band', 'banded', 'bodyweight',
  'landmine', 'sandbag', 'medicine', 'ball', 'ring', 'rings', 'trap', 'hex', 'ez', 'sled', 'rope',
  // count and side
  'single', 'one', 'two', 'both', 'alternating', 'alternate', 'left', 'right', 'unilateral',
  // direction — omitting these merged internal and external rotations
  'internal', 'external', 'forward', 'backward', 'lateral', 'front', 'back', 'side', 'rear',
  'reverse', 'overhead', 'underhand', 'overhand', 'neutral', 'pronated', 'supinated',
  // stance and position
  'incline', 'decline', 'flat', 'seated', 'standing', 'lying', 'kneeling', 'prone', 'supine',
  'bent', 'close', 'wide', 'narrow', 'staggered', 'split', 'bulgarian', 'sumo', 'conventional',
  // execution
  'strict', 'kipping', 'butterfly', 'deficit', 'pause', 'tempo', 'eccentric', 'isometric',
  'explosive', 'assisted', 'weighted', 'negative', 'half', 'quarter', 'full', 'hang', 'power',
  'goblet', 'zercher', 'hack', 'pistol', 'romanian', 'stiff', 'straight', 'walking', 'jumping',
]);

const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (A.size + B.size - inter);
};

const doc = JSON.parse(readFileSync('registry/movements.canonical.json', 'utf8'));
const movements = doc.movements;

/**
 * Two records in the same family are siblings a human deliberately listed
 * separately — `Deadlift` and `Rack Deadlift` are not the same lift. Family
 * membership is a veto on merging, not encouragement.
 */
const family = new Map();
for (const f of doc.families ?? []) for (const m of f.members) family.set(m, f.id);
const primary = (r) => new Set(r.muscles?.primary ?? []);

const buckets = new Map();
movements.forEach((r, i) => {
  for (const t of new Set(toks(r.title))) {
    if (DISCRIMINATIVE.has(t)) continue;         // never block on a veto token
    if (!buckets.has(t)) buckets.set(t, []);
    buckets.get(t).push(i);
  }
});

const seen = new Set(), candidates = [];
for (const [, idxs] of buckets) {
  if (idxs.length > 300) continue;               // a token this common blocks nothing useful
  for (let x = 0; x < idxs.length; x++) for (let y = x + 1; y < idxs.length; y++) {
    const [a, b] = [idxs[x], idxs[y]];
    const key = `${a}:${b}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const A = movements[a], B = movements[b];
    if (A.sources.some((s) => B.sources.includes(s))) continue;   // same source: assume deliberate
    const fa = family.get(A.id);
    if (fa && fa === family.get(B.id)) continue;                  // siblings, not duplicates

    const ta = toks(A.title), tb = toks(B.title);
    const name = jaccard(ta, tb);
    if (name < 0.5) continue;

    const da = new Set(ta.filter((t) => DISCRIMINATIVE.has(t)));
    const db = new Set(tb.filter((t) => DISCRIMINATIVE.has(t)));
    if (da.size !== db.size || [...da].some((t) => !db.has(t))) continue;

    const ma = primary(A), mb = primary(B);
    const inter = [...ma].filter((m) => mb.has(m)).length;
    const muscles = ma.size && mb.size ? inter / (ma.size + mb.size - inter) : null;

    candidates.push({
      confidence: name === 1 ? (muscles === null ? 'likely' : muscles >= 0.5 ? 'high' : 'conflicting') : 'possible',
      name: Number(name.toFixed(2)),
      muscles: muscles === null ? null : Number(muscles.toFixed(2)),
      a: { id: A.id, title: A.title, sources: A.sources, muscles: [...ma] },
      b: { id: B.id, title: B.title, sources: B.sources, muscles: [...mb] },
    });
  }
}

const order = { high: 0, conflicting: 1, likely: 2, possible: 3 };
candidates.sort((x, y) => order[x.confidence] - order[y.confidence] || y.name - x.name);

const counts = {};
for (const c of candidates) counts[c.confidence] = (counts[c.confidence] ?? 0) + 1;

process.stdout.write(JSON.stringify({
  $comment: 'Likely-duplicate movements across sources, for review. Nothing here has been merged. `high` means the two names use identical word sets and the sources agree on primary muscles; `conflicting` means identical word sets but disagreeing muscles, which usually means the sources disagree rather than the exercises differing; `possible` means partial name overlap and needs a human.',
  generated: today(),
  counts, candidates,
}, null, 1) + '\n');

console.error(`${candidates.length} candidate pairs on stdout (redirect it to keep a copy)`);
for (const [k, v] of Object.entries(counts)) console.error(`  ${k.padEnd(12)} ${v}`);
