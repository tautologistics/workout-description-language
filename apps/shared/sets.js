/**
 * The builder's movement-set repertoire, as a host-agnostic model over the
 * `movement_sets` collection — queue task S2 of the movement-sets database epic
 * ([DEC-027]).
 *
 * **Shape.** Like `vocab.js` / `movement-editor.js`: no DOM, no `window`. An
 * in-memory cache of the sets the panel renders from, plus thin async wrappers
 * over the `pocketbase.js` calls that refresh that cache after every write. A
 * "set" is `{ id, name, setId, movements, visibility, description, mine, … }` —
 * the raw PocketBase row plus a `mine` boolean (an `org-library` / another
 * user's `public` set is read-only in the panel). `movements` stays an
 * **ordered array of registry movement ids** end to end — the exact value the
 * palette's `text/wdl-movement-id` drag payload carries — so `addSetToOutline`
 * / `lineFor` in the builder are untouched.
 *
 * **No `localStorage` path.** DEC-027 retired `localStorage['wdl.sets']` with no
 * migration and made sets a **signed-in-only** feature. Signed out, the builder
 * does not call `load()` and does not render the "Sets" section at all;
 * `clear()` drops the cache on sign-out.
 */

import {
  currentUser,
  listMineSets, listPublicSets, getSetByAnyId,
  createSet, updateSet, removeSet,
} from './pocketbase.js';

/** The sets the panel renders from — refreshed by `load()` after every write. */
let cache = [];

/** Your sets first (by name), then the read-only library sets (by name). */
function order(rows) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  return [
    ...rows.filter((s) => s.mine).sort(byName),
    ...rows.filter((s) => !s.mine).sort(byName),
  ];
}

/**
 * Fetch the signed-in user's sets plus every visible `org-library` / `public`
 * set into the cache. A no-op returning `[]` when signed out. Each source
 * degrades to `[]` on its own failure so one blocked read does not take the
 * other down.
 */
export async function load() {
  if (!currentUser()) { cache = []; return cache; }
  const uid = currentUser().id;
  const [mine, pub] = await Promise.all([
    listMineSets().catch(() => []),
    listPublicSets().catch(() => []),
  ]);
  const byId = new Map();
  for (const s of mine) byId.set(s.id, { ...s, mine: true });
  for (const s of pub) if (!byId.has(s.id)) byId.set(s.id, { ...s, mine: s.owner === uid });
  cache = order([...byId.values()]);
  return cache;
}

/** The cached sets. Synchronous — the panel iterates this. */
export function list() {
  return cache;
}

/** Drop the cache — called on sign-out, mirroring the *My workouts* panel. */
export function clear() {
  cache = [];
}

/**
 * One set by record id or `setId`, from the cache if it is there, else a live
 * `getSetByAnyId` lookup (which may reach a set the panel does not list).
 */
export async function get(key) {
  return cache.find((s) => s.id === key || s.setId === key) ?? getSetByAnyId(key);
}

/** Create a set (always `private`), refresh the cache, return the new row. */
export async function create({ name, movements = [] }) {
  const rec = await createSet({ name, movements });
  await load();
  return cache.find((s) => s.id === rec.id) ?? { ...rec, mine: true };
}

/** Rename a set — re-slugs its `setId` (DEC-027) — then refresh. */
export async function rename(id, name) {
  await updateSet(id, { name });
  return load();
}

/** Replace a set's ordered movement-id list, then refresh. */
export async function setMovements(id, movements) {
  await updateSet(id, { movements });
  return load();
}

/** Delete a set, then refresh. */
export async function remove(id) {
  await removeSet(id);
  return load();
}
