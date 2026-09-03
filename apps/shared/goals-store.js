/**
 * The builder's saved goal rulesets, as a host-agnostic model over the `goals`
 * collection — queue task G2 of the goals database epic ([DEC-028]).
 *
 * **Shape.** Like `sets.js` / `vocab.js`: no DOM, no `window`. Two in-memory
 * caches — the `global` rulesets everyone sees and the signed-in user's `mine`
 * rulesets — plus thin async wrappers over the `pocketbase.js` calls that
 * refresh `mine` after every write. A "goal" is `{ id?, goalId, title, source,
 * mine, … }` — a real PocketBase row, or (offline) a bundled entry with the
 * same three load-bearing fields (`goalId` / `title` / `source`).
 *
 * **Offline fallback for the `global` set.** `listGlobalGoals()` first; on
 * **any** failure (signed out against a box with no rows, `WDL_MOCK_API=0`, or
 * — until G3 — a `make serve` with no `goals/records` route) the bundled
 * `examples/goals/*.wdlg` files are fetched instead, so the Goals block always
 * offers the default rulesets. Same fetch-then-`.catch`-to-bundled shape as
 * `vocab.js`'s `muscleIds()`: resolved once, a failure is **not** cached (the
 * cached promise is cleared) so a later `loadGlobal()` retries the network.
 *
 * **No `localStorage` path.** DEC-028 retired `localStorage['wdl.goals']` with
 * no migration and made Saved rulesets a **signed-in-only** feature. Signed
 * out, the builder still shows the Global group (fetched or bundled) but renders
 * no Saved group; `clearMine()` drops the `mine` cache on sign-out.
 */

import {
  currentUser,
  listGlobalGoals, listMineGoals, getGoalByAnyId,
  createGoal, updateGoal, removeGoal,
} from './pocketbase.js';

/**
 * The bundled `global` rulesets, by filename — the offline fallback for the
 * Global optgroup, kept in step with `examples/goals/*.wdlg` and with the G3
 * loader's input. G2 shipped this with two entries (the pre-G2 `GOALS` const);
 * G3 reconciled the 2-vs-3 discrepancy in favour of `ramp-the-squat.wdlg` being
 * canonical — it is a well-formed house-style `.wdlg` demonstrating a
 * `measure: load` result-series goal, and DEC-028 already names all three as the
 * committed `global` source. `goalId` is `wdl:<file-basename>` (the file names
 * are already stable kebab-case slugs), which is exactly what
 * `scripts/goals-to-db.mjs` writes, so the fallback rows and the DB rows share
 * ids.
 */
const GOAL_FILES = ['ramp-the-pull.wdlg', 'ramp-the-squat.wdlg', 'rotate-muscles.wdlg'];

/** lower-case; non-alnum runs collapse to one `-`; ends trimmed (cf. `pocketbase.js`). */
function slug(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * The inline text after a `.wdlg`'s `goals:` header — `parseGoals(source).title`
 * without pulling `packages/core` into a shared module (the light-regex-on-the-
 * preamble-line rule `pocketbase.js` follows for `@id`).
 */
function goalTitle(source) {
  const m = String(source ?? '').match(/^goals:[ \t]*(\S.*?)[ \t]*$/m);
  return m ? m[1] : '';
}

/** The rulesets the Global optgroup renders from. */
let globalCache = [];
/** The rulesets the Saved optgroup renders from — only meaningful when signed in. */
let mineCache = [];
/** In-flight/resolved `loadGlobal()` promise; nulled on failure so a retry re-fetches. */
let globalPromise = null;

/** Fetch the bundled `.wdlg` files as rows shaped like a real `global` record. */
function bundledGlobals() {
  return Promise.all(GOAL_FILES.map(async (name) => {
    const res = await fetch(new URL(`../../examples/goals/${name}`, import.meta.url));
    if (!res.ok) throw new Error(`${res.status} ${name}`);
    const source = await res.text();
    const base = name.replace(/\.wdlg$/, '');
    return { goalId: `wdl:${slug(base)}`, title: goalTitle(source) || base, source, mine: false };
  }));
}

/**
 * Load the `global` rulesets into the cache — `/api` first, the bundled files
 * on any failure. Resolved once; the cached promise is cleared on failure so a
 * later call retries rather than being stuck on the fallback for the page's
 * life.
 */
export function loadGlobal() {
  globalPromise ??= Promise.resolve()
    .then(listGlobalGoals)
    .then((rows) => (Array.isArray(rows) && rows.length ? rows.map((r) => ({ ...r, mine: false })) : bundledGlobals()))
    .then((rows) => { globalCache = rows; return globalCache; })
    .catch((e) => {
      console.warn('goals: no /api rulesets, using the bundled .wdlg files —', e.message);
      globalPromise = null;
      return bundledGlobals()
        .then((rows) => { globalCache = rows; return globalCache; })
        .catch(() => { globalCache = []; return globalCache; });
    });
  return globalPromise;
}

/**
 * Load the signed-in user's rulesets into the cache. A no-op resolving to `[]`
 * when signed out. Never throws — a blocked read leaves the Saved group empty
 * rather than taking the block down.
 */
export async function loadMine() {
  if (!currentUser()) { mineCache = []; return mineCache; }
  mineCache = (await listMineGoals().catch(() => [])).map((r) => ({ ...r, mine: true }));
  return mineCache;
}

/** The cached `global` rulesets. Synchronous — the picker iterates this. */
export function globals() {
  return globalCache;
}

/** The cached `mine` rulesets. Synchronous. */
export function mine() {
  return mineCache;
}

/** Drop the `mine` cache — called on sign-out, mirroring `sets.clear()`. */
export function clearMine() {
  mineCache = [];
}

/**
 * One ruleset by record id or `goalId`, from a cache if it is there, else a
 * live `getGoalByAnyId` lookup.
 */
export async function get(key) {
  const hit = [...globalCache, ...mineCache].find((g) => g.id === key || g.goalId === key);
  return hit ?? getGoalByAnyId(key);
}

/**
 * Create a `user` ruleset from the current buffer. Optimistically shows in the
 * `mine` cache immediately (so the picker can render it before the write
 * lands); a failed `POST` removes it again and rethrows for the caller to
 * surface. `title` is the `.wdlg`'s `goals:` title — required by the collection.
 */
export async function create({ title, source }) {
  const pending = { id: `pending:${title}`, goalId: `pending:${slug(title)}`, title, source, mine: true, pending: true };
  mineCache = [...mineCache, pending];
  try {
    await createGoal({ title, source });
    return loadMine();
  } catch (e) {
    mineCache = mineCache.filter((g) => g !== pending);
    throw e;
  }
}

/** Patch a ruleset (`title` re-slugs its `goalId`, DEC-028), then refresh. */
export async function update(id, patch) {
  await updateGoal(id, patch);
  return loadMine();
}

/** Delete a ruleset — optimistic, rolled back on a failed `DELETE`. */
export async function remove(id) {
  const before = mineCache;
  mineCache = mineCache.filter((g) => g.id !== id);
  try {
    await removeGoal(id);
    return loadMine();
  } catch (e) {
    mineCache = before;
    throw e;
  }
}
