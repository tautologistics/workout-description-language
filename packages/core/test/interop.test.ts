/**
 * Cross-format oracle.
 *
 * A `.zwo` file states every segment's duration explicitly, so the workout's
 * total can be summed straight off the XML by a computation that shares no code
 * with the parser, the AST, or the timeline compiler. Agreement between the two
 * is evidence the interpretation is right, not merely self-consistent — and the
 * files were written by other people for another tool, so nothing about them
 * was shaped to suit this codebase.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { importZwo, zwoDurationSeconds } from '../src/adapters/zwo.ts';
import { parse } from '../src/parse.ts';
import { format } from '../src/format.ts';
import { compile } from '../src/timeline.ts';
import { validate } from '../src/validate.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/interop/zwo');
const files = readdirSync(dir).filter((f) => f.endsWith('.zwo')).sort();

describe('zwo import: duration oracle', () => {
  for (const f of files) {
    it(f.replace(/\.zwo$/, ''), () => {
      const xml = readFileSync(join(dir, f), 'utf8');
      eq(compile(importZwo(xml)).estimatedSeconds, zwoDurationSeconds(xml));
    });
  }
});

describe('zwo import: full pipeline', () => {
  it('survives a trip out to WDL text and back', () => {
    // XML -> AST -> canonical WDL -> parse -> compile must still total the same.
    for (const f of files) {
      const xml = readFileSync(join(dir, f), 'utf8');
      const reparsed = parse(format(importZwo(xml)));
      eq(reparsed.errors.map((e) => e.message), [], f);
      eq(compile(reparsed.workout).estimatedSeconds, zwoDurationSeconds(xml), f);
    }
  });

  it('produces workouts that validate clean', () => {
    for (const f of files) {
      const w = parse(format(importZwo(readFileSync(join(dir, f), 'utf8')))).workout;
      eq(validate(w).filter((d) => d.severity === 'error').map((d) => d.message), [], f);
    }
  });

  it('carries power targets through as percentages of FTP', () => {
    const w = importZwo(readFileSync(join(dir, '15x1x2.zwo'), 'utf8'));
    const steps = w.body.filter((n) => n.node === 'step') as any[];
    ok(steps.length > 10, 'imported the segments');
    eq(steps[1].targets[0], { kind: 'power', text: '125% FTP' });
    ok(steps[0].notes[0].startsWith('ramp '), 'a warmup becomes a ramp');
  });

  it('classifies every imported step as timed', () => {
    const t = compile(importZwo(readFileSync(join(dir, files[0]), 'utf8')));
    const walk = (i: any): string[] =>
      i.kind === 'step' ? [i.pacing] : i.kind === 'group' ? i.items.flatMap(walk) : [];
    ok(walk(t.root).every((p) => p === 'timed'), 'endurance segments are clock-paced');
  });
});
