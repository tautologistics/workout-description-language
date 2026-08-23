#!/usr/bin/env node
/**
 * Report every alias in the registry that does not point somewhere unique.
 *
 *   node scripts/check-aliases.mjs
 *
 * An alias the registry cannot resolve *uniquely* is the quietest failure the
 * corpus has. The step still parses, `wdl check` still says ok, and the movement
 * simply drops out of muscle attribution, out of volume, and out of every goal
 * rule — because `resolve()` returns `ambiguous` rather than an entry, and
 * nothing downstream distinguishes that from a movement with no muscles.
 *
 * Two shapes of it, and they fail differently:
 *
 *   COLLISION  one folded key claimed by two records. `Registry.validate()`
 *              reports these. Whether it is *caught* depends on which registry
 *              is asked: the suite validates the curated file, and the canonical
 *              corpus — the one every analysis actually reads — was never
 *              checked at all until this script existed.
 *
 *   SHADOW     an alias whose *depluralized* form is another record's title.
 *              `resolve()` tries the exact key before the plural fallback, so
 *              the alias wins and the other record becomes unreachable by its
 *              own plural. `validate()` cannot see this: the two keys differ.
 *
 * Both are conditions on the whole corpus rather than on one record, which is
 * why they belong in a pass and not in a per-record rule.
 */
import { readFileSync } from 'node:fs';

const STOP = new Set(['and', 'or', 'the', 'a', 'of', 'to', 'with']);
const fold = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).join('');
// Kept identical to `depluralize` in packages/core/src/fold.ts. A copy, because
// scripts/ does not import from the package; a divergence here reports the
// wrong thing rather than failing loudly, so any change to one belongs in both.
const depluralize = (k) => /(ss|sis|us)$/.test(k) ? k
  : /ies$/.test(k) ? `${k.slice(0, -3)}y`
  : /(ch|sh|x|z|ss)es$/.test(k) ? k.slice(0, -2)
  : /s$/.test(k) && k.length > 3 ? k.slice(0, -1) : k;

function report(label, movements) {
  const claims = new Map();          // folded key -> ids claiming it
  for (const m of movements) {
    for (const name of [m.title, ...(m.aliases ?? [])]) {
      const k = fold(name);
      if (!claims.has(k)) claims.set(k, []);
      if (!claims.get(k).includes(m.id)) claims.get(k).push(m.id);
    }
  }

  const collisions = [...claims].filter(([, ids]) => ids.length > 1);
  const shadows = [];
  for (const m of movements) {
    for (const a of m.aliases ?? []) {
      const singular = depluralize(fold(a));
      if (singular === fold(a)) continue;
      const owners = (claims.get(singular) ?? []).filter((id) => id !== m.id);
      if (owners.length) shadows.push({ id: m.id, alias: a, owners });
    }
  }

  const aliases = movements.reduce((n, m) => n + (m.aliases?.length ?? 0), 0);
  console.log(`\n${label}: ${movements.length} records, ${aliases} aliases on ${movements.filter((m) => m.aliases?.length).length}`);
  console.log(`  collisions: ${collisions.length}`);
  for (const [k, ids] of collisions) console.log(`    "${k}" claimed by ${ids.join(', ')}`);
  console.log(`  plural shadows: ${shadows.length}`);
  for (const s of shadows) console.log(`    ${s.id}: "${s.alias}" depluralizes onto ${s.owners.join(', ')}`);
  return collisions.length + shadows.length;
}

const problems =
  report('curated (registry/movements.json)', JSON.parse(readFileSync('registry/movements.json', 'utf8')).movements) +
  report('canonical (registry/movements.canonical.json)', JSON.parse(readFileSync('registry/movements.canonical.json', 'utf8')).movements);

console.log(`\n${problems} problems.`);
process.exit(problems ? 1 : 0);
