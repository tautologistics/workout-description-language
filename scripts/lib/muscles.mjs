/**
 * The muscle vocabulary, and the one rule for turning per-source claims into a
 * merged view. Shared because the merge and the deduplication pass both do it,
 * and if they did it differently the second would quietly undo the first.
 */
import { readFileSync } from 'node:fs';

export const VOCAB = JSON.parse(readFileSync('registry/muscles.json', 'utf8'));

// Keyed on a form with hyphens, underscores and spaces all flattened, because
// the same name arrives as `upper back`, `upper-back` and `upper_back`
// depending on which catalogue it came from.
const flat = (s) => String(s).trim().toLowerCase().replace(/[\s_-]+/g, ' ');
const LOOKUP = new Map();
for (const m of VOCAB.muscles) {
  LOOKUP.set(flat(m.id), m.id);
  for (const s of m.synonyms) LOOKUP.set(flat(s), m.id);
}

/** Names that resolved to nothing, so the caller can fail loudly rather than invent a muscle. */
export const unknownMuscles = new Map();

/**
 * Upstream names onto the closed set. An unknown name yields nothing and is
 * recorded: the previous version slugified whatever it was handed, which is how
 * `ischiocrural-muscles` came to sit in the corpus next to `hamstrings` as if
 * they were different muscles.
 */
export function norm(xs) {
  return (xs ?? []).map((x) => {
    const k = flat(x ?? '');
    if (!k) return '';
    const hit = LOOKUP.get(k);
    if (!hit) unknownMuscles.set(k, (unknownMuscles.get(k) ?? 0) + 1);
    return hit ?? '';
  }).filter(Boolean);
}

/**
 * The merged view of who works what, derived from the per-source claims rather
 * than accumulated alongside them.
 *
 * A muscle any source calls primary is primary — sources disagree constantly on
 * secondaries but rarely name a primary that isn't one. `support` counts how
 * many sources named each muscle at each level, as [primary, secondary]. That
 * count is the only thing separating a movement three catalogues agree hits the
 * glutes from one where a single catalogue listed every muscle in the leg.
 */
export function deriveMuscles(claims) {
  const count = new Map();
  for (const c of Object.values(claims ?? {})) {
    for (const m of c.primary ?? []) (count.get(m) ?? count.set(m, [0, 0]).get(m))[0]++;
    for (const m of c.secondary ?? []) (count.get(m) ?? count.set(m, [0, 0]).get(m))[1]++;
  }
  if (!count.size) return undefined;
  const by = (f) => [...count].filter(f).map(([m]) => m).sort();
  const muscles = {};
  const primary = by(([, [p]]) => p > 0);
  const secondary = by(([, [p]]) => p === 0);
  if (primary.length) muscles.primary = primary;
  if (secondary.length) muscles.secondary = secondary;
  muscles.support = Object.fromEntries([...count].sort(([a], [b]) => a.localeCompare(b)));
  return muscles;
}
