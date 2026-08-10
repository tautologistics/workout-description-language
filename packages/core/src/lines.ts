/**
 * Phase 1 of the two-phase parse (roadmap §5.1): turn indentation into a tree.
 *
 * Deliberately tiny and free of any WDL knowledge — it only sees indentation,
 * comments, and blank lines. Keeping the indentation-sensitive part isolated is
 * what lets phase 2 be an ordinary context-free grammar, and what makes a
 * hand-written port to another language a weekend rather than a project.
 */

export interface Line {
  text: string;          // content with comment and indentation stripped
  indent: number;
  line: number;          // 1-based source line
  comments: string[];    // comments attached to this line (own-line above, or trailing)
  children: Line[];
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

export function readLines(source: string): Line[] {
  const roots: Line[] = [];
  const stack: Line[] = [];
  let pending: string[] = [];   // comments seen on their own lines, awaiting an owner

  joinContinuations(source.split(/\r?\n/)).forEach((rawLine, i) => {
    if (rawLine === null) return;
    const raw = rawLine;
    const { text, comment } = splitComment(raw);
    const content = text.trim();

    if (!content) {
      // A comment on its own line attaches to whatever comes next.
      if (comment !== undefined) pending.push(comment);
      return;
    }

    const indent = text.length - text.trimStart().length;
    const node: Line = {
      text: content,
      indent,
      line: i + 1,
      comments: [...pending, ...(comment !== undefined ? [comment] : [])],
      children: [],
    };
    pending = [];

    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
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
