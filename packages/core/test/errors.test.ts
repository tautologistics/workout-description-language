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
