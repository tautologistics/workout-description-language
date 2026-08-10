/**
 * Conformance run over examples/corpus (roadmap §5.1).
 *
 * Two checks per file:
 *   parse   — no errors, and something was produced
 *   trip    — parse -> format -> parse yields an equivalent AST
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../src/parse.ts';
import { format } from '../src/format.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '../../../examples/corpus');

/** Compare ASTs ignoring source positions and comment placement. */
function strip(v: any): any {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') {
    const o: any = {};
    for (const k of Object.keys(v).sort()) {
      if (k === 'line' || k === 'comments') continue;
      const s = strip(v[k]);
      if (s !== undefined && !(Array.isArray(s) && s.length === 0)) o[k] = s;
    }
    return o;
  }
  return v;
}

const files = readdirSync(dir).filter((f) => f.endsWith('.wdl')).sort();
let parsed = 0, tripped = 0, stable = 0;
const problems: string[] = [];

for (const f of files) {
  const src = readFileSync(join(dir, f), 'utf8');
  const { workout, errors } = parse(src);

  if (errors.length) {
    problems.push(`${f}: ${errors.map((e) => `L${e.line} ${e.message}`).join('; ')}`);
  } else if (workout.body.length === 0) {
    problems.push(`${f}: parsed to an empty body`);
  } else {
    parsed++;
  }

  const once = format(workout);
  const round = parse(once);
  const a = JSON.stringify(strip(workout));
  const b = JSON.stringify(strip(round.workout));
  if (a === b) tripped++;
  else if (!errors.length) problems.push(`${f}: round-trip differs`);

  // Canonical output must be a fixed point: formatting it again changes nothing.
  const twice = format(round.workout);
  if (once === twice) stable++;
  else problems.push(`${f}: formatter not idempotent`);
}

console.log(`\n  parse     ${parsed}/${files.length}`);
console.log(`  roundtrip ${tripped}/${files.length}`);
console.log(`  canonical ${stable}/${files.length}\n`);
if (problems.length) {
  console.log('  problems:');
  for (const p of problems) console.log(`    ${p}`);
  console.log();
}
process.exit(parsed === tripped && tripped === stable && stable === files.length ? 0 : 1);
