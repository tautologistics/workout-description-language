/**
 * The grammar against the parser, line for line.
 *
 * `spec/grammar-0.1.ohm` plus the semantics under `src/grammar/` must produce the
 * same AST as the hand-written parser for every line this project has, in every
 * area the grammar claims to cover: every step line and every block header in
 * `examples/corpus`, in `spec-0.1.md`, and in `test/golden/vocabulary.ts`.
 *
 * It runs as a *differential* test rather than a replacement because the two
 * halves of phase 2 share a lexical layer. Durations appear in `cap 12min` and
 * `every 90s` as well as in `12min Bike`; targets appear as an inherited `@` on
 * a block header; `21-15-9` is a ladder where `8-12` is a rep range. Swapping
 * steps over first would mean rewriting the step semantics once headers force
 * those productions to be factored differently. So the grammar grows to cover
 * all of phase 2 with this test green, and the parser is swapped in one change.
 *
 * Equality is what the corpus round-trip test means by it: source positions and
 * comment placement are stripped, because they are the caller's, not the
 * grammar's.
 *
 * A line the two read differently is listed in EXCLUSIONS with a reason and
 * counted out loud. It is never skipped quietly — the whole value here is that
 * the numbers are honest, which is also why an exclusion that stops differing
 * fails as stale.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { readLines, type Line } from '../src/lines.ts';
import { makeParser } from '../src/grammar/parser.ts';
import { STEP_FORMS, SOURCES, strip, wrap } from './golden/vocabulary.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../../..');

const grammarSource = readFileSync(join(repo, 'spec/grammar-0.1.ohm'), 'utf8');
const wdl = makeParser(grammarSource);

/**
 * Lines where the two deliberately disagree, and why.
 *
 * Listed rather than skipped: a silent skip turns "747 of 747" into a number
 * that means nothing. Each entry is a claim, and the suite below checks it —
 * an exclusion whose line has stopped differing is stale and fails.
 *
 * Nothing in `examples/corpus` or `spec-0.1.md` is here. Every entry is a form
 * `test/golden/vocabulary.ts` added *because* this test found the disagreement.
 */
const EXCLUSIONS: { line: string; why: string }[] = [
  // ---- step lines ----
  // `@` tight against a digit. The grammar states that the first character
  // after the `@` decides — a letter opens a flag, a digit opens a target — so
  // it reads all of these as targets. `/@(\w[\w-]*)/g` runs over the whole line
  // before anything else and `\w` matches digits, so the parser makes them
  // flags and the load is gone. The grammar is right here and the parser is
  // wrong; the swap is the fix. Pinned in vocabulary.ts under `known-wrong`.
  { line: '10 Thruster @95lb', why: 'the parser reads `@` plus a digit as a flag' },
  { line: '10 Thruster @2x35lb', why: 'the parser reads `@` plus a digit as a flag' },
  { line: '10 Thruster @24kg', why: 'the parser reads `@` plus a digit as a flag' },
  { line: '10 Thruster @95', why: 'the parser reads `@` plus a digit as a flag, unit or no unit' },
  { line: '10 Thruster @85% 1RM', why: 'the parser stops the flag at the `%` and leaves `% 1RM` in the movement name' },
  { line: '18 Thruster @115lb @tiebreak', why: 'the parser reads the tight load as a second flag' },
  // The grammar reads these as loads; `parseOneStep` splits `@` out of the
  // first comma segment only, so `applyQualifier` files them as notes. A
  // parser defect, pinned in vocabulary.ts under `known-wrong`.
  { line: '10 Thruster, @ 95lb', why: 'the parser files a target after a comma as a note' },
  { line: '10 Thruster, @ 24kg', why: 'the parser files a target after a comma as a note' },
  { line: '10 Thruster, @ 85% 1RM', why: 'the parser files a target after a comma as a note' },
  // The grammar reads the rx split; `peelRx` only fires at the end of a comma
  // segment, so a qualifier written after it with a space takes the whole paren
  // into the movement name and both loads are lost. A parser defect, worse than
  // the two above because the movement no longer resolves either. Pinned in
  // vocabulary.ts under `known-wrong`; found by parsing in the browser.
  { line: '10 Deadlift (105/145) each arm', why: 'the parser takes an rx split into the movement name' },
  { line: '10 DB Snatch (50/35lb) each side', why: 'the parser takes an rx split into the movement name' },
  { line: '10 Deadlift (women 105lb / men 145lb) each arm', why: 'the parser takes an rx split into the movement name' },
  { line: '10 Deadlift (105/145) unbroken', why: 'the parser takes an rx split into the movement name' },
  { line: '10 Deadlift (women 105lb / men 145lb) unbroken', why: 'the parser takes an rx split into the movement name' },
  // `min < max` is a constraint on the *values*, not on the shape, so a PEG
  // cannot state it. `parseQuantity` checks it and leaves the digits in the
  // movement name when it fails; the grammar reads a descending range.
  { line: '10-5 Squat', why: 'a PEG cannot require min < max; parseQuantity does' },
  // `20cal` and `20 calories` are amounts and `20calories` is not, which is an
  // accident of `^(\d+)\s*cal$` rather than a decision. The grammar is regular
  // here and reads all three.
  { line: '20calories Row', why: 'the parser wants a space before a spelled-out unit' },
  // Same flags, different order. `peelTrailingQualifiers` strips from the end
  // so it reads right to left, and the `@` regex runs over the whole line
  // before anything else so an `@` flag is hoisted to the front. A grammar
  // reads left to right. These two lines are the ones whose AST moves when the
  // parser is swapped over, so they are pinned rather than left to surprise.
  { line: '10 Deadlift unbroken building', why: 'the parser peels trailing qualifiers right to left' },
  { line: '10 Deadlift building @tiebreak', why: 'the parser hoists every `@` flag to the front' },
];

/**
 * Block headers where the two deliberately disagree, and why. Same contract as
 * the step exclusions above: a reason each, pinned in the vocabulary, and stale
 * entries fail.
 */
const HEADER_EXCLUSIONS: { line: string; why: string }[] = [
  // The header-level twin of the step-level comma-target defect. `parseHeader`
  // runs its `@` sweep over the *first* comma segment only, so a target written
  // after a comma never reaches `inherited` — `applyBlockModifier` falls through
  // to its catch-all and files it as a flag, where nothing inherits it and the
  // children are loadless. The grammar reads an `@` group as an inherited target
  // wherever it appears. A parser defect; the swap is the fix.
  { line: '3 rounds, @ 95lb', why: 'the parser files a header target after a comma as a flag' },
];

const excluded = new Map(EXCLUSIONS.map((e) => [e.line, e.why]));
const headerExcluded = new Map(HEADER_EXCLUSIONS.map((e) => [e.line, e.why]));

// ---------- where the lines come from ----------

/**
 * Which kind of line this is, if it is one the grammar claims.
 *
 * Phase 1 does not answer this and deliberately cannot — it sees indentation and
 * nothing else — so the same two one-character markers the parser keys on are
 * what this keys on: a leading `- ` opens a step, a trailing `:` opens a block.
 *
 * Several lines carry a colon and are *not* block headers, and each is a
 * different kind of thing rather than a special case of one: `score:`,
 * `on cap:`, `tiebreak:` and `variants:` belong to the workout rather than to a
 * block; `choice:` is one step written across lines; `every 1min: 5 Burpee` is an
 * interrupt overlay (spec §5.8); and a variant's `women:` is a key in a map,
 * which is why the walk below carries whether it is inside `variants:`.
 */
const NOT_A_HEADER = /^(score|on\s+cap|tiebreak|variants|choice)\s*:/i;

function headerText(text: string): string | null {
  if (/^-\s/.test(text) || /^rest\b/i.test(text) || /^[@#]/.test(text)) return null;
  if (NOT_A_HEADER.test(text)) return null;
  let depth = 0, quote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') quote = !quote;
    else if (quote) continue;
    else if (c === '{' || c === '(') depth++;
    else if (c === '}' || c === ')') depth--;
    else if (c === ':' && depth === 0) {
      const head = text.slice(0, i).trim();
      const after = text.slice(i + 1).trim();
      if (after && /^every\b/i.test(head)) return null;
      return head || null;
    }
  }
  return null;
}

interface Harvest { steps: string[]; headers: string[] }

/** Every step line and every block header in a line tree, at any depth. */
function harvest(roots: Line[]): Harvest {
  const out: Harvest = { steps: [], headers: [] };
  const walk = (nodes: Line[], inVariants: boolean) => {
    for (const n of nodes) {
      const text = n.text.trim();
      if (/^-\s+/.test(text)) out.steps.push(text.replace(/^-\s+/, '').trim());
      else if (!inVariants) {
        const head = headerText(text);
        if (head !== null) out.headers.push(head);
      }
      walk(n.children, inVariants || /^variants\s*:/i.test(text));
    }
  };
  walk(roots, false);
  return out;
}

function merge(parts: Harvest[]): Harvest {
  return {
    steps: [...new Set(parts.flatMap((p) => p.steps))],
    headers: [...new Set(parts.flatMap((p) => p.headers))],
  };
}

function corpusHarvest(): Harvest {
  const dir = join(repo, 'examples/corpus');
  return merge(readdirSync(dir).filter((f) => f.endsWith('.wdl'))
    .map((f) => harvest(readLines(readFileSync(join(dir, f), 'utf8')))));
}

/**
 * The spec's own examples — the forms it documents.
 *
 * Read as line trees rather than scanned for `- ` prefixes, because a header is
 * only recognizable in context: whether `women:` is a block or a variant key
 * depends on what it sits under. Comments are stripped by `readLines` already.
 */
function specHarvest(): Harvest {
  const md = readFileSync(join(repo, 'spec/spec-0.1.md'), 'utf8');
  const fences: string[] = [];
  let cur: string[] | null = null;
  for (const raw of md.split(/\r?\n/)) {
    if (/^\s*```/.test(raw)) {
      if (cur) { fences.push(cur.join('\n')); cur = null; } else cur = [];
      continue;
    }
    if (cur) cur.push(raw);
  }
  return merge(fences.map((f) => harvest(readLines(f))));
}

function vocabularyHarvest(): Harvest {
  return merge([
    { steps: STEP_FORMS.flatMap((g) => g.lines), headers: [] },
    ...SOURCES.map((s) => harvest(readLines(s.src))),
  ]);
}

// ---------- the comparison ----------

/**
 * What the current parser makes of a bare step line.
 *
 * Reached through `parse` rather than the `Parser` class, which is not
 * exported: the smallest block that can hold a step is the same wrapper
 * `vocabulary.ts` uses, so the two suites are measuring the same thing.
 */
function referenceStep(line: string): unknown | null {
  const { workout, errors } = parse(wrap(line));
  if (errors.length) return null;
  const block = workout.body[0];
  if (!block || block.node !== 'block' || block.children.length !== 1) return null;
  const child = block.children[0];
  return child.node === 'step' ? strip(child) : null;
}

/**
 * What the current parser makes of a block header, given the smallest body that
 * can sit under one.
 *
 * A parse *error* is not disqualifying here, unlike for a step: an unrecognized
 * header legitimately produces both a named sequence and a report, and whether
 * the grammar reproduces the block is exactly what is being asked. Errors are not
 * in the AST, so they are not part of the comparison either way.
 */
function referenceHeader(head: string): unknown | null {
  const { workout } = parse(`${head}:\n  - 10 Push-Up`);
  const block = workout.body[0];
  if (!block || block.node !== 'block') return null;
  return strip({ ...block, children: [] });
}

type Read = (line: string) => { ok: boolean; value?: unknown; message?: string };

const readStep: Read = (line) => {
  const got = wdl.tryStep(line);
  return got.ok ? { ok: true, value: strip(got.value) } : { ok: false, message: got.message };
};
const readHeader: Read = (line) => {
  const got = wdl.tryHeader(line);
  return got.ok ? { ok: true, value: strip({ ...got.value, children: [] }) } : { ok: false, message: got.message };
};

interface Tally {
  checked: number;
  agreed: number;
  unreadable: string[];
  disagreed: string[];
  /** Excluded lines that no longer disagree — the exclusion has gone stale. */
  stale: string[];
}

interface Area {
  what: string;
  lines: (h: Harvest) => string[];
  reference: (line: string) => unknown | null;
  read: Read;
  excluded: Map<string, string>;
  /** How many lines each source must contribute, so a silent collapse fails. */
  atLeast: [number, number, number];
}

function compare(area: Area, lines: string[]): Tally {
  const t: Tally = { checked: 0, agreed: 0, unreadable: [], disagreed: [], stale: [] };
  for (const line of lines) {
    const want = area.reference(line);
    const got = area.read(line);
    const same = got.ok && want !== null && JSON.stringify(got.value) === JSON.stringify(want);
    if (area.excluded.has(line)) {
      if (same) t.stale.push(`${line} — no longer differs: ${area.excluded.get(line)}`);
      continue;
    }
    // Not a line of this kind by the current parser's reckoning — this test has
    // nothing to say about it.
    if (want === null) continue;
    t.checked++;
    if (!got.ok) { t.unreadable.push(`${line} — ${got.message}`); continue; }
    if (same) t.agreed++;
    else t.disagreed.push(`${line}\n        grammar: ${JSON.stringify(got.value)}\n        parser:  ${JSON.stringify(want)}`);
  }
  return t;
}

const harvests: [string, Harvest][] = [
  ['corpus', corpusHarvest()],
  ['spec-0.1.md', specHarvest()],
  ['vocabulary', vocabularyHarvest()],
];

const AREAS: Area[] = [
  {
    what: 'step lines',
    lines: (h) => h.steps,
    reference: referenceStep,
    read: readStep,
    excluded,
    atLeast: [300, 40, 130],
  },
  {
    what: 'block headers',
    lines: (h) => h.headers,
    reference: referenceHeader,
    read: readHeader,
    excluded: headerExcluded,
    atLeast: [90, 20, 40],
  },
];

const pinnedForms = new Set([
  ...STEP_FORMS.flatMap((g) => g.lines),
  ...SOURCES.flatMap((s) => harvest(readLines(s.src)).headers),
]);

for (const area of AREAS) {
  const tallies = harvests.map(([what, h]) => ({ what, tally: compare(area, area.lines(h)) }));
  const checked = tallies.reduce((n, s) => n + s.tally.checked, 0);
  const agreed = tallies.reduce((n, s) => n + s.tally.agreed, 0);

  // The count is in the suite title because the count is the result. A summary
  // line reading `grammar vs parser 4/4` would say nothing about what was
  // measured, and this test exists to make one number true.
  describe(`grammar vs parser: ${agreed}/${checked} ${area.what}`, () => {
    for (const { what, tally: t } of tallies) {
      it(`${what}: ${t.agreed}/${t.checked} agree`, () => {
        eq(t.unreadable, [], `${t.unreadable.length} lines the grammar cannot read`);
        eq(t.disagreed, [], `${t.disagreed.length} lines read differently`);
        eq(t.stale, [], `${t.stale.length} exclusions no longer needed`);
      });
    }

    it('draws on all three sources, not whichever one still loads', () => {
      tallies.forEach(({ what, tally }, i) => {
        ok(tally.checked >= area.atLeast[i], `${what} contributed ${tally.checked} lines`);
      });
    });

    it(`states each of the ${area.excluded.size} lines it reads differently`, () => {
      // The exclusions are part of the result: the headline number above is out
      // of a set this list has been taken out of, and that has to be visible
      // here rather than inferred from a gap in a count.
      for (const [line, why] of area.excluded) {
        ok(why.length > 10, `${line} has a reason`);
        // And every one is a form the vocabulary pins, per the standing rule in
        // lessons-learned.md: a parsing difference becomes permutations.
        ok(pinnedForms.has(line), `${line} is pinned in vocabulary.ts`);
      }
    });
  });
}

describe('the grammar is the spec', () => {
  it('is the file in spec/, not a copy', () => {
    ok(grammarSource.includes('WDL {'), 'spec/grammar-0.1.ohm defines WDL');
    ok(!grammarSource.includes('=>'), 'carries no semantic actions');
  });

  it('holds unrecognized step input rather than failing on it', () => {
    const step = wdl.parseStep('10 Thruster @ 95lb, some phrase nobody taught the parser');
    eq(step.movement, 'Thruster');
    eq(step.notes, ['some phrase nobody taught the parser']);
  });

  it('holds an unrecognized block header rather than failing on it', () => {
    const block = wdl.parseHeader('some shape nobody taught the parser');
    eq(block.type, 'sequence');
    eq(block.name, 'some shape nobody taught the parser');
  });

  it('reports what it cannot read, by position', () => {
    eq(wdl.tryStep('').ok, false);
  });
});
