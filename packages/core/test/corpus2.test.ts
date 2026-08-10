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
