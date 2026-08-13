/**
 * Structural edits on a workout file, as text.
 *
 * Move a block, indent it, duplicate it, delete it. These are the operations an
 * editor needs and that are genuinely fiddly to do by hand, and they are all the
 * same shape: find the lines a thing occupies, and splice.
 *
 * They work on the text rather than on the AST, and that is the point. Going
 * through the AST would mean regenerating the file from it, which silently
 * reformats every line the author did not touch — their spacing, their
 * comments, their choice of `21-15-9` over three lines. Editing the text in
 * place changes what was asked for and nothing else. Canonicalising stays a
 * thing you ask for.
 *
 * Three things decide where a thing begins and ends, and each exists because
 * leaving it out produced a bug worth avoiding:
 *
 * **Indentation.** A block owns everything indented under it, so moving it moves
 * its contents. Phase 1 of the parser already computes this tree.
 *
 * **The comments above it.** `// the buy-in` written over a block is about that
 * block. Moving the block without it leaves the comment describing whatever
 * landed there instead, which is worse than losing it — it now says something
 * false.
 *
 * **The blank lines below it.** A blank after a block is its breathing room.
 * Leaving it behind means moving something down and back is not an identity: the
 * spacing creeps a line each time, and after a few edits the file is unevenly
 * spaced for reasons nobody can point at.
 *
 * And one thing that decides where a *line* begins and ends: an inline `{ … }`
 * block may wrap, and phase 1 folds it back into a single logical line. An
 * editor that writes an edit back to only the first physical line silently drops
 * the rest.
 */

import { readLines, type Line } from './lines.ts';

export interface Span {
  node: Line;
  /** First line, 1-based, including comments written above it. */
  from: number;
  /** Last line, including wrapped continuations and trailing blanks. */
  to: number;
  /**
   * Last line of the content itself, before the blank lines that follow.
   * Moving a thing takes its spacing along; inserting a sibling belongs inside
   * the block, before the blank that separates it from the next one.
   */
  contentEnd: number;
  /** Position among its siblings, and the siblings themselves. */
  index: number;
  siblings: Line[];
}

const COMMENT = /^\s*\/\//;

const indentOf = (line: string) => line.length - line.trimStart().length;

/**
 * The last physical line of a logical one — an inline block may wrap over
 * several, and phase 1 joins them.
 */
export function logicalEnd(lines: string[], line: number): number {
  let to = line;
  let depth = 0;
  while (to <= lines.length) {
    const l = lines[to - 1] ?? '';
    depth += (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length;
    if (depth <= 0) break;
    to++;
  }
  return to;
}

function commentsAbove(lines: string[], line: number): number {
  let from = line;
  const indent = indentOf(lines[line - 1] ?? '');
  while (from > 1) {
    const above = lines[from - 2];
    if (!COMMENT.test(above) || indentOf(above) !== indent) break;
    from--;
  }
  return from;
}

function blanksBelow(lines: string[], line: number): number {
  let to = line;
  while (to < lines.length && !lines[to].trim()) to++;
  return to;
}

const deepest = (lines: string[], n: Line): number =>
  (n.children.length ? deepest(lines, n.children[n.children.length - 1]) : logicalEnd(lines, n.line));

/** Every line's span, keyed by the line it starts on. */
export function spans(lines: string[]): Map<number, Span> {
  const out = new Map<number, Span>();
  const walk = (nodes: Line[]) => {
    nodes.forEach((n, index) => {
      if (!n.line) return;   // the synthetic node trailing comments produce
      const end = deepest(lines, n);
      out.set(n.line, {
        node: n,
        from: commentsAbove(lines, n.line),
        to: blanksBelow(lines, end),
        contentEnd: end,
        index,
        siblings: nodes,
      });
      walk(n.children);
    });
  };
  walk(readLines(`${lines.join('\n')}\n`));
  return out;
}

/** Swap a thing with the sibling before or after it, contents and all. */
export function move(lines: string[], line: number, dir: -1 | 1): string[] {
  const map = spans(lines);
  const self = map.get(line);
  const other = self && map.get(self.siblings[self.index + dir]?.line);
  if (!self || !other) return lines;
  const [first, second] = dir > 0 ? [self, other] : [other, self];
  return [
    ...lines.slice(0, first.from - 1),
    ...lines.slice(second.from - 1, second.to),
    ...lines.slice(first.from - 1, first.to),
    ...lines.slice(second.to),
  ];
}

/**
 * Move a thing to sit before or after another, contents and all, re-indenting to
 * match where it lands.
 *
 * `move` steps one place among siblings, which is what a button wants. Dragging
 * wants somewhere else entirely — across nesting levels, past several things at
 * once — and doing that as repeated single steps would be both wrong and
 * visible, since a span cannot step past a sibling it is about to be nested
 * inside.
 *
 * Two things it refuses. Dropping something into itself is not a move, and the
 * naive splice for it deletes the block; and a drop that would change nothing is
 * left alone rather than rewritten, so a dragged-and-returned block is an
 * identity rather than a reindent.
 */
export function moveTo(
  lines: string[], line: number, target: number, where: 'before' | 'after' = 'after',
): string[] {
  const map = spans(lines);
  const self = map.get(line);
  const dest = map.get(target);
  if (!self || !dest || line === target) return lines;
  // Its own subtree is not a destination: splicing a block inside itself drops it.
  if (dest.from >= self.from && dest.to <= self.to) return lines;

  const block = lines.slice(self.from - 1, self.to);
  const rest = [...lines.slice(0, self.from - 1), ...lines.slice(self.to)];

  // Where the target sits once the block is gone.
  const shiftBy = (n: number) => (n > self.to ? n - (self.to - self.from + 1) : n);
  const at = where === 'before' ? shiftBy(dest.from) - 1 : shiftBy(dest.contentEnd);

  // Land at the target's indent, carrying the block's own nesting with it.
  const by = indentOf(lines[target - 1] ?? '') - indentOf(lines[line - 1] ?? '');
  const moved = block.map((l) => {
    if (!l.trim()) return l;
    return by >= 0 ? ' '.repeat(by) + l : l.slice(Math.min(-by, indentOf(l)));
  });

  return [...rest.slice(0, at), ...moved, ...rest.slice(at)];
}

/** Re-indent a thing and its contents together, so the nesting stays legal. */
export function shift(lines: string[], line: number, by: number): string[] {
  const self = spans(lines).get(line);
  if (!self || indentOf(lines[line - 1]) + by < 0) return lines;
  const out = lines.slice();
  for (let i = self.from; i <= self.to; i++) {
    if (!out[i - 1].trim()) continue;
    out[i - 1] = by > 0 ? ' '.repeat(by) + out[i - 1] : out[i - 1].slice(-by);
  }
  return out;
}

export function remove(lines: string[], line: number): string[] {
  const self = spans(lines).get(line);
  if (!self) return lines;
  const out = [...lines.slice(0, self.from - 1), ...lines.slice(self.to)];
  return out.length ? out : [''];
}

export function duplicate(lines: string[], line: number): string[] {
  const self = spans(lines).get(line);
  if (!self) return lines;
  const block = lines.slice(self.from - 1, self.to);
  return [...lines.slice(0, self.to), ...block, ...lines.slice(self.to)];
}

/** Insert a line after a thing, at the same indent. Appends when `after` is undefined. */
export function insertAfter(lines: string[], after: number | undefined, content: string): string[] {
  const self = after !== undefined ? spans(lines).get(after) : undefined;
  const at = self ? self.contentEnd : lines.length;
  const indent = after !== undefined ? ' '.repeat(indentOf(lines[after - 1] ?? '')) : '  ';
  return [...lines.slice(0, at), indent + content, ...lines.slice(at)];
}

/** One logical line's text, with any wrapped continuation joined onto it. */
export function logicalText(lines: string[], line: number): string {
  return lines.slice(line - 1, logicalEnd(lines, line)).map((l) => l.trim()).join(' ');
}

/**
 * Replace a logical line, keeping its indent and consuming any continuation it
 * wrapped onto.
 */
export function replaceLogical(lines: string[], line: number, content: string): string[] {
  const end = logicalEnd(lines, line);
  const indent = ' '.repeat(indentOf(lines[line - 1] ?? ''));
  return [...lines.slice(0, line - 1), indent + content, ...lines.slice(end)];
}
