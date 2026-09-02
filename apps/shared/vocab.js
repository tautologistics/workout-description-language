/**
 * The vocabularies the movement editor's token inputs offer — queue task V5.
 *
 * **Static for now, on purpose.** Stage C of the epic (V6 → V8) makes equipment
 * and movement patterns a DB-backed layer: `registry/{equipment,patterns}.json`
 * committed as the canonical dump, two PocketBase collections, and
 * `listEquipment()` / `listPatterns()` over `/api` with the committed files as
 * the offline fallback. Until then the two lists live here as literals, so V5's
 * ergonomics ship without waiting on the data work. When V8 lands, the two
 * exports below become the fallback and the fetch goes in front of them — the
 * shape (`string[]`, or a function returning one) is already what
 * `createTokenInput` takes either way, so no consumer changes.
 *
 * **Seeded from the committed registry, not invented.** Both lists are the
 * distinct values across `registry/movements.json` (972 entries), normalised:
 *
 *   - `kettlebells` (53 entries) is folded into **`kettlebell`** (6) — one term,
 *     two spellings, from two different upstream sources.
 *   - **`other`** (116 entries) is dropped. It is free-exercise-db's "no
 *     equipment field" bucket, not a piece of equipment, and offering it in a
 *     picker invites curating it *in*. An entry that legitimately needs no
 *     equipment carries `bodyweight`, or nothing — *an absent field is not a
 *     claim* (lessons-learned).
 *   - Nothing else was folded. *Correction to the V5 task note, which also said
 *     to "fold the machine variants": `registry/movements.json` has none to
 *     fold.* Its 31 distinct values contain exactly one term with "machine" in
 *     it — the generic `machine` (68 entries) — and `cable` / `bike` / `skierg`
 *     are distinct pieces of kit, not alternate spellings of it. The variants
 *     the note has in mind (`smith machine`, `t-bar machine`, `chest machine`,
 *     `Cable machine`, `machine: bench press`, `machine: butterfly`,
 *     `machine: chest`) are in **`registry/movements.canonical.json`**, whose 69
 *     distinct values are the raw upstream union — `Barbell` beside `barbell`,
 *     `Swiss Ball` beside `swiss ball`, `none (bodyweight exercise)`. That file
 *     is a merge artefact, not a vocabulary, which is exactly why the curated
 *     registry is the seed. Checked before writing the list rather than after;
 *     `grep`ping the data first is the habit DEC-023 cost us.
 *
 * `allowCustom` is **true** for equipment and patterns, so a term missing here
 * is typed in rather than blocked — the picker is a shortcut, not a gate.
 * Muscles are the exception; see `muscleIds()`.
 */

/**
 * Equipment, alphabetical — 29 terms. Alphabetical because the picker has its
 * own filter box, so scanning beats frequency-ranking, and because a stable
 * order makes V6's `registry/equipment.json` a readable diff.
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
 * Movement patterns — the 11 distinct values in the registry, grouped by family
 * rather than alphabetised, because the pairs are the point: the balance
 * analysis reads push against pull, and alphabetical order scatters them.
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
 * The muscle vocabulary — read from `registry/muscles.json`, never duplicated
 * here.
 *
 * It is a **closed** 19-term set: the body-map SVG has one hand-drawn path per
 * id and `scripts/build-movements.mjs` fails on anything not listed, so the
 * editor sets `allowCustom: false` on both muscle fields. Which is exactly why
 * there is no hardcoded copy in this file — a stale second list would offer a
 * term the pipeline rejects.
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
