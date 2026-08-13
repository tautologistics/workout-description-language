/**
 * The run: a timeline laid out as the things an athlete does, in order.
 *
 * What matters here is that a cue points back at the line that was written.
 * Everything a display does — a cursor on the whiteboard, a header saying where
 * you are — rests on that mapping, and a rep scheme is where it gets
 * interesting: three cues, one line.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { compile } from '../src/timeline.ts';
import { run, roundLabel } from '../src/run.ts';

const r = (src: string, opts = {}) => run(compile(parse(src).workout), opts);
const corpus = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/corpus');

describe('run: order', () => {
  it('walks a couplet in written order', () => {
    const { cues } = r('sequence:\n  - 10 Push-Up\n  - 10 Air Squat');
    eq(cues.map((c) => c.movement), ['Push-Up', 'Air Squat']);
  });

  it('expands rounds, which the timeline leaves as a tree', () => {
    const { cues } = r('3 rounds:\n  - 10 Push-Up\n  - 10 Air Squat');
    eq(cues.length, 6);
    eq(cues.map((c) => c.rounds[0].round), [1, 1, 2, 2, 3, 3]);
    eq(cues[0].rounds[0].of, 3);
  });

  it('keeps a rest between rounds out of the last one', () => {
    const { cues } = r('3 sets:\n  - 5 Back Squat @ 225lb\n  rest 3min');
    eq(cues.filter((c) => c.kind === 'rest').length, 2, 'no rest after the final set');
  });

  it('does not invent a round count for an AMRAP', () => {
    const { cues, loops, window } = r('AMRAP 20min:\n  - 10 Push-Up\n  - 15 Air Squat');
    eq(cues.length, 2, 'one pass');
    eq(loops, true, 'and start again at the end');
    eq(window, 1200);
  });

  it('will lay an AMRAP out flat when asked', () => {
    const { cues, loops } = r('AMRAP 20min:\n  - 10 Push-Up', { unboundedRounds: 4 });
    eq(cues.length, 4);
    eq(loops, false);
  });

  it('stops rather than expanding without bound', () => {
    const { cues, warnings } = r('100 rounds:\n  - 10 Push-Up\n  - 10 Air Squat', { maxCues: 20 });
    ok(cues.length <= 20 + 2, `${cues.length} cues`);
    ok(warnings.some((w) => w.includes('truncated')), warnings.join('; '));
  });
});

describe('run: the source line a cursor points at', () => {
  it('points every cue at the line it was written on', () => {
    const src = '# Two things\nsequence:\n  - 10 Push-Up\n  - 10 Air Squat\n';
    const lines = src.split('\n');
    for (const c of r(src).cues) {
      ok(c.line !== undefined, `${c.label} has no line`);
      ok(lines[c.line! - 1].includes(c.movement!), `line ${c.line} is "${lines[c.line! - 1]}"`);
    }
  });

  it('points all three tiers of a rep scheme at the one line that was written', () => {
    // The reader is looking at `21-15-9`, not at tier two of it.
    const { cues } = r('21-15-9:\n  - Thruster @ 95lb\n  - Pull-Up');
    eq(cues.length, 6);
    const thrusters = cues.filter((c) => c.movement === 'Thruster');
    eq(new Set(thrusters.map((c) => c.line)).size, 1, 'one line for all three tiers');
    eq(thrusters.map((c) => (c.quantity as { value: number }).value), [21, 15, 9]);
  });

  it('points every round of a repeat at the same lines', () => {
    const { cues } = r('3 rounds:\n  - 10 Push-Up\n  - 10 Air Squat');
    eq(cues.filter((c) => c.movement === 'Push-Up').map((c) => c.line), [2, 2, 2]);
  });

  it('gives a rest its own line', () => {
    const { cues } = r('2 sets:\n  - 5 Back Squat\n  rest 3min');
    const rest = cues.find((c) => c.kind === 'rest')!;
    eq(rest.line, 3);
  });
});

describe('run: what a display shows', () => {
  it('says which cues end by themselves and which wait', () => {
    const { cues } = r('sequence:\n  - 2min Row\n  - 10 Push-Up');
    eq(cues[0].pacing, 'timed');
    eq(cues[0].seconds, 120);
    eq(cues[1].pacing, 'athlete', 'ten push-ups end when they end');
  });

  it('reads a round out loud', () => {
    const { cues } = r('3 rounds:\n  - 10 Push-Up');
    eq(roundLabel(cues[1].rounds), 'round 2/3');
  });

  it('says nothing about a block that runs once', () => {
    const { cues } = r('sequence:\n  - 10 Push-Up');
    eq(roundLabel(cues[0].rounds), '');
  });

  it('does not call the first pass of an AMRAP "round 1"', () => {
    // An AMRAP has no rounds until you have done some, and counting those is
    // the runtime's job. Saying "round 1" is noise on every cue.
    eq(roundLabel(r('AMRAP 20min:\n  - 10 Push-Up').cues[0].rounds), '');
    // Laid out flat, the rounds are real and worth naming.
    const flat = r('AMRAP 20min:\n  - 10 Push-Up', { unboundedRounds: 3 });
    eq(roundLabel(flat.cues[1].rounds), 'round 2');
  });

  it('totals a workout that is entirely on the clock', () => {
    eq(r('sequence:\n  - 2min Row\n  - 1min Bike').totalSeconds, 180);
  });

  it('lays out every corpus workout, and every cue in them knows its line', () => {
    // The point is the walk, not the numbers: nothing in 190 real workouts
    // should produce a structure that cannot be laid out, or a cue a cursor
    // cannot point at.
    let checked = 0, cues = 0, orphaned = 0;
    for (const f of readdirSync(corpus).filter((x) => x.endsWith('.wdl'))) {
      const src = readFileSync(join(corpus, f), 'utf8');
      const total = src.split('\n').length;
      for (const c of r(src).cues) {
        cues++;
        if (c.line === undefined || c.line < 1 || c.line > total) orphaned++;
      }
      checked++;
    }
    ok(checked > 150, `${checked} workouts`);
    ok(cues > 1000, `${cues} cues`);
    eq(orphaned, 0, 'cues pointing at no line in their own file');
  });
});
