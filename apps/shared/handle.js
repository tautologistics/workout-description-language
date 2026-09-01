/**
 * Account-handle helpers — the `@id` namespace prefix every account carries
 * (DEC-021, L1). Pure: no `/api`, no DOM. The I/O half (check-free, PATCH,
 * random assignment with collision retry) lives in `apps/shared/pocketbase.js`,
 * which imports this.
 *
 * A handle is a lowercase slug: `^[a-z0-9-]+$`, 3–63 characters, not
 * pure-numeric, no leading/trailing `-`, and not one of a short reserved set.
 * The same `validateHandle` runs client-side (the builder's editor) and
 * mirrors what the server enforces (the unique index + these shape rules);
 * the server is still the authority on "taken".
 */

import { adjectives, nouns } from './handle-words.js';

/** The shape a valid handle must match. */
export const HANDLE_RE = /^[a-z0-9-]+$/;

/**
 * Slugs nobody may claim. `api` and `_` collide with PocketBase's own route
 * space (`/api/...`, `/_/...`); `admin` is reserved to avoid an account
 * impersonating the platform.
 */
export const RESERVED_HANDLES = new Set(['api', 'admin', '_']);

/** The longest handle we accept — matches the migration's `text` field `max`. */
export const HANDLE_MAX = 63;

/** The shortest handle we accept (Chris, 2026-09-01). */
export const HANDLE_MIN = 3;

/**
 * Validate a candidate handle. Returns `{ ok: true }` or
 * `{ ok: false, error: '<human sentence>' }`. Trims nothing — the caller
 * decides whether to trim before offering the value here.
 */
export function validateHandle(h) {
  if (typeof h !== 'string' || h === '') {
    return { ok: false, error: 'Enter a handle.' };
  }
  if (h.length < HANDLE_MIN) {
    return { ok: false, error: `Too short — ${HANDLE_MIN} characters at least.` };
  }
  if (h.length > HANDLE_MAX) {
    return { ok: false, error: `Too long — ${HANDLE_MAX} characters at most.` };
  }
  if (!HANDLE_RE.test(h)) {
    return { ok: false, error: 'Use lowercase letters, digits and hyphens only.' };
  }
  if (h.startsWith('-') || h.endsWith('-')) {
    return { ok: false, error: 'No leading or trailing hyphen.' };
  }
  if (/^[0-9]+$/.test(h)) {
    return { ok: false, error: 'A handle can’t be all digits.' };
  }
  if (RESERVED_HANDLES.has(h)) {
    return { ok: false, error: `“${h}” is reserved.` };
  }
  return { ok: true };
}

/** `true` iff `validateHandle` passes. */
export function isValidHandle(h) {
  return validateHandle(h).ok;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * A fresh random `adjective-noun` handle (`brave-otter`, `quiet-harbor`).
 * Always valid per `validateHandle`. Collision-checking is the caller's job.
 */
export function randomHandle() {
  return `${pick(adjectives)}-${pick(nouns)}`;
}
