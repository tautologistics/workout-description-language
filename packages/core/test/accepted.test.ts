/**
 * Forgiving input, strict output (spec §1 rule 2).
 *
 * Each case is a spelling the spec claims to accept, paired with the canonical
 * text it must produce. This is the half of the conformance suite that pins
 * down what "accepted" actually means for a third-party implementation.
 */
import { describe, it, eq } from './lib.ts';
import { parse } from '../src/parse.ts';
import { format } from '../src/format.ts';

const cases: [string, string][] = [
  ['AMRAP 12m:\n  - 10 Wall Ball @ 20lb',      'AMRAP 12min:\n  - 10 Wall Ball @ 20lb'],
  ['amrap 12:\n  - 10 Burpee',                 'AMRAP 12min:\n  - 10 Burpee'],
  ['EMOM 10:\n  - 5 Power Clean @ 155 lbs',    'EMOM 10min:\n  - 5 Power Clean @ 155lb'],
  ['for time:\n  - 400 meters Run',            'for time:\n  - 400m Run'],
  ['for time:\n  - 1 mile Run',                'for time:\n  - 1mi Run'],
  ['for time:\n  - 15 calories Row',           'for time:\n  - 15cal Row'],
  ['for time:\n  - 30 Clean & Jerk @ 135#',    'for time:\n  - 30 Clean & Jerk @ 135lb'],
  ['for time:\n  - 20 Box Jump @ 24"',         'for time:\n  - 20 Box Jump @ 24in'],
  ['5 sets:\n  - 5 Back Squat @ 225lb\n  rest 3 m',
   '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 3min'],
  ['AMRAP 20min:\n  - 10 alternating DB Snatch @ 50lb',
   'AMRAP 20min:\n  - 10 DB Snatch (split) @ 50lb, alternating'],
  ['AMRAP 20min:\n  - 10 DB Snatch (total) @ 50lb',
   'AMRAP 20min:\n  - 10 DB Snatch (split) @ 50lb'],
  ['3 rounds for time:\n  - 1min30s Plank',    '3 rounds for time:\n  - 1min30s Plank'],
  ['3 rounds for time:\n  - 1:30 Plank',       '3 rounds for time:\n  - 1min30s Plank'],
];

describe('accepted input', () => {
  for (const [input, want] of cases) {
    it(input.replace(/\n/g, ' ⏎ '), () => {
      const { workout, errors } = parse(input);
      eq(errors.map((e) => e.message), []);
      eq(format(workout).trim(), want);
    });
  }
});
