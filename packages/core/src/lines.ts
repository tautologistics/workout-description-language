/**
 * Phase 1 of the two-phase parse (roadmap §5.1): turn indentation into a tree.
 *
 * Deliberately tiny and free of any WDL knowledge — it sees indentation,
 * comments, blank lines, and one character: the `:` that ends a line and opens a
 * container. That last one is *syntax*, not semantics — it is true of every kind
 * of block without naming any of them — and keeping it to a character is what
 * lets phase 2 stay an ordinary context-free grammar, and what makes a
 * hand-written port to another language a weekend rather than a project. A list
 * of block keywords here would cost exactly that property.
 */

export interface Line {
  text: string;          // content with comment and indentation stripped
  indent: number;
  line: number;          // 1-based source line
  comments: string[];    // comments attached to this line (own-line above, or trailing)
  children: Line[];
  /**
   * True when this line was attached somewhere its own indentation would not
   * have put it. Phase 2 needs it twice: to report a *container* that moved — a
   * guess that changes structure should not also be silent — and to leave a
   * `score:` line at the top level, which is where an unindented line is.
   */
  adopted?: boolean;
}

/** Split a raw line into content and comment, respecting quoted strings. */
function splitComment(raw: string): { text: string; comment?: string } {
  let inQuote = false;
  for (let i = 0; i < raw.length - 1; i++) {
    const c = raw[i];
    if (c === '"') inQuote = !inQuote;
    if (!inQuote && c === '/' && raw[i + 1] === '/') {
      return { text: raw.slice(0, i).trimEnd(), comment: raw.slice(i + 2).trim() };
    }
  }
  return { text: raw.trimEnd() };
}

/** Join physical lines while `{` … `}` remains unbalanced, so an inline block may wrap. */
function joinContinuations(raw: string[]): (string | null)[] {
  const out: (string | null)[] = [];
  let depth = 0;
  for (const line of raw) {
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;
    if (depth > 0) {
      // fold into the most recent real line
      for (let j = out.length - 1; j >= 0; j--) {
        if (out[j] !== null) { out[j] += ' ' + line.trim(); break; }
      }
      out.push(null);
    } else {
      out.push(line);
    }
    depth += opens - closes;
    if (depth < 0) depth = 0;
  }
  return out;
}

/**
 * A line ending in `:` opens a container (spec §2). The whole of what phase 1
 * knows about WDL.
 */
const opensContainer = (text: string) => text.endsWith(':');

export function readLines(source: string): Line[] {
  const roots: Line[] = [];
  const stack: Line[] = [];
  /**
   * Containers holding a child that indentation did not put there. Adoption is
   * one-way: once a container has taken something it was not indented, it keeps
   * taking. See `adopts` below.
   */
  const adopting = new Set<Line>();
  let pending: string[] = [];   // comments seen on their own lines, awaiting an owner

  const physical = joinContinuations(source.split(/\r?\n/));
  // Comment-stripped content per physical line, `null` where there is nothing
  // that nests — a blank, a comment on its own, or a folded continuation.
  const content = physical.map((raw) => {
    if (raw === null) return null;
    const { text } = splitComment(raw);
    return text.trim() ? text : null;
  });
  /**
   * The indent of the next line that nests, per line — `Infinity` at the end.
   * The one thing the rules below need that a single pass cannot see: whether a
   * container indents its own body.
   */
  const nextIndent = content.map(() => Infinity);
  for (let i = content.length - 2; i >= 0; i--) {
    const t = content[i + 1];
    nextIndent[i] = t === null ? nextIndent[i + 1] : t.length - t.trimStart().length;
  }

  /**
   * Whether `open` keeps a line indentation would have made its sibling.
   *
   * Three rules, justified separately (spec §2, *Lines that were never
   * indented*):
   *
   * **An empty container adopts whatever comes next, container or not.** A
   * container holds no work of its own, so empty it is not a thing that can
   * stand as anyone's sibling — `conditioning:` written directly above
   * `AMRAP 12min:` means the AMRAP is in it. This cascades: each still-empty
   * container adopts in turn.
   *
   * **Once it has children, a plain line cannot close it.** A step is not a
   * container, so a line written flat under a block it was never indented into
   * belongs to that block.
   *
   * **A container line closes it only if that container is flat too.** A block
   * that indents its own body is a block written the ordinary way, and one
   * written the ordinary way inside a flat run is *in* the run rather than
   * beside it — which is the whole of what tells `For time:` / `AMRAP 20min:`
   * (the AMRAP's steps indented) apart from `warmup:` / `conditioning:` (all of
   * it flat). *Corrected 2026-08-15, the day it was written: the first version
   * had every container line terminate, which read a half-indented file as
   * several top-level blocks. Found by typing a real workout into the builder,
   * not by the suite.* The cost is stated rather than hidden — in a
   * half-indented file nothing returns to the outer level.
   */
  const adopts = (open: Line, node: Line, nodeIndentsBody: boolean) =>
    opensContainer(open.text)
    && (open.children.length === 0
        || (adopting.has(open) && (nodeIndentsBody || !opensContainer(node.text))));

  physical.forEach((rawLine, i) => {
    if (rawLine === null) return;
    const raw = rawLine;
    const { text, comment } = splitComment(raw);
    const contentText = text.trim();

    if (!contentText) {
      // A comment on its own line attaches to whatever comes next.
      if (comment !== undefined) pending.push(comment);
      return;
    }

    const indent = text.length - text.trimStart().length;
    const node: Line = {
      text: contentText,
      indent,
      line: i + 1,
      comments: [...pending, ...(comment !== undefined ? [comment] : [])],
      children: [],
    };
    pending = [];

    const indentsBody = opensContainer(contentText) && nextIndent[i] > indent;
    while (stack.length) {
      const open = stack[stack.length - 1];
      if (open.indent < indent) break;                    // indentation makes this a child
      if (adopts(open, node, indentsBody)) break;         // and so, sometimes, does adoption
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) {
      if (parent.indent >= indent) { adopting.add(parent); node.adopted = true; }
      parent.children.push(node);
    } else roots.push(node);
    stack.push(node);
  });

  // Trailing comments with no owner become file-level.
  if (pending.length) {
    roots.push({ text: '', indent: 0, line: 0, comments: pending, children: [] });
  }
  return roots;
}

/**
 * Expand the inline brace form — `8 rounds: { work 20s: Pull-Up, rest 10s }` —
 * into the same shape indentation would have produced, so phase 2 sees one
 * representation. See spec §16: whether this form should survive is still open.
 */
export function expandInline(line: Line): { head: string; inline?: Line[]; tail?: string } {
  const open = line.text.indexOf('{');
  if (open === -1) return { head: line.text };
  const close = line.text.lastIndexOf('}');
  if (close < open) return { head: line.text };

  const head = line.text.slice(0, open).trimEnd();
  const inner = line.text.slice(open + 1, close).trim();
  const tail = line.text.slice(close + 1).trim();

  const parts = splitTopLevel(inner, ',');
  const inline = parts.map((p) => ({
    text: p.replace(/^-\s*/, ''),
    indent: line.indent + 2,
    line: line.line,
    comments: [],
    children: [],
  }));
  return { head, inline, tail: tail || undefined };
}

/** Split on a separator that isn't inside quotes, braces, or parens. */
export function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, quote = false, cur = '';
  for (const c of s) {
    if (c === '"') quote = !quote;
    if (!quote) {
      if (c === '{' || c === '(') depth++;
      else if (c === '}' || c === ')') depth--;
      else if (c === sep && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
