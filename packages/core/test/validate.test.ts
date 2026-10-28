/** Semantic validation — the layer that decides whether a file means anything. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { validate, errorsOnly } from '../src/validate.ts';
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

  it('rejects a -N each round countdown that reaches zero', () => {
    ok(!codes('8 rounds for time:\n  - 8 Jump Squat, -1 each round').includes('per-round-below-one'));
    ok(codes('9 rounds for time:\n  - 8 Jump Squat, -1 each round').includes('per-round-below-one'));
    ok(codes('for time:\n  1..5:\n    - 6 Push-Up, -2 each round').includes('per-round-below-one'));
    ok(!codes('9 rounds:\n  - 1 Burpee, +1 each round').includes('per-round-below-one'));
  });

  it('rejects a clock-driven block with no bound', () => {
    ok(codes('every 2min:\n  - 5 Burpee').includes('clock-unbounded'));
  });

  it('rejects an empty or non-positive rep scheme', () => {
    ok(codes('for time:\n  0-5-9:\n    - Thruster').includes('bad-scheme'));
  });

  /**
   * A score names what to rank by, and both spellings that can leave it unnamed
   * are here. The brace form used to make the *whole brace text* the primary,
   * which is not a thing anything can rank by and which also emitted the tiebreak
   * twice; a bare `score:` gets it from `scoreLine`'s empty spec.
   *
   * Held rather than refused, deliberately — an absent field is absent, the
   * fields the author *did* write survive and round-trip, and the complaint is
   * made here rather than in the grammar, because "names nothing to rank by" is a
   * statement about a value in the same way `min < max` on a rep range is.
   */
  it('rejects a score that names nothing to rank by', () => {
    ok(codes('for time:\n  - 100 Burpee\nscore: {tiebreak: reps at 5min}')
      .includes('score-without-primary'));
    ok(codes('for time:\n  - 100 Burpee\nscore:').includes('score-without-primary'));
    // And the tiebreak the author wrote is kept, not thrown away with the
    // complaint — the whole point of holding an incomplete score.
    eq(parse('for time:\n  - 100 Burpee\nscore: {tiebreak: reps at 5min}').workout.score?.tiebreak,
      'reps at 5min');
    // A named primary is not complained about, whichever spelling names it.
    eq(codes('for time:\n  - 100 Burpee\nscore: {primary: time, tiebreak: reps at 5min}')
      .includes('score-without-primary'), false);
    eq(codes('for time:\n  - 100 Burpee\nscore: time').includes('score-without-primary'), false);
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

  it('asks about a slash load on a header, not only on a step', () => {
    // A header's target is inherited by every child, so the question is about
    // all of them. Until 2026-08-18 only a step's own targets were checked, and
    // `3 rounds @ 95/65:` — the block-level spelling of an rx split — went
    // through silently while the step-level one asked.
    const d = find('3 rounds @ 95/65:\n  - 10 Thruster', 'ambiguous-load-split')!;
    eq(d.severity, 'question');
    eq(d.line, 1);
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
  /**
   * `- 8..1 Jump Squats` used to fold the run into the movement name and pass
   * `wdl check` with nothing said. Now it is held, the name is left clean, and
   * the warning offers the spellings that do read.
   */
  it('warns when a rep scheme is written where a step count goes', () => {
    const src = '8 rounds for time:\n  - 8..1 Jump Squat\n  - 21-15-9 Thruster\n  - 8-12 Curl';
    const steps = (parse(src).workout.body[0] as { children: { movement: string; quantity: { kind: string } }[] }).children;
    eq(steps.map((x) => x.movement), ['Jump Squat', 'Thruster', 'Curl']);
    eq(steps.map((x) => x.quantity.kind), ['open', 'open', 'range']);
    const d = validate(parse(src).workout).filter((x) => x.code === 'step-rep-scheme');
    eq(d.map((x) => x.line), [2, 3]);
    ok(d[0].message.includes('`8 Jump Squat, -1 each round`'), d[0].message);
    ok(!validate(parse('5 rounds:\n  - 1..5..1 Pull-Up').workout)[0].message.includes('each round'),
      'a pyramid gets the block form only');
    ok(!codes('5 rounds:\n  - 100-150ft Farmers Carry').includes('step-rep-scheme'), 'a unit range stays a note');
  });

  it('warns that a countdown with no round limit runs out', () => {
    ok(codes('AMRAP 12min:\n  - 10 Burpee, -2 each round').includes('per-round-unbounded-descent'));
    ok(!codes('AMRAP 12min:\n  - 10 Burpee, +2 each round').includes('per-round-unbounded-descent'));
  });

  it('warns when a percentage has no reference max', () => {
    ok(codes('5 sets:\n  - 3 Back Squat @ 85%').includes('percent-no-reference'));
    eq(codes('5 sets:\n  - 3 Back Squat @ 85% 1RM').includes('percent-no-reference'), false);
    // On a header too: an inherited target reaches every child, so a reference
    // missing there is missing for all of them.
    ok(codes('3 rounds @ 75%:\n  - 5 Back Squat').includes('percent-no-reference'));
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

/**
 * The fourth severity, and the decision behind it (queue item 0d, 2026-08-15).
 *
 * Unknown text is *held* and *inert* — and held-and-inert must not also mean
 * silent. `10 Thruster, unbrokn` is one keystroke from a constraint that decides
 * whether a set counts, and a person writing on a whiteboard is worse off being
 * told nothing than being told. But the framing this language is built to is
 * explicit that unknown is "not an error and not a guess", so it is not reported
 * as one: `note` claims nothing about whether the line is right.
 */
describe('validation: notes', () => {
  it('says what it did not read, at a severity that claims nothing', () => {
    const d = check('for time:\n  - 10 Thruster, unbrokn')[0];
    eq(d.severity, 'note');
    eq(d.code, 'unrecognized-text');
    ok(d.message.includes('unbrokn'), d.message);
    eq(d.line, 2);
  });

  it('says the same about a header modifier', () => {
    const d = check('3 rounds, unbrokn:\n  - 10 Push-Up')[0];
    eq(d.severity, 'note');
    eq(d.code, 'unrecognized-text');
    eq(d.line, 1);
  });

  it('says nothing about an authored note, or about prose it reads', () => {
    eq(codes('for time:\n  - 10 Thruster, note: "keep the elbows up"'), []);
    eq(codes('for time:\n  - 10min Bike, ramp 50% -> 75% FTP'), []);
    eq(codes('for time:\n  - 10 Thruster, unbroken'), [], 'the keyword spelled right');
  });

  /**
   * A bare custom label read as a section (queue item 11). The eight fixed
   * section words are silent — a closed vocabulary — but a word the author
   * coined could be a typo, so held-and-inert must not be silent here either.
   */
  it('says it read a bare label as a section, and stays quiet on the fixed eight', () => {
    const d = check('3 rounds for time:\n  - Barbell movements:\n      - 10 Deadlift @ 185lb')
      .find((x) => x.code === 'custom-section')!;
    eq(d.severity, 'note');
    ok(d.message.includes('Barbell movements'), d.message);
    eq(d.line, 2);
    eq(codes('conditioning:\n  - 10 Push-Up').filter((c) => c === 'custom-section'), []);
    eq(codes('Cool-Down:\n  - 5min Bike').filter((c) => c === 'custom-section'), [], 'case-folded match');
  });

  it('a custom-section note is not an error and does not gate a workout', () => {
    const d = check('for time:\n  - my finisher:\n      - 20 Burpee');
    eq(errorsOnly(d), []);
    eq(d.filter((x) => x.severity === 'warning' || x.severity === 'question'), []);
  });

  /**
   * A note is not a defect, and nothing that gates on errors may start gating on
   * this. The board filters to errors and `wdl check` fails on errors; both would
   * be wrong to refuse a workout over a phrase somebody wrote in the margin.
   */
  it('is not an error, and does not make a workout invalid', () => {
    const d = check('for time:\n  - 10 Thruster, unbrokn');
    eq(errorsOnly(d), []);
    eq(d.filter((x) => x.severity === 'warning' || x.severity === 'question'), []);
  });
});

/**
 * Text in the corpus that the language does not read, listed rather than
 * tolerated.
 *
 * A `note` diagnostic is not a defect — these four lines are deliberate prose
 * about equipment and strategy that WDL models nothing of, and the point of
 * holding unknown text is that writing it is *allowed*. So the corpus check
 * below asks for no error, warning or question, and the notes are pinned here
 * instead: a fifth line that stops being read, or one of these four starting to
 * be, shows up as a diff rather than as silence.
 */
const CORPUS_UNREAD: Record<string, string[]> = {
  '120-blake.wdl': ['45lb plate overhead'],
  '121-white.wdl': ['45lb plate overhead'],
  '183-accumulate.wdl': ['accumulate across as many sets as needed'],
  '82-hidalgo.wdl': ['45lb plate overhead'],
};

describe('validation: corpus', () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.wdl')).sort()) {
    it(f, () => {
      const d = validate(parse(readFileSync(join(dir, f), 'utf8')).workout);
      eq(d.filter((x) => x.severity !== 'note').map((x) => `${x.severity}:${x.code}@${x.line}`),
        [], 'corpus must validate clean');
      const unread = d.filter((x) => x.code === 'unrecognized-text')
        .map((x) => x.message.replace(/^`(.*?)` is not.*$/, '$1'));
      eq(unread, CORPUS_UNREAD[f] ?? [], 'text the language does not read');
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
