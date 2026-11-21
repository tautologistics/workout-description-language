// Shared checks for wdl_guards.pb.js. PocketBase runs each hook handler in its
// own isolated JS context, so a handler can't see top-level functions from its
// own file. Handlers load this module with require() instead.
//
// Kept in step with apps/shared/handle.js by hand: the client gives friendly
// errors as you type, and this is the authority.

const HANDLE_RE = /^[a-z0-9-]+$/;
const RESERVED = ["api", "admin", "_"];
const HANDLE_MIN = 3;
const HANDLE_MAX = 63;

/** null when `h` is a valid handle, otherwise a sentence saying why not. */
function handleError(h) {
  if (h.length < HANDLE_MIN) return `Handle too short: ${HANDLE_MIN} characters at least.`;
  if (h.length > HANDLE_MAX) return `Handle too long: ${HANDLE_MAX} characters at most.`;
  if (!HANDLE_RE.test(h)) return "Handle may use lowercase letters, digits and hyphens only.";
  if (h.startsWith("-") || h.endsWith("-")) return "Handle may not start or end with a hyphen.";
  if (/^[0-9]+$/.test(h)) return "Handle can't be all digits.";
  if (RESERVED.indexOf(h) !== -1) return `Handle "${h}" is reserved.`;
  return null;
}

/**
 * The namespaced key field for each collection (DEC-021 / DEC-027 / DEC-028),
 * and whether a given record's key is bound to its owner's handle. A `global`
 * goal uses the fixed `wdl:` prefix and is admin-only by its collection rule,
 * so it isn't checked here.
 */
const KEY_FIELD = { workouts: "wdlId", movement_sets: "setId", goals: "goalId" };

function keyIsBound(collectionName, record) {
  if (collectionName === "goals") return record.getString("scope") === "user";
  return true;
}

/** null when `key` may be written by an account with `handle`, otherwise why not. */
function keyError(field, key, handle) {
  if (key === "") return null;
  if (handle === "") return `Set a handle before saving a ${field}.`;
  if (key.indexOf(handle + ":") !== 0) return `${field} must start with your handle, "${handle}:".`;
  return null;
}

module.exports = { handleError, keyError, keyIsBound, KEY_FIELD };
