/**
 * The date a generated file is stamped with.
 *
 * Shared because four scripts stamp their output and all four wrote
 * `new Date().toISOString().slice(0, 10)`, which is the **UTC** date. Run in
 * the evening from a timezone behind UTC, that stamps tomorrow — observed on
 * 2026-08-15 producing `"generated":"2026-08-16"`. The stamp is what says
 * whether a registry file has drifted from the commit that produced it, so a
 * stamp that can be a day ahead of that commit makes the judgement unreliable.
 *
 * Built from the local calendar fields rather than from an ISO string, because
 * every ISO formatter on `Date` is either UTC or locale-dependent.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Today in the machine's own timezone, as `YYYY-MM-DD`. */
export const today = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
