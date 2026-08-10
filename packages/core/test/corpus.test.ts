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
import { describe, it, ok } from './lib.ts';
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

describe('corpus', () => {
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf8');
    it(f, () => {
      const { workout, errors } = parse(src);
      ok(!errors.length, errors.map((e) => `L${e.line} ${e.message}`).join('; '));
      ok(workout.body.length > 0, 'parsed to an empty body');

      const once = format(workout);
      const round = parse(once);
      ok(JSON.stringify(strip(workout)) === JSON.stringify(strip(round.workout)), 'round-trip differs');

      // Canonical output must be a fixed point: formatting it again changes nothing.
      ok(once === format(round.workout), 'formatter is not idempotent');
    });
  }
});
