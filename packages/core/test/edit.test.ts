/**
 * Structural edits on a workout file.
 *
 * The invariant these are all built around: an edit changes what was asked for
 * and nothing else. Move something down and back and you have the file you
 * started with, byte for byte — comments where they were, blank lines where they
 * were, and the meaning unchanged.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { format } from '../src/format.ts';
import {
  spans, move, moveTo, shift, remove, duplicate, insertAfter, logicalText, replaceLogical, logicalEnd,
} from '../src/edit.ts';

const L = (s: string) => s.replace(/\n$/, '').split('\n');
const T = (l: string[]) => `${l.join('\n')}\n`;
const corpus = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/corpus');

const NESTED = L(`# Nested
for time:
  // the buy-in
  sequence:
    - 800m Run

  21-15-9:
    - Thruster @ 95lb
    - Pull-Up

  // the cash-out
  sequence:
    - 800m Run
`);

describe('edit: what a thing occupies', () => {
  it('takes its contents with it', () => {
    const s = spans(NESTED).get(7)!;   // the 21-15-9 block
    eq(s.node.text, '21-15-9:');
    eq(NESTED.slice(s.from - 1, s.to), ['  21-15-9:', '    - Thruster @ 95lb', '    - Pull-Up', '']);
  });

  it('takes the comment written above it', () => {
    // Moving a block without its comment leaves the comment describing whatever
    // lands there instead, which is worse than losing it.
    const s = spans(NESTED).get(4)!;   // the buy-in sequence
    eq(s.from, 3, 'starts at the comment');
    eq(NESTED[s.from - 1].trim(), '// the buy-in');
  });

  it('leaves a comment at another indent to its own block', () => {
    const lines = L('for time:\n// about the workout\n  sequence:\n    - 10 Push-Up\n');
    eq(spans(lines).get(3)!.from, 3, 'the comment is outdented, so it is not this block’s');
  });

  it('joins a wrapped inline block into one logical line', () => {
    const lines = L('variants:\n  women: { a: 1kg,\n           b: 2kg }\n');
    eq(logicalEnd(lines, 2), 3);
    eq(logicalText(lines, 2), 'women: { a: 1kg, b: 2kg }');
  });
});

describe('edit: moving', () => {
  it('swaps two blocks, contents and all', () => {
    const out = move(NESTED, 7, -1);
    eq(out.slice(2, 6), ['  21-15-9:', '    - Thruster @ 95lb', '    - Pull-Up', '']);
    eq(out[6].trim(), '// the buy-in', 'the comment travelled with its block');
  });

  it('down and back again is the file you started with', () => {
    // Without the blank lines travelling too, spacing creeps a line per edit.
    // A move renumbers, so the way back is found by what the line says.
    const lineOf = (lines: string[], text: string) => lines.findIndex((l) => l.trim() === text) + 1;
    const there = move(NESTED, 7, -1);
    eq(move(there, lineOf(there, '21-15-9:'), 1), NESTED);
    const other = move(NESTED, 4, 1);
    eq(move(other, lineOf(other, 'sequence:'), -1), NESTED);
  });

  it('does nothing at the ends', () => {
    eq(move(NESTED, 4, -1), NESTED, 'nothing above it');
    eq(move(NESTED, 12, 1), NESTED, 'nothing below it');
  });

  it('will not move a thing past its parent', () => {
    // Siblings are siblings; a step inside one block has no business swapping
    // with a step inside another.
    const out = move(NESTED, 5, 1);
    eq(out, NESTED);
  });
});

describe('edit: indenting, duplicating, deleting', () => {
  it('re-indents a block with everything under it', () => {
    const out = shift(NESTED, 7, 2);
    eq(out.slice(6, 9), ['    21-15-9:', '      - Thruster @ 95lb', '      - Pull-Up']);
  });

  it('leaves blank lines unindented, since trailing spaces are not structure', () => {
    eq(shift(NESTED, 7, 2)[9], '');
  });

  it('refuses to outdent past the margin', () => {
    eq(shift(NESTED, 2, -2), NESTED);
  });

  it('refuses to indent a line with no preceding sibling to become its parent', () => {
    // Line 1 (the title) is the first line in the document — indenting it
    // would orphan it, a child with nothing above it to be a child of.
    eq(shift(NESTED, 1, 2), NESTED);
  });

  it('still refuses when the orphan would be a first child rather than the first line', () => {
    // Line 4 is the first child of `for time:` — no sibling above it either.
    eq(shift(NESTED, 4, 2), NESTED);
  });

  it('duplicates a block below itself', () => {
    const out = duplicate(NESTED, 7);
    eq(out.length, NESTED.length + 4);
    eq(out.slice(10, 13), ['  21-15-9:', '    - Thruster @ 95lb', '    - Pull-Up']);
  });

  it('deletes a block and its contents', () => {
    const out = remove(NESTED, 7);
    ok(!T(out).includes('Thruster'), T(out));
    ok(T(out).includes('the cash-out'), 'and nothing else');
  });

  it('never leaves nothing at all', () => {
    eq(remove(['- 10 Push-Up'], 1), ['']);
  });

  it('inserts at the indent of what it follows', () => {
    const out = insertAfter(NESTED, 5, '- 400m Run');
    eq(out[5], '    - 400m Run');
  });
});

describe('edit: a wrapped line is one line', () => {
  it('writes an edit over every physical line it spans', () => {
    // Writing back to only the first would silently drop the rest, which is the
    // worst kind of bug in an editor: it looks like it worked.
    const lines = L('variants:\n  women: { a: 1kg,\n           b: 2kg }\n  men: { a: 3kg }\n');
    const out = replaceLogical(lines, 2, 'women: { a: 9kg, b: 8kg }');
    eq(out, ['variants:', '  women: { a: 9kg, b: 8kg }', '  men: { a: 3kg }']);
  });
});

describe('edit: the round trip over the corpus', () => {
  it('touching every line changes nothing about what it means', () => {
    let checked = 0, touched = 0;
    const changed: string[] = [];
    for (const f of readdirSync(corpus).filter((x) => x.endsWith('.wdl'))) {
      const src = readFileSync(join(corpus, f), 'utf8');
      let lines = L(src);
      for (const [line] of spans(lines)) {
        lines = replaceLogical(lines, line, logicalText(lines, line));
        touched++;
      }
      if (format(parse(T(lines)).workout) !== format(parse(src).workout)) changed.push(f);
      checked++;
    }
    ok(checked > 150, `${checked} workouts`);
    ok(touched > 1000, `${touched} lines`);
    eq(changed, [], 'workouts whose meaning a no-op edit changed');
  });

  it('moves the first block of every corpus workout down and back', () => {
    const changed: string[] = [];
    for (const f of readdirSync(corpus).filter((x) => x.endsWith('.wdl'))) {
      const lines = L(readFileSync(join(corpus, f), 'utf8'));
      const top = [...spans(lines).values()].filter((s) => s.siblings === [...spans(lines).values()][0].siblings);
      if (top.length < 2) continue;
      const there = move(lines, top[0].node.line, 1);
      const back = move(there, top[0].node.line, -1);
      if (T(back) !== T(lines)) changed.push(f);
    }
    eq(changed, [], 'workouts a move-and-move-back did not restore');
  });
});

describe('edit: comment lines are addressable', () => {
  const DOC = L(`# Comments
for time:
  // the buy-in
  - 800m Run
  - 21 Thrusters
  // a note on the thrusters, on its own line
  - 21 Pull-Ups
// trailing at end of file
`);

  it('gives every own-line comment its own single-line span', () => {
    const s = spans(DOC).get(3)!;
    eq([s.from, s.to, s.contentEnd], [3, 3, 3], 'just the one line');
    eq(s.node.text, '// the buy-in');
    ok(spans(DOC).has(6), 'a comment between two steps');
    ok(spans(DOC).has(8), 'the end-of-file trailing comment');
  });

  it('still lets the following node swallow the comment written above it', () => {
    // The dual reading: line 3 is its own span *and* inside line 4's span, so a
    // move of the run still carries its buy-in comment.
    eq(spans(DOC).get(4)!.from, 3, 'the run’s span starts at its comment');
  });

  it('edits a comment in place, keeping its indent', () => {
    eq(replaceLogical(DOC, 3, '// the warm-up')[2], '  // the warm-up');
  });

  it('deletes exactly the comment line', () => {
    const out = remove(DOC, 6);
    ok(!T(out).includes('a note on the thrusters'), T(out));
    ok(T(out).includes('21 Thrusters') && T(out).includes('21 Pull-Ups'), 'and nothing else');
  });

  it('inserts after a comment at the comment’s indent', () => {
    eq(insertAfter(DOC, 3, '- 400m Row')[3], '  - 400m Row');
  });

  it('moves a comment down past the next step', () => {
    const out = move(DOC, 6, 1);
    eq(out.slice(4, 7), ['  - 21 Thrusters', '  - 21 Pull-Ups', '  // a note on the thrusters, on its own line']);
  });

  it('moves a comment up past the step above it', () => {
    const out = move(DOC, 6, -1);
    eq(out.slice(3, 6), ['  - 800m Run', '  // a note on the thrusters, on its own line', '  - 21 Thrusters']);
  });

  it('down and back again is the file it started with', () => {
    const there = move(DOC, 6, 1);
    const commentAt = there.findIndex((l) => l.includes('a note on the thrusters')) + 1;
    eq(move(there, commentAt, -1), DOC);
  });

  it('swaps two adjacent comment lines', () => {
    const two = L('// first\n// second\n- 10 Push-Up\n');
    eq(move(two, 1, 1), ['// second', '// first', '- 10 Push-Up']);
    eq(move(move(two, 1, 1), 2, -1), two, 'and back');
  });

  it('moves a comment past a whole block, contents and all', () => {
    const src = L('// note\n5 rounds:\n  - 10 Push-Up\n  - 15 Air Squat\n- 400m Run\n');
    eq(move(src, 1, 1), ['5 rounds:', '  - 10 Push-Up', '  - 15 Air Squat', '// note', '- 400m Run']);
  });

  it('re-indents a comment and refuses to outdent past the margin', () => {
    eq(shift(DOC, 3, 2)[2], '    // the buy-in');
    eq(shift(DOC, 8, -2), DOC, 'already at the margin');
  });

  it('drags a comment onto another row, re-indenting to match', () => {
    const out = moveTo(DOC, 8, 4, 'after');   // the end-of-file comment, into the block
    eq(out.slice(3, 5), ['  - 800m Run', '  // trailing at end of file']);
    ok(!out[out.length - 1].includes('trailing'), 'no longer at the end');
  });

  it('drags a real step to sit after a comment row', () => {
    const out = moveTo(DOC, 5, 3, 'after');
    eq(out.slice(2, 4), ['  // the buy-in', '  - 21 Thrusters']);
  });
});

describe('moveTo: dragging a thing somewhere else', () => {
  const doc = [
    'for time:',
    '  // the couplet',
    '  - 21 Thrusters',
    '  - 21 Pull-Ups',
    '  - 9 Burpees',
  ];

  it('drops a thing after another, taking its comment with it', () => {
    const out = moveTo(doc, 3, 5, 'after');
    eq(out, ['for time:', '  - 21 Pull-Ups', '  - 9 Burpees', '  // the couplet', '  - 21 Thrusters']);
  });

  it('drops a thing before another', () => {
    eq(moveTo(doc, 5, 3, 'before'), ['for time:', '  - 9 Burpees', '  // the couplet', '  - 21 Thrusters', '  - 21 Pull-Ups']);
  });

  it('re-indents to match where it lands', () => {
    // Dragging a top-level step into a block has to nest it, or the drop
    // produces something that reads as a sibling of the block it is inside.
    const src = ['5 rounds:', '  - 10 Push-Ups', '- 400m Run'];
    eq(moveTo(src, 3, 2, 'after'), ['5 rounds:', '  - 10 Push-Ups', '  - 400m Run']);
    // And back out again, by dropping it before the block rather than after it.
    eq(moveTo(['5 rounds:', '  - 10 Push-Ups', '  - 400m Run'], 3, 1, 'before'),
       ['- 400m Run', '5 rounds:', '  - 10 Push-Ups']);
  });

  it('drops after a block, meaning after everything in it', () => {
    // A block owns its contents, so landing "after" one is landing past them.
    // Dropping *into* a block is dropping after the last thing already in it.
    const src = ['5 rounds:', '  - 10 Push-Ups', '- 400m Run'];
    eq(moveTo(src, 3, 1, 'after'), ['5 rounds:', '  - 10 Push-Ups', '- 400m Run']);
  });

  it('carries a block and everything under it', () => {
    const src = ['for time:', '  5 rounds:', '    - 10 Push-Ups', '  - 400m Run'];
    eq(moveTo(src, 2, 4, 'after'), ['for time:', '  - 400m Run', '  5 rounds:', '    - 10 Push-Ups']);
  });

  it('refuses to drop a thing inside itself', () => {
    // The naive splice for this deletes the block outright.
    const src = ['5 rounds:', '  - 10 Push-Ups', '  - 15 Air Squats'];
    eq(moveTo(src, 1, 2, 'after'), src);
    eq(moveTo(src, 1, 1, 'after'), src);
  });

  it('is an identity when the thing is put back', () => {
    const once = moveTo(doc, 3, 5, 'after');
    eq(moveTo(once, 5, 2, 'before'), doc);
  });
});
