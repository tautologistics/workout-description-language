/**
 * The vocabularies the movement editor's token inputs offer — queue tasks V5
 * (the widget) and V8 (the fetch).
 *
 * **Equipment and patterns are DB-backed, with the literals below as the
 * offline fallback.** Stage C of the epic moved both into PocketBase: two
 * collections (V6), a mock `/api` (V7), a `registry/{equipment,patterns}.json`
 * committed dump and `make vocab:load` (V8). `equipmentVocab()` / `patternVocab()`
 * fetch `listEquipment()` / `listPatterns()` from `apps/shared/pocketbase.js`,
 * map each row to its `termId`, and on **any** failure return the committed
 * literal array — so the picker still works with no network, and a term is now
 * added by a DB row (or `registry/*.json` + `make vocab:load`) rather than a
 * code edit here.
 *
 * *Note, recorded per the V-series "verify the premise" habit: the V8 task note
 * said to match a `{ id, name, synonyms }` literal shape and to mirror "the
 * fallback pattern the apps use for movements". Neither held on inspection —
 * `EQUIPMENT` / `MOVEMENT_PATTERNS` were always bare `string[]` (of ids), and
 * `builder.js` has no `/api`→file fallback for movement *lists* at all (they
 * load straight from `registry/movements*.json`). So the interchangeable shape
 * is a `string[]` of term ids, and the pattern mirrored is `muscleIds()` right
 * here in this file: fetch, `.catch` → bundled default, and don't cache the
 * failure so a later open retries.*
 *
 * **The literal arrays stay the source of truth for the offline case, and they
 * are `registry/{equipment,patterns}.json`'s `id` column** (29 equipment, 11
 * patterns) — a stale copy would offer a term the DB does not know, so keep
 * them in step with those files. Both were seeded from the distinct values
 * across `registry/movements.json` (972 entries), normalised:
 *
 *   - `kettlebells` (53 entries) is folded into **`kettlebell`** (6) — one term,
 *     two spellings, from two different upstream sources.
 *   - **`other`** (116 entries) is dropped. It is free-exercise-db's "no
 *     equipment field" bucket, not a piece of equipment, and offering it in a
 *     picker invites curating it *in*. An entry that legitimately needs no
 *     equipment carries `bodyweight`, or nothing — *an absent field is not a
 *     claim* (lessons-learned).
 *   - Nothing else was folded — `registry/movements.json` has no machine
 *     variants to fold (its 31 distinct values carry exactly one term with
 *     "machine" in it). The variants live in `registry/movements.canonical.json`,
 *     the raw upstream union, which is why the curated registry is the seed;
 *     they land as `synonyms` in `registry/equipment.json` (V6).
 *
 * `allowCustom` is **true** for equipment and patterns, so a term missing here
 * is typed in rather than blocked — the picker is a shortcut, not a gate.
 * Muscles are the exception; see `muscleIds()`.
 */

import { listEquipment, listPatterns } from './pocketbase.js';

/**
 * Equipment, alphabetical — 29 terms. The offline fallback for `equipmentVocab()`;
 * `registry/equipment.json`'s `id` column, kept in step with it. Alphabetical
 * because the picker has its own filter box, so scanning beats frequency-ranking,
 * and because a stable order makes the registry file a readable diff.
 */
export const EQUIPMENT = [
  'atlas stone',
  'bands',
  'barbell',
  'bike',
  'blocks',
  'bodyweight',
  'box',
  'cable',
  'dumbbell',
  'e-z curl bar',
  'exercise ball',
  'farmers handles',
  'foam roll',
  'ghd',
  'jump rope',
  'kettlebell',
  'machine',
  'medicine ball',
  'parallettes',
  'partner',
  'pool',
  'pull-up bar',
  'rack',
  'rings',
  'sandbag',
  'skierg',
  'sled',
  'wall',
  'yoke',
];

/**
 * Movement patterns — the 11 distinct values in the registry. The offline
 * fallback for `patternVocab()`; `registry/patterns.json`'s `id` column, kept
 * in step with it. Grouped by family rather than alphabetised, because the
 * pairs are the point: the balance analysis reads push against pull, and
 * alphabetical order scatters them. (The DB read is `termId`-sorted, under
 * which the push/pull pairs still land adjacent.)
 */
export const MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'horizontal-push',
  'horizontal-pull',
  'vertical-push',
  'vertical-pull',
  'elbow-flexion',
  'elbow-extension',
  'core',
  'carry',
  'locomotion',
];

/**
 * Fetch a `/api` vocabulary, degrading to a bundled literal offline — the same
 * shape as `muscleIds()` below.
 *
 * Resolved once and cached; a failure is **not** cached (the cached promise is
 * cleared), so a later open retries the network rather than being stuck on the
 * fallback for the life of the page. Each row is mapped to its `termId` — the
 * lowercase id the picker shows and `collect()` writes into the movement's
 * `equipment` / `pattern` array — so the fetched path and the fallback are
 * interchangeable.
 */
function dbVocab(list, fallback, label) {
  let promise = null;
  return () => (promise ??= Promise.resolve()
    .then(list)
    .then((rows) => {
      const ids = (rows ?? [])
        .map((r) => (typeof r === 'string' ? r : r?.termId))
        .filter(Boolean);
      return ids.length ? ids : fallback.slice();
    })
    .catch((e) => {
      console.warn(`${label}: no /api vocabulary, using the bundled list —`, e.message);
      promise = null;
      return fallback.slice();
    }));
}

/** The equipment vocabulary: `/api` first, `EQUIPMENT` offline. */
export const equipmentVocab = dbVocab(listEquipment, EQUIPMENT, 'equipment');

/** The movement-pattern vocabulary: `/api` first, `MOVEMENT_PATTERNS` offline. */
export const patternVocab = dbVocab(listPatterns, MOVEMENT_PATTERNS, 'movement patterns');

/**
 * The muscle vocabulary — read from `registry/muscles.json`, never duplicated
 * here.
 *
 * It is a **closed** 19-term set: the body-map SVG has one hand-drawn path per
 * id and `scripts/build-movements.mjs` fails on anything not listed, so the
 * editor sets `allowCustom: false` on both muscle fields. Which is exactly why
 * there is no hardcoded copy in this file — a stale second list would offer a
 * term the pipeline rejects. It stays a file (not a DB collection) on purpose:
 * DEC-025 keeps muscles out of the vocab layer.
 *
 * Resolved relative to *this module*, not the page, so a second host in another
 * directory gets the same file. Fetched once and cached; a failure resolves to
 * an empty list, which leaves the field's existing chips editable-by-removal
 * and un-addable rather than taking the form down.
 */
const MUSCLES_URL = new URL('../../registry/muscles.json', import.meta.url);
let musclesPromise = null;

export function muscleIds() {
  musclesPromise ??= fetch(MUSCLES_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} muscles.json`))))
    .then((data) => (data.muscles ?? []).map((m) => m.id).filter(Boolean))
    .catch((e) => {
      console.warn('no muscle vocabulary:', e.message);
      musclesPromise = null;   // a later open retries rather than caching the failure
      return [];
    });
  return musclesPromise;
}
