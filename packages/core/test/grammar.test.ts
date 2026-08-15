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
  // Empty as of the swap (queue item 0a). Every entry that was here described a
  // way `parse.ts` read a step line differently from the grammar, and `parse.ts`
  // now *is* the grammar for step lines, so there is nothing left to differ.
  // Fourteen of the twenty were the grammar being right — the `@`-plus-digit
  // family, the comma-target trio, the five rx-plus-qualifier lines — and those
  // are fixes; four were the old parser's right-to-left application becoming
  // left-to-right; two were the grammar being wider (`10-5 Squat`,
  // `20calories Row`). All twenty are pinned as vocabulary forms, so what each
  // one now reads as is in `test/golden/vocabulary.json` rather than in a list
  // of reasons here.
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

/**
 * Lines the hand-written parser cannot read at all, so there is no reading to
 * compare the grammar against.
 *
 * These are the *shared* defects, and nothing else in this suite is looking for
 * them — a line neither implementation reads sails past a differential test and a
 * round-trip test alike. They used to be skipped in silence here; now they are
 * listed, and a line the parser starts reading fails as stale.
 */
const STEP_REJECTS = new Map([
  // A line that is *only* a completion condition. `movement` needs at least one
  // character, so the grammar rejects it and `parse` reports `unreadable step`
  // and holds the text as the name. Not a defect and not a disagreement — it is
  // the one step shape the language has no reading for, listed here because a
  // reference that returns `null` has to be listed rather than skipped.
  ['until HR > 160bpm', 'a line that is only a threshold names nothing to do'],
]);

const REST_REJECTS = new Map([
  // Every spelled-out duration word works in a *step's* quantity position —
  // `45 seconds Plank`, `2 mins Bike`, `1 hour Ride` — and not one of them works
  // after `rest`, because `parseDuration` only knows `h`/`min`/`m`/`s` and
  // `parseQuantity` has its own spelled-out spellings that the rest path never
  // reaches. Spec §3 says these are accepted "wherever a duration is expected",
  // and a rest is a duration position. The result is an `unreadable rest duration`
  // error *and* a rest with no bound at all — silently unbounded. Found
  // 2026-08-15 by typing lines into the browser; see known-debts.md.
  ['rest 45 seconds', 'a spelled-out duration word is a step quantity but not a rest'],
  ['rest 2 mins', 'a spelled-out duration word is a step quantity but not a rest'],
  ['rest 1 hour', 'a spelled-out duration word is a step quantity but not a rest'],
]);

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
const IS_REST = /^rest\b/i;
const IS_SCORE = /^score\s*:/i;
const IS_DIRECTIVE = /^@/;
const IS_TITLE = /^#/;

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

interface Harvest {
  steps: string[]; headers: string[]; rests: string[];
  scores: string[]; directives: string[]; titles: string[];
}

/** Every line in a tree, sorted into the areas the grammar claims. */
function harvest(roots: Line[]): Harvest {
  const out: Harvest = { steps: [], headers: [], rests: [], scores: [], directives: [], titles: [] };
  const walk = (nodes: Line[], inVariants: boolean) => {
    for (const n of nodes) {
      const text = n.text.trim();
      if (/^-\s+/.test(text)) out.steps.push(text.replace(/^-\s+/, '').trim());
      else if (inVariants) { /* a key in a map, not a line of workout syntax */ }
      else if (IS_DIRECTIVE.test(text)) out.directives.push(text);
      else if (IS_TITLE.test(text)) out.titles.push(text);
      else if (IS_REST.test(text)) out.rests.push(text);
      else if (IS_SCORE.test(text)) out.scores.push(text);
      else {
        const head = headerText(text);
        if (head !== null) out.headers.push(head);
      }
      walk(n.children, inVariants || /^variants\s*:/i.test(text));
    }
  };
  walk(roots, false);
  return out;
}

const AREA_KEYS = ['steps', 'headers', 'rests', 'scores', 'directives', 'titles'] as const;

function merge(parts: Harvest[]): Harvest {
  const out = {} as Harvest;
  for (const k of AREA_KEYS) out[k] = [...new Set(parts.flatMap((p) => p[k]))];
  return out;
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
    {
      steps: STEP_FORMS.flatMap((g) => g.lines),
      headers: [], rests: [], scores: [], directives: [], titles: [],
    },
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

/**
 * What the current parser makes of a `rest …` line, inside the smallest block
 * that can hold one.
 */
function referenceRest(line: string): unknown | null {
  const { workout, errors } = parse(`5 sets:\n  - 5 Back Squat\n  ${line}`);
  if (errors.length) return null;
  const block = workout.body[0];
  if (!block || block.node !== 'block') return null;
  const rest = block.children[1];
  return rest && rest.node === 'rest' ? strip(rest) : null;
}

/**
 * What the current parser makes of a `score:` line at the top level, where it
 * belongs to the workout. On a block it goes through the same `parseScore`, so
 * one of the two positions is enough to measure the line itself.
 */
function referenceScore(line: string): unknown | null {
  const { workout, errors } = parse(`for time:\n  - 100 Burpee\n${line}`);
  if (errors.length) return null;
  return workout.score ? strip(workout.score) : null;
}

/** What the current parser makes of a directive line, as one key and one value. */
function referenceDirective(line: string): unknown | null {
  const { workout, errors } = parse(`${line}\nfor time:\n  - 100 Burpee`);
  if (errors.length) return null;
  const keys = Object.keys(workout.directives);
  return keys.length === 1 ? { key: keys[0], value: workout.directives[keys[0]] } : null;
}

function referenceTitle(line: string): unknown | null {
  const { workout, errors } = parse(`${line}\nfor time:\n  - 100 Burpee`);
  return errors.length || workout.title === undefined ? null : workout.title;
}

type Read = (line: string) => { ok: boolean; value?: unknown; message?: string };

/** Turn an `Attempt` into what `compare` wants, stripping what is the caller's. */
const reader = <T>(attempt: (line: string) => { ok: boolean; value?: T; message?: string },
  shape: (v: T) => unknown = (v) => v): Read => (line) => {
    const got = attempt(line);
    return got.ok ? { ok: true, value: strip(shape(got.value as T)) } : { ok: false, message: got.message };
  };

const readStep = reader((l) => wdl.tryStep(l));
// A header's children are the caller's — the grammar states one line.
const readHeader = reader((l) => wdl.tryHeader(l), (b) => ({ ...b, children: [] }));
const readRest = reader((l) => wdl.tryRest(l));
const readScore = reader((l) => wdl.tryScore(l));
const readDirective = reader((l) => wdl.tryDirective(l));
const readTitle = reader((l) => wdl.tryTitle(l));

interface Tally {
  checked: number;
  agreed: number;
  unreadable: string[];
  disagreed: string[];
  /** Excluded lines that no longer disagree — the exclusion has gone stale. */
  stale: string[];
  /**
   * Lines the *hand-written parser* cannot read, so there is nothing to compare
   * against. These used to be skipped in silence, which is the one hole a
   * differential test can have and still look green: a line neither side reads is
   * a shared defect, and a shared defect is exactly what nothing else in this
   * suite is looking for. Listed with a reason now, and stale entries fail.
   */
  rejected: string[];
  staleRejects: string[];
}

interface Area {
  what: string;
  lines: (h: Harvest) => string[];
  reference: (line: string) => unknown | null;
  read: Read;
  excluded: Map<string, string>;
  /** Lines the hand-written parser cannot read, so there is nothing to compare. */
  rejects: Map<string, string>;
  /** How many lines each source must contribute, so a silent collapse fails. */
  atLeast: [number, number, number];
}

function compare(area: Area, lines: string[]): Tally {
  const t: Tally = {
    checked: 0, agreed: 0, unreadable: [], disagreed: [], stale: [],
    rejected: [], staleRejects: [],
  };
  for (const line of lines) {
    const want = area.reference(line);
    const got = area.read(line);
    const same = got.ok && want !== null && JSON.stringify(got.value) === JSON.stringify(want);
    if (area.rejects.has(line)) {
      if (want !== null) t.staleRejects.push(`${line} — the parser reads it now: ${area.rejects.get(line)}`);
      continue;
    }
    if (area.excluded.has(line)) {
      if (same) t.stale.push(`${line} — no longer differs: ${area.excluded.get(line)}`);
      continue;
    }
    // Nothing to compare against. Reported rather than skipped: see `rejected`.
    if (want === null) { t.rejected.push(line); continue; }
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
    rejects: STEP_REJECTS,
    atLeast: [300, 40, 130],
  },
  {
    what: 'block headers',
    lines: (h) => h.headers,
    reference: referenceHeader,
    read: readHeader,
    excluded: headerExcluded,
    rejects: new Map(),
    atLeast: [90, 20, 40],
  },
  {
    what: 'rest lines',
    lines: (h) => h.rests,
    reference: referenceRest,
    read: readRest,
    excluded: new Map(),
    rejects: REST_REJECTS,
    atLeast: [10, 4, 9],
  },
  {
    what: 'score lines',
    lines: (h) => h.scores,
    reference: referenceScore,
    read: readScore,
    excluded: new Map(),
    rejects: new Map(),
    atLeast: [10, 4, 8],
  },
  {
    what: 'directive lines',
    lines: (h) => h.directives,
    reference: referenceDirective,
    read: readDirective,
    excluded: new Map(),
    rejects: new Map(),
    // The corpus floor is **zero**, and that is a measurement rather than a
    // concession: not one of the 190 real workouts writes a directive. It is the
    // same gap `lessons-learned.md` records for 13 of the 24 documented features,
    // and it is why the vocabulary exists — a sample of real documents does not
    // cover a language.
    atLeast: [0, 4, 5],
  },
  {
    what: 'title lines',
    lines: (h) => h.titles,
    reference: referenceTitle,
    read: readTitle,
    excluded: new Map(),
    rejects: new Map(),
    atLeast: [10, 1, 1],
  },
];

const pinnedForms = new Set([
  ...STEP_FORMS.flatMap((g) => g.lines),
  ...SOURCES.flatMap((s) => {
    const h = harvest(readLines(s.src));
    return [...h.headers, ...h.rests, ...h.scores];
  }),
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
        eq(t.rejected, [], `${t.rejected.length} lines the parser cannot read, unlisted`);
        eq(t.staleRejects, [], `${t.staleRejects.length} listed rejects the parser reads now`);
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

  /**
   * `on cap:` and `tiebreak:` are the one thing here with no differential
   * counterpart: which score they attach to is a question about *lines*, not
   * about one line, and it lives in the caller. So the line itself is checked
   * directly rather than through the harness above.
   */
  it('reads a score qualifier line', () => {
    eq(wdl.parseQualifier('on cap: reps completed'), { key: 'onCap', text: 'reps completed' });
    eq(wdl.parseQualifier('tiebreak: reps at 5min'), { key: 'tiebreak', text: 'reps at 5min' });
  });

  /**
   * Variants are the other multi-line assembly, for the same reason: which
   * variant a field belongs to is a question about several lines. Both spellings
   * exist because one variant with one field is a line where three with three
   * fields is a table (spec §11), and a comma separates fields inside braces
   * where on a line of its own it is just a comma.
   */
  it('reads both spellings of a variant', () => {
    eq(wdl.parseVariant('women:'), { name: 'women' });
    eq(wdl.parseVariant('women: {load: 65lb}'),
      { name: 'women', fields: [{ key: 'load', value: '65lb' }] });
    eq(wdl.parseVariant('women: {load: 65lb, reps: 15}'),
      { name: 'women', fields: [{ key: 'load', value: '65lb' }, { key: 'reps', value: '15' }] });
    eq(wdl.parseField('load: 65lb'), { key: 'load', value: '65lb' });
  });
});
