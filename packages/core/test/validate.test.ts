/** Semantic validation — the layer that decides whether a file means anything. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { validate } from '../src/validate.ts';
import { Registry } from '../src/fold.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/corpus');
const check = (src: string, opts = {}) => validate(parse(src).workout, opts);
const codes = (src: string, opts = {}) => check(src, opts).map((d) => d.code);
const find = (src: string, code: string) => check(src).find((d) => d.code === code);

describe('validation: errors', () => {
  it('rejects an AMRAP with no duration', () => {
    ok(codes('AMRAP:\n  - 10 Burpee').includes('amrap-no-duration'));
  });

  it('rejects zero or negative repetitions', () => {
    ok(codes('for time:\n  - 0 Burpee').includes('non-positive-reps'));
    ok(codes('for time:\n  - 0m Run').includes('non-positive-distance'));
  });

  it('rejects a clock-driven block with no bound', () => {
    ok(codes('every 2min:\n  - 5 Burpee').includes('clock-unbounded'));
  });

  it('rejects an empty or non-positive rep scheme', () => {
    ok(codes('for time:\n  0-5-9:\n    - Thruster').includes('bad-scheme'));
  });

  it('rejects rounds + reps on fixed work', () => {
    ok(codes('5 rounds:\n  - 10 Burpee\nscore: rounds + reps').includes('rounds-score-on-fixed-work'));
    eq(codes('AMRAP 10min:\n  - 10 Burpee\nscore: rounds + reps').includes('rounds-score-on-fixed-work'), false);
  });

  it('rejects a per-side count on a movement that is not unilateral', () => {
    ok(codes('for time:\n  - 10 Back Squat each leg').includes('bad-counting-mode'));
  });
});

describe('validation: questions', () => {
  it('asks which reading 95/65 means rather than picking one', () => {
    const d = find('for time:\n  - 21 Thruster @ 95/65', 'ambiguous-load-split')!;
    eq(d.severity, 'question');
    eq(d.candidates, ['men / women', 'Rx / scaled', 'two separate loads']);
  });

  it('asks which erg is meant when an alias is shared', () => {
    const reg = new Registry([
      { id: 'row', title: 'Row', aliases: ['erg'] },
      { id: 'ski-erg', title: 'SkiErg', aliases: ['erg'] },
    ]);
    const d = check('for time:\n  - 1000m Erg', { registry: reg })
      .find((x) => x.code === 'ambiguous-movement')!;
    eq(d.severity, 'question');
    eq(d.candidates, ['Row', 'SkiErg']);
  });

  it('asks whether a paired load is each or total', () => {
    const d = find('for time:\n  - 200m Farmers Carry @ 24kg', 'implement-arity')!;
    eq(d.severity, 'question');
    ok(d.candidates!.some((c) => c.includes('each')), d.candidates?.join(' / '));
  });

  it('asks for a counting mode only when the registry declares no default', () => {
    const undecided = new Registry([
      { id: 'db-curl', title: 'DB Curl', laterality: ['both', 'split', 'per-side'] },
    ]);
    ok(check('for time:\n  - 14 DB Curl', { registry: undecided })
      .some((d) => d.code === 'counting-mode' && d.severity === 'question'));

    const decided = new Registry([
      { id: 'db-curl', title: 'DB Curl', laterality: ['both', 'split'], defaultLaterality: 'split' },
    ]);
    eq(check('for time:\n  - 14 DB Curl', { registry: decided })
      .some((d) => d.code === 'counting-mode'), false, 'a stated convention is not a guess');
  });
});

describe('validation: warnings', () => {
  it('warns when a percentage has no reference max', () => {
    ok(codes('5 sets:\n  - 3 Back Squat @ 85%').includes('percent-no-reference'));
    eq(codes('5 sets:\n  - 3 Back Squat @ 85% 1RM').includes('percent-no-reference'), false);
  });

  it('warns when a reference is neither a profile value nor a block label', () => {
    ok(codes('5 sets:\n  - 3 Back Squat @ 85% of mystery').includes('unknown-reference'));
  });

  it('accepts a reference to a label defined later in the workout', () => {
    const src = 'build to a heavy single in 12min as heavy-single:\n  - 1 Back Squat\n' +
                '3 sets:\n  - 3 Back Squat @ 85% of heavy-single';
    eq(codes(src).includes('unknown-reference'), false);
  });

  it('warns when calories are asked of something with no readout', () => {
    ok(codes('for time:\n  - 15cal Thruster @ 95lb').includes('no-calorie-readout'));
    eq(codes('for time:\n  - 15cal Row').includes('no-calorie-readout'), false);
  });

  it('warns when a rep scheme has no effect', () => {
    ok(codes('for time:\n  21-15-9:\n    - 10 Thruster @ 95lb').includes('scheme-unused'));
  });

  it('says nothing about an unregistered movement', () => {
    eq(codes('for time:\n  - 20 Sandbag Bear Hug Carry'), []);
  });
});

describe('validation: corpus', () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.wdl')).sort()) {
    it(f, () => {
      const d = validate(parse(readFileSync(join(dir, f), 'utf8')).workout);
      eq(d.map((x) => `${x.severity}:${x.code}@${x.line}`), [], 'corpus must validate clean');
    });
  }
});

describe('validation: nesting', () => {
  it('finds an open-ended block however deeply it is nested', () => {
    // `3 rounds: AMRAP 5min: … rest 5min` scores rounds+reps per interval.
    // Searching only the top level wrongly rejected it.
    const src = '3 rounds:\n  AMRAP 5min:\n    - 10 Wall Ball @ 20lb\n  rest 5min\n' +
                'score: rounds + reps per round';
    eq(codes(src).includes('rounds-score-on-fixed-work'), false);
  });

  it('still rejects a rounds score with no open-ended block anywhere', () => {
    ok(codes('3 rounds:\n  5 sets:\n    - 10 Burpee\nscore: rounds + reps')
      .includes('rounds-score-on-fixed-work'));
  });
});
