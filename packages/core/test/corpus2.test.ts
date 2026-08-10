/**
 * Structures found by expanding the corpus from 40 to 110 workouts.
 * Each was a silent mis-parse or an outright failure before it was fixed.
 */
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { format } from '../src/format.ts';
import { validate } from '../src/validate.ts';
import { compile } from '../src/timeline.ts';
import type { Block, Step, Rest } from '../src/ast.ts';

const one = (src: string) => parse(src).workout;
const firstStep = (src: string): Step => (one(src).body[0] as Block).children[0] as Step;
const canon = (src: string) => format(one(src)).trim();

describe('corpus round two', () => {
  it('reads `2min max Push-Up` as a timed step measuring reps', () => {
    const s = firstStep('sequence:\n  - 2min max Push-Up');
    eq(s.quantity, { kind: 'duration', seconds: 120 });
    eq(s.movement, 'Push-Up');
    eq(s.measures, 'reps');
    ok(s.flags.includes('max'), 'the max is retained');
  });

  it('treats an unclocked `max` as athlete-paced, not a remainder', () => {
    // Lynne: 5 rounds of max bench and max pull-ups. Nothing bounds them.
    const t = compile(one('5 rounds:\n  - max Pull-Up'));
    const g = t.root.items[0] as any;
    eq(g.items[0].pacing, 'athlete');
    // Inside a clock the same step is a remainder, and therefore timed.
    const t2 = compile(one('every 3min x 5:\n  - 400m Run\n  - max Pull-Up'));
    eq((t2.root.items[0] as any).items[1].pacing, 'timed');
  });

  it('parses a bodybuilding rep range and keeps it through canonical form', () => {
    eq(canon('4 sets:\n  - 8-12 Dumbbell Curl each arm @ 2x35lb'),
       '4 sets:\n  - 8-12 Dumbbell Curl each arm @ 2x35lb');
  });

  it('peels a qualifier that sits before the target, not only after', () => {
    const s = firstStep('4 sets:\n  - 10 Dumbbell Curl each arm @ 2x35lb');
    eq(s.movement, 'Dumbbell Curl');
    eq(s.laterality, 'per-side');
    eq(s.limb, 'arm');
  });

  it('supports a duration-bounded block that is not an AMRAP', () => {
    // Cooper test: run as far as you can in 12 minutes.
    const w = one('for 12min:\n  - max Run\nscore: distance');
    const b = w.body[0] as Block;
    eq(b.duration, { kind: 'duration', seconds: 720 });
    eq(canon('for 12min:\n  - max Run\nscore: distance'), 'for 12min:\n  - max Run\n\nscore: distance');
  });

  it('accepts active recovery as a rest interval', () => {
    const r = (one('10 rounds:\n  - 800m Run\n  rest 400m Jog').body[0] as Block).children[1] as Rest;
    eq(r.active, { quantity: { kind: 'distance', value: 400, unit: 'm' }, movement: 'Jog' });
  });

  it('lets an enclosing cap supply an AMRAP window', () => {
    // Tiff: 25-minute clock — run 1.5 miles, then AMRAP in the time left.
    const src = 'for time, cap 25min:\n  - 1.5mi Run\n  AMRAP:\n    - 11 Chest-to-Bar Pull-Up';
    eq(validate(one(src)).filter((d) => d.severity === 'error'), []);
    // The same block with nothing to take a window from is an error.
    ok(validate(one('AMRAP:\n  - 10 Burpee')).some((d) => d.code === 'amrap-no-duration'));
  });

  it('accepts any nRM as a load reference, not just 1RM', () => {
    for (const rm of ['1RM', '3RM', '5RM']) {
      eq(validate(one(`5 sets:\n  - 5 Back Squat @ 90% ${rm}`))
        .filter((d) => d.code === 'unknown-reference'), [], rm);
    }
  });

  it('never crashes formatting a block with no duration', () => {
    for (const src of ['AMRAP:\n  - 10 Burpee', 'for time, cap 20min:\n  AMRAP:\n    - 5 Burpee']) {
      ok(format(one(src)).length > 0, src);
    }
  });
});

describe('paired and pyramid rep schemes', () => {
  const sch = (h: string) => (parse(`for time:\n  ${h}:\n    - Burpee`).workout.body[0] as Block).children[0] as any;

  it('expands a run into every tier', () => {
    eq(sch('1..10').scheme, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    eq(sch('10..1').scheme, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it('expands a pyramid through its turning point', () => {
    // Open 22.2 is 1 up to 10 and back down, without repeating the 10.
    eq(sch('1..10..1').scheme.length, 19);
    eq(sch('1..10..1').scheme.slice(8, 12), [9, 10, 9, 8]);
  });

  it('leaves a non-contiguous scheme explicit in canonical output', () => {
    for (const h of ['21-15-9', '50-40-30-20-10', '30-25-20-15-10-5', '9-7-5']) {
      ok(format(parse(`for time:\n  ${h}:\n    - Burpee`).workout).includes(`${h}:`), h);
    }
  });

  it('collapses a contiguous scheme to a run', () => {
    ok(format(parse('for time:\n  10-9-8-7-6-5-4-3-2-1:\n    - Burpee').workout).includes('10..1:'));
  });

  it('gives a reversed step the mirrored tier', () => {
    // J.J.: 1 squat clean paired with 10 push-ups, then 2 with 9.
    const t = compile(parse('for time:\n  1..10:\n    - Squat Clean @ 185lb\n' +
                            '    - Parallette Handstand Push-Up, reversed').workout);
    // root -> for-time group -> ladder group -> one group per tier -> steps
    const ladder = (t.root.items[0] as any).items[0];
    const pair = (i: number) => ladder.items[i].items.map((s: any) => s.quantity.value);
    eq(pair(0), [1, 10]);
    eq(pair(1), [2, 9]);
    eq(pair(9), [10, 1]);
  });

  it('round-trips a reversed step', () => {
    const src = 'for time:\n  10..1:\n    - Burpee\n    - Sit-Up, reversed';
    eq(format(parse(src).workout).trim(), src);
  });
});

describe('scheme units', () => {
  const ladder = (h: string) => (parse(`sequence:\n  ${h}:\n    - Row`).workout.body[0] as Block).children[0] as any;

  it('counts reps unless the scheme says otherwise', () => {
    eq(ladder('21-15-9').schemeUnit, undefined);
  });

  it('accepts distance, duration, and calorie schemes', () => {
    eq(ladder('250-500-750 m').schemeUnit, 'm');
    eq(ladder('1..5..1 min').schemeUnit, 'min');
    eq(ladder('10-20-30 cal').schemeUnit, 'cal');
  });

  it('builds the right quantity for each tier', () => {
    const t = compile(parse('1..3 min:\n  - Run').workout);
    const rounds = (t.root.items[0] as any).items;
    eq(rounds.map((r: any) => r.items[0].quantity),
       [60, 120, 180].map((seconds) => ({ kind: 'duration', seconds })));
  });

  it('round-trips a scheme unit', () => {
    for (const src of ['250-500-750 m:\n  - Row', '1..5..1 min:\n  - Run']) {
      eq(format(parse(src).workout).trim(), src);
    }
  });
});
