/** Phase 1 in isolation — it should know about indentation and nothing else. */
import { describe, it, eq, ok } from './lib.ts';
import { readLines, splitTopLevel, expandInline } from '../src/lines.ts';

describe('lines', () => {
  it('nests by indentation', () => {
    const r = readLines('a:\n  b:\n    c\n  d\ne');
    eq(r.map((x) => x.text), ['a:', 'e']);
    eq(r[0].children.map((x) => x.text), ['b:', 'd']);
    eq(r[0].children[0].children.map((x) => x.text), ['c']);
  });

  it('records 1-based source lines', () => {
    const r = readLines('\n\na:\n  b');
    eq(r[0].line, 3);
    eq(r[0].children[0].line, 4);
  });

  it('ignores blank lines when nesting', () => {
    const r = readLines('a:\n\n  b\n\n  c');
    eq(r[0].children.map((x) => x.text), ['b', 'c']);
  });

  it('attaches own-line comments to the line below', () => {
    const r = readLines('// note\na:\n  b');
    eq(r[0].comments, ['note']);
  });

  it('attaches trailing comments to their own line', () => {
    const r = readLines('a: // why');
    eq(r[0].text, 'a:');
    eq(r[0].comments, ['why']);
  });

  it('does not treat // inside a quoted string as a comment', () => {
    const r = readLines('- 10 Burpee, note: "a // b"');
    eq(r[0].text, '- 10 Burpee, note: "a // b"');
    eq(r[0].comments, []);
  });

  it('joins continuation lines while braces are unbalanced', () => {
    const r = readLines('v:\n  women: { a: 1,\n           b: 2 }');
    eq(r[0].children.length, 1);
    ok(r[0].children[0].text.includes('b: 2 }'), r[0].children[0].text);
  });

  it('splits only at the top level', () => {
    eq(splitTopLevel('a, b { c, d }, e', ','), ['a', 'b { c, d }', 'e']);
    eq(splitTopLevel('a, "b, c", d', ','), ['a', '"b, c"', 'd']);
  });

  it('expands the inline brace form into head, body, and tail', () => {
    const r = readLines('8 rounds: { work 20s: Pull-Up, rest 10s }  score: min per round');
    const { head, inline, tail } = expandInline(r[0]);
    eq(head, '8 rounds:');
    eq(inline!.map((x) => x.text), ['work 20s: Pull-Up', 'rest 10s']);
    eq(tail, 'score: min per round');
  });
});
