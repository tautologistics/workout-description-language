#!/usr/bin/env node
/**
 * Redundant within-record aliases (P3 candidate list).
 *
 *   node scripts/find-dup-aliases.mjs
 *
 * Since P1 the builder palette normalizes a query the way core `resolve()` does:
 * separators fold and plurals depluralize. An alias is then dead weight when its
 * normalized key equals the record's own id/title key, or another alias's key.
 * This lists every such alias so the redundant ones can be dropped (with
 * sign-off) via `make movements:dump`.
 *
 * `key()` is builder.js `searchKey()` restricted to the three standard-equipment
 * TOKEN_EXPANSIONS prefixes (bb/kb/db). The other shorthand core expands
 * (hspu, ohs, sdhp, du, wb, ...) is gym-whiteboard vocabulary we deliberately
 * keep as an alias — see the P3 discussion 2026-09-05.
 *
 *   node scripts/find-dup-aliases.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fold, foldTokens, depluralize, TOKEN_EXPANSIONS } from '../packages/core/src/fold.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const movements = JSON.parse(readFileSync(join(root, 'registry', 'movements.json'), 'utf8')).movements;

// Only the three standard-equipment prefixes count as "same as the full word"
// for redundancy. The rest of TOKEN_EXPANSIONS (hspu, ohs, sdhp, du, wb, ...) is
// gym-whiteboard shorthand we keep as an alias even though core resolve() also
// expands it — see P3 discussion 2026-09-05.
const EXP = { bb: TOKEN_EXPANSIONS.bb, kb: TOKEN_EXPANSIONS.kb, db: TOKEN_EXPANSIONS.db };

const key = (s) => depluralize(foldTokens(s).tokens.map((t) => EXP[t] ?? t).join(''));

/** How un-whiteboard-friendly a spelling is; lower is the better keeper. */
function penalty(a) {
  const toks = foldTokens(a).tokens;
  const abbrevs = toks.filter((t) => EXP[t]).length;
  const hyphens = (a.match(/-/g) ?? []).length;
  const plural = fold(a) !== depluralize(fold(a)) ? 1 : 0;
  return abbrevs * 100 + hyphens * 10 + plural;
}

const drops = [];

for (const e of movements) {
  const aliases = e.aliases ?? [];
  if (!aliases.length) continue;

  const idKey = key(e.id);
  const titleKey = key(e.title);

  // bucket aliases by normalized key
  const buckets = new Map();
  for (const a of aliases) {
    const k = key(a);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(a);
  }

  for (const [k, members] of buckets) {
    const coversIdTitle = k === idKey || k === titleKey;
    if (coversIdTitle) {
      // id/title already answers this key — every alias in the bucket is dead
      for (const a of members) drops.push({ id: e.id, drop: a, keep: `${e.id} (id/title)`, k });
    } else if (members.length > 1) {
      // pure alias-vs-alias collision — keep the most readable, drop the rest
      const sorted = [...members].sort((x, y) => penalty(x) - penalty(y) || x.localeCompare(y));
      const keep = sorted[0];
      for (const a of sorted.slice(1)) drops.push({ id: e.id, drop: a, keep: JSON.stringify(keep), k });
    }
  }
}

for (const d of drops) {
  console.log(`${d.id.padEnd(30)} drop ${JSON.stringify(d.drop).padEnd(24)} keep ${d.keep.padEnd(28)} (${d.k})`);
}
console.log(`\n${drops.length} redundant alias(es) across ${new Set(drops.map((d) => d.id)).size} record(s).`);

// machine-readable, for an apply step: { "<id>": ["alias to drop", ...] }
if (process.argv.includes('--json')) {
  const byId = {};
  for (const d of drops) (byId[d.id] ??= []).push(d.drop);
  process.stdout.write(JSON.stringify(byId, null, 2) + '\n');
}
