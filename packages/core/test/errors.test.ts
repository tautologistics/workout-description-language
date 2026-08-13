/**
 * Negative cases. What the parser rejects today is thin — semantic validation
 * (spec §12, the never-guess rule) is the next layer and is not built. The
 * `pending` entries below keep that gap visible in the suite rather than
 * letting silence imply coverage.
 */
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';

const errs = (src: string) => parse(src).errors;

describe('errors', () => {
  it('rejects an unrecognized block header', () => {
    const e = errs('frobnicate 5:\n  - 10 Burpee');
    eq(e.length, 1);
    ok(/unrecognized block header/.test(e[0].message), e[0]?.message);
    eq(e[0].line, 1);
  });

  it('rejects an unreadable rest duration', () => {
    const e = errs('5 sets:\n  - 5 Back Squat\n  rest banana');
    eq(e.length, 1);
    ok(/unreadable rest duration/.test(e[0].message), e[0]?.message);
    eq(e[0].line, 3);
  });

  it('reports the source line for every error', () => {
    const e = errs('# T\n\n\nfrobnicate:\n  - 1 Burpee');
    eq(e[0].line, 4);
  });

  it('still produces a usable AST alongside errors', () => {
    const { workout, errors } = parse('frobnicate:\n  - 10 Burpee');
    ok(errors.length, 'errored');
    ok(workout.body.length === 1, 'body survived');
  });

  it('accepts an unregistered movement without complaint', () => {
    const { workout, errors } = parse('for time:\n  - 20 Sandbag Bear Hug Carry');
    eq(errors.length, 0);
    eq((workout.body[0] as any).children[0].movement, 'Sandbag Bear Hug Carry');
  });

  it('does not silently drop unknown qualifiers', () => {
    const { workout } = parse('for time:\n  - 10 Thruster @ 95lb, wearing a hat');
    eq((workout.body[0] as any).children[0].notes, ['wearing a hat']);
  });

  // The eight cases formerly pending here are now enforced in validate.test.ts.
});

describe('scoring a workout twice', () => {
  it('reports a second `score:` rather than keeping the last one', () => {
    // Silently overwriting sent the author to a validation error about a score
    // they had not chosen, with no hint their first line had been discarded.
    const { workout, errors } = parse('for time:\n  - 10 Burpees\nscore: time\nscore: rounds + reps\n');
    eq(workout.score?.primary, 'time', 'the one written first stands');
    eq(errors.length, 1);
    eq(errors[0].line, 4);
    ok(errors[0].message.includes('already scored by `time`'), errors[0].message);
    ok(errors[0].message.includes('tiebreak'), 'and says what to do instead');
  });

  it('leaves the two legitimate ways to score twice alone', () => {
    // A tiebreak is a second measure of the same workout...
    const tie = parse('for time:\n  - 10 Burpees\nscore: time\ntiebreak: rounds + reps\n');
    eq(tie.errors, []);
    eq(tie.workout.score?.tiebreak, 'rounds + reps');

    // ...and a nested block keeps its own, which is how a buy-in around an
    // AMRAP is scored by rounds inside and by total time overall.
    const nested = parse('for time:\n  - 800m Run\n  AMRAP 20min:\n    - 30 Air Squats\n  - 800m Run\nscore: time\n');
    eq(nested.errors, []);
    eq(nested.workout.score?.primary, 'time');
    const inner = (nested.workout.body[0] as any).children.find((c: any) => c.node === 'block');
    eq(inner.score.primary, 'rounds + reps');
  });
});

describe('a qualifier with nothing to qualify', () => {
  it('reports `tiebreak:` with no score rather than making it a movement', () => {
    // It used to fall through to the step grammar and become a movement called
    // `tiebreak: time + rounds` — which parsed, validated, and turned up in the
    // cue list as something to do.
    const { workout, errors } = parse('For time:\n  - 10 Burpees\ntiebreak: time + rounds\n');
    eq(workout.body.filter((n) => n.node === 'step').length, 0, 'not a step');
    eq(errors.length, 1);
    ok(errors[0].message.includes('no `score:` above it'), errors[0].message);
  });

  it('does the same for `on cap:`', () => {
    ok(parse('For time:\n  - 10 Burpees\non cap: reps\n').errors[0].message.includes('on cap'));
  });

  it('accepts either once there is a score to qualify', () => {
    const r = parse('For time:\n  - 10 Burpees\nscore: time\ntiebreak: rounds\n');
    eq(r.errors, []);
    eq(r.workout.score?.tiebreak, 'rounds');
  });
});
