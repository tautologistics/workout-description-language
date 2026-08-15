/**
 * The grammar against the parser, line for line.
 *
 * `spec/grammar-0.1.ohm` plus `src/grammar/step-semantics.ts` must produce the
 * same `Step` as the hand-written `parseOneStep` for every step line this
 * project has: every one in `examples/corpus`, every one in `spec-0.1.md`, and
 * every step case in `test/golden/vocabulary.ts`.
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
 * A line the grammar cannot yet read is listed in EXCLUSIONS with a reason and
 * counted out loud. It is never skipped quietly — the whole value here is that
 * the number is honest.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { readLines, type Line } from '../src/lines.ts';
import { makeStepParser } from '../src/grammar/step-semantics.ts';
import { STEP_FORMS, strip, wrap } from './golden/vocabulary.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../../..');

const grammarSource = readFileSync(join(repo, 'spec/grammar-0.1.ohm'), 'utf8');
const stepParser = makeStepParser(grammarSource);

/**
 * Lines where the two deliberately disagree, and why.
 *
 * Listed rather than skipped: a silent skip turns "746 of 746" into a number
 * that means nothing. Each entry is a claim, and the suite below checks it —
 * an exclusion whose line has stopped differing is stale and fails.
 *
 * Nothing in `examples/corpus` or `spec-0.1.md` is here. Every entry is a form
 * `test/golden/vocabulary.ts` added *because* this test found the disagreement.
 */
const EXCLUSIONS: { line: string; why: string }[] = [
  // The grammar reads these as loads; `parseOneStep` splits `@` out of the
  // first comma segment only, so `applyQualifier` files them as notes. A
  // parser defect, pinned in vocabulary.ts under `known-wrong`.
  { line: '10 Thruster, @ 95lb', why: 'the parser files a target after a comma as a note' },
  { line: '10 Thruster, @ 24kg', why: 'the parser files a target after a comma as a note' },
  { line: '10 Thruster, @ 85% 1RM', why: 'the parser files a target after a comma as a note' },
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
const excluded = new Map(EXCLUSIONS.map((e) => [e.line, e.why]));

// ---------- where the step lines come from ----------

/** Every `- ` line in a line tree, at any depth. */
function stepLines(roots: Line[]): string[] {
  const out: string[] = [];
  const walk = (nodes: Line[]) => {
    for (const n of nodes) {
      if (/^-\s+/.test(n.text)) out.push(n.text.replace(/^-\s+/, '').trim());
      walk(n.children);
    }
  };
  walk(roots);
  return out;
}

function corpusLines(): string[] {
  const dir = join(repo, 'examples/corpus');
  return readdirSync(dir).filter((f) => f.endsWith('.wdl'))
    .flatMap((f) => stepLines(readLines(readFileSync(join(dir, f), 'utf8'))));
}

/** The step lines inside the spec's own examples — the forms it documents. */
function specLines(): string[] {
  const md = readFileSync(join(repo, 'spec/spec-0.1.md'), 'utf8');
  const out: string[] = [];
  let inFence = false;
  for (const raw of md.split(/\r?\n/)) {
    if (/^\s*```/.test(raw)) { inFence = !inFence; continue; }
    if (!inFence) continue;
    const m = raw.match(/^\s*-\s+(.+?)\s*$/);
    if (m && !/^\s*\/\//.test(m[1])) out.push(m[1].replace(/\s*\/\/.*$/, '').trim());
  }
  return out;
}

const vocabularyLines = (): string[] => STEP_FORMS.flatMap((g) => g.lines);

// ---------- the comparison ----------

/**
 * What the current parser makes of a bare step line.
 *
 * Reached through `parse` rather than the `Parser` class, which is not
 * exported: the smallest block that can hold a step is the same wrapper
 * `vocabulary.ts` uses, so the two suites are measuring the same thing.
 */
function reference(line: string): unknown | null {
  const { workout, errors } = parse(wrap(line));
  if (errors.length) return null;
  const block = workout.body[0];
  if (!block || block.node !== 'block' || block.children.length !== 1) return null;
  const child = block.children[0];
  return child.node === 'step' ? strip(child) : null;
}

interface Tally {
  checked: number;
  agreed: number;
  unreadable: string[];
  disagreed: string[];
  /** Excluded lines that no longer disagree — the exclusion has gone stale. */
  stale: string[];
}

function compare(lines: string[]): Tally {
  const t: Tally = { checked: 0, agreed: 0, unreadable: [], disagreed: [], stale: [] };
  for (const line of lines) {
    if (excluded.has(line)) {
      const want = reference(line);
      const got = stepParser.tryStep(line);
      const same = got.ok && want !== null && JSON.stringify(strip(got.step)) === JSON.stringify(want);
      if (same) t.stale.push(`${line} — no longer differs: ${excluded.get(line)}`);
      continue;
    }
    const want = reference(line);
    // Not a step by the current parser's reckoning (a `rest` line, say) — this
    // test has nothing to say about it.
    if (want === null) continue;
    t.checked++;
    const got = stepParser.tryStep(line);
    if (!got.ok) { t.unreadable.push(`${line} — ${got.message}`); continue; }
    if (JSON.stringify(strip(got.step)) === JSON.stringify(want)) t.agreed++;
    else t.disagreed.push(`${line}\n        grammar: ${JSON.stringify(strip(got.step))}\n        parser:  ${JSON.stringify(want)}`);
  }
  return t;
}

const sources: { what: string; tally: Tally }[] = [
  { what: 'corpus', tally: compare([...new Set(corpusLines())]) },
  { what: 'spec-0.1.md', tally: compare([...new Set(specLines())]) },
  { what: 'vocabulary', tally: compare([...new Set(vocabularyLines())]) },
];
const checked = sources.reduce((n, s) => n + s.tally.checked, 0);
const agreed = sources.reduce((n, s) => n + s.tally.agreed, 0);

// The count is in the suite title because the count is the result. A summary
// line reading `grammar vs parser 4/4` would say nothing about what was
// measured, and this test exists to make one number true.
describe(`grammar vs parser: ${agreed}/${checked} step lines`, () => {
  for (const { what, tally: t } of sources) {
    it(`${what}: ${t.agreed}/${t.checked} agree`, () => {
      eq(t.unreadable, [], `${t.unreadable.length} lines the grammar cannot read`);
      eq(t.disagreed, [], `${t.disagreed.length} lines read differently`);
      eq(t.stale, [], `${t.stale.length} exclusions no longer needed`);
    });
  }

  it('draws on all three sources, not whichever one still loads', () => {
    const [corpus, spec, vocab] = sources.map((s) => s.tally.checked);
    ok(corpus > 300, `corpus contributed ${corpus} lines`);
    ok(spec > 40, `the spec contributed ${spec} lines`);
    ok(vocab > 130, `the vocabulary contributed ${vocab} lines`);
  });

  it(`states each of the ${EXCLUSIONS.length} lines it reads differently`, () => {
    // The exclusions are part of the result: the headline number above is out
    // of a set this list has been taken out of, and that has to be visible
    // here rather than inferred from a gap in a count.
    for (const e of EXCLUSIONS) ok(e.why.length > 10, `${e.line} has a reason`);
    // Every one of them is a form the vocabulary now pins, per the standing
    // rule in lessons-learned.md: a parsing difference becomes permutations.
    const pinned = new Set(vocabularyLines());
    for (const e of EXCLUSIONS) ok(pinned.has(e.line), `${e.line} is pinned in vocabulary.ts`);
  });
});

describe('the grammar is the spec', () => {
  it('is the file in spec/, not a copy', () => {
    ok(grammarSource.includes('WDLStep {'), 'spec/grammar-0.1.ohm defines WDLStep');
    ok(!grammarSource.includes('=>'), 'carries no semantic actions');
  });

  it('holds unrecognized input rather than failing on it', () => {
    const step = stepParser.parseStep('10 Thruster @ 95lb, some phrase nobody taught the parser');
    eq(step.movement, 'Thruster');
    eq(step.notes, ['some phrase nobody taught the parser']);
  });

  it('reports what it cannot read, by position', () => {
    const got = stepParser.tryStep('');
    eq(got.ok, false);
  });
});
