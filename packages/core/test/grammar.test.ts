/**
 * Every line this project has, read by the grammar that is now the parser.
 *
 * This file used to be a *differential* test: `spec/grammar-0.1.ohm` plus the
 * semantics under `src/grammar/` against the hand-written regex chain, line for
 * line, with the lines they read differently listed as exclusions. Queue item 0a
 * swapped the chain out, and a test comparing an implementation to itself
 * measures nothing — so what it asks is now the half that never depended on
 * there being two implementations:
 *
 * 1. **Coverage, counted out loud.** Every step line, block header, rest, score,
 *    directive and title in `examples/corpus`, in `spec-0.1.md` and in
 *    `test/golden/vocabulary.ts` is fed to the start rule for its kind, and the
 *    count is the suite's title. A line the grammar cannot read is a failure.
 * 2. **The lines it cannot read are listed with a reason**, and a line that
 *    starts reading fails as stale. That contract is what the exclusions had and
 *    it is worth more here, because these are the shared defects — the one thing
 *    a differential test could never see, since a line neither side reads sails
 *    past it and past the round trip alike.
 * 3. **The rules the exclusions used to describe are asserted directly**, on the
 *    expected tree, at the bottom of this file. The `@`-plus-digit rule was only
 *    ever visible here as "the two disagree"; now it is visible as what a step
 *    with `@95lb` in it contains.
 *
 * What each line *means* is pinned in `test/golden/vocabulary.json`, which is
 * where a reading changes visibly. This file is about which lines are read at
 * all, and it draws on all three sources so that a collapse in one of them
 * cannot hide behind the other two.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { readLines, type Line } from '../src/lines.ts';
import { required } from '../src/env.ts';
import { wdl } from '../src/grammar/parser.ts';
import { STEP_FORMS, SOURCES, strip } from './golden/vocabulary.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '../../..');

const grammarSource = readFileSync(join(repo, 'spec/grammar-0.1.ohm'), 'utf8');

/**
 * Lines the grammar does not read, and why.
 *
 * *Rationale restated 2026-08-15.* These were listed as the **shared** defects —
 * the lines *neither implementation* read — because that was the one shape a
 * differential test could not see on its own, a line both sides got wrong being
 * indistinguishable from a line both sides got right. With one implementation
 * left that framing means nothing: there is nothing to share a defect with. What
 * the list is now is simpler and still worth having — **the lines no rule reads
 * at all**, which is the honest half of the coverage counts below: the headline
 * number is out of a set this list has been taken out of, so the list has to be
 * visible beside it rather than inferred from a gap in a count.
 *
 * Each entry is a claim and the suite checks it both ways — an unlisted
 * unreadable line fails, and a listed line the grammar starts reading fails as
 * stale — and every entry must also be a form `vocabulary.ts` pins, so what it
 * currently *does* is a diff somebody can read. Being unreadable is not by itself
 * a defect worth a queue item; whether a line here should be read is a question
 * about the language, and the ones under decision are marked pending in
 * `vocabulary.test.ts` like every other known-wrong reading.
 */
const STEP_REJECTS = new Map([
  // A line that is *only* a completion condition. `movement` needs at least one
  // character, so this is the one step shape the language has no reading for.
  // `parse` reports `unreadable step` and holds the text as the movement name;
  // the old chain made a step with an empty movement and said nothing.
  ['until HR > 160bpm', 'a line that is only a threshold names nothing to do'],
]);

/**
 * Empty as of 2026-08-15, and it is worth saying what left it.
 *
 * Its three entries were `rest 45 seconds`, `rest 2 mins` and `rest 1 hour` —
 * every spelled-out duration word worked in a *step's* quantity position and not
 * one of them worked after `rest`, because `parseDuration` knew only
 * `h`/`min`/`m`/`s` while the spelled-out spellings lived in `parseQuantity`,
 * which the rest path never reaches. Spec §3 accepts them "wherever a duration is
 * expected" and a rest is a duration position, so the prose was right and the
 * parser was wrong. Fixed by folding the spellings inside `parseDuration` itself.
 */
const REST_REJECTS = new Map<string, string>([]);

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

// ---------- reading them ----------

type Read = (line: string) => { ok: boolean; message?: string };

/**
 * Every start rule, asked only whether it reads the line.
 *
 * What the reading *is* belongs in `test/golden/vocabulary.json`, where a human
 * reads the diff. Asserting it a second time here, against a tree written out by
 * the same semantics, would be a test of nothing.
 */
const g = wdl();
const readStep: Read = (l) => g.tryStep(l);
const readHeader: Read = (l) => g.tryHeader(l);
const readRest: Read = (l) => g.tryRest(l);
const readScore: Read = (l) => g.tryScore(l);
const readDirective: Read = (l) => g.tryDirective(l);
const readTitle: Read = (l) => g.tryTitle(l);

interface Tally {
  checked: number;
  read: number;
  /** Lines the grammar cannot read and nobody listed. Every one is a finding. */
  unreadable: string[];
  /** Listed rejects the grammar reads now — the list has gone stale. */
  staleRejects: string[];
}

interface Area {
  what: string;
  lines: (h: Harvest) => string[];
  read: Read;
  /** Lines no rule accepts, with the reason each one is a defect and not a shape. */
  rejects: Map<string, string>;
  /** How many lines each source must contribute, so a silent collapse fails. */
  atLeast: [number, number, number];
}

function tally(area: Area, lines: string[]): Tally {
  const t: Tally = { checked: 0, read: 0, unreadable: [], staleRejects: [] };
  for (const line of lines) {
    const got = area.read(line);
    if (area.rejects.has(line)) {
      if (got.ok) t.staleRejects.push(`${line} — the grammar reads it now: ${area.rejects.get(line)}`);
      continue;
    }
    t.checked++;
    if (got.ok) t.read++;
    else t.unreadable.push(`${line} — ${got.message}`);
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
    read: readStep,
    rejects: STEP_REJECTS,
    atLeast: [300, 40, 130],
  },
  {
    what: 'block headers',
    lines: (h) => h.headers,
    read: readHeader,
    rejects: new Map(),
    atLeast: [90, 20, 40],
  },
  {
    what: 'rest lines',
    lines: (h) => h.rests,
    read: readRest,
    rejects: REST_REJECTS,
    atLeast: [10, 4, 9],
  },
  {
    what: 'score lines',
    lines: (h) => h.scores,
    read: readScore,
    rejects: new Map(),
    atLeast: [10, 4, 8],
  },
  {
    what: 'directive lines',
    lines: (h) => h.directives,
    read: readDirective,
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
    read: readTitle,
    rejects: new Map(),
    atLeast: [10, 1, 1],
  },
];

const pinnedForms = new Set([
  ...STEP_FORMS.flatMap((gr) => gr.lines),
  ...SOURCES.flatMap((s) => {
    const h = harvest(readLines(s.src));
    return [...h.headers, ...h.rests, ...h.scores];
  }),
]);

for (const area of AREAS) {
  const tallies = harvests.map(([what, h]) => ({ what, tally: tally(area, area.lines(h)) }));
  const checked = tallies.reduce((n, s) => n + s.tally.checked, 0);
  const read = tallies.reduce((n, s) => n + s.tally.read, 0);

  // The count is in the suite title because the count is the result. A summary
  // line reading `the grammar reads 4/4` would say nothing about what was
  // measured, and this test exists to make one number true.
  describe(`the grammar reads ${read}/${checked} ${area.what}`, () => {
    for (const { what, tally: t } of tallies) {
      it(`${what}: ${t.read}/${t.checked} read`, () => {
        eq(t.unreadable, [], `${t.unreadable.length} lines the grammar cannot read`);
        eq(t.staleRejects, [], `${t.staleRejects.length} listed rejects it reads now`);
      });
    }

    it('draws on all three sources, not whichever one still loads', () => {
      tallies.forEach(({ what, tally: t }, i) => {
        ok(t.checked >= area.atLeast[i], `${what} contributed ${t.checked} lines`);
      });
    });

    it(`states each of the ${area.rejects.size} lines it does not read`, () => {
      // The rejects are part of the result: the headline number above is out of a
      // set this list has been taken out of, and that has to be visible here
      // rather than inferred from a gap in a count.
      for (const [line, why] of area.rejects) {
        ok(why.length > 10, `${line} has a reason`);
        // And every one is a form the vocabulary pins, per the standing rule in
        // lessons-learned.md: a parsing defect becomes permutations.
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

  it('is the file the host handed the core, not a second copy of it', () => {
    // The plumbing queue item 0a added, asserted rather than assumed: `node.ts`
    // reads `spec/grammar-0.1.ohm` and provides it, and `wdl()` compiles what it
    // was given. If those ever came apart the suite would be testing a grammar
    // nothing runs.
    eq(required('grammar'), grammarSource);
  });

  /**
   * Unknown is a first-class state, and *held apart from everything that means
   * something* — which is the half the grammar could not state on its own. The
   * `unknown` production has always matched this text; until 2026-08-15 the
   * semantics then pushed it into `notes`, beside an authored `note: "…"`, so
   * the tree could no longer tell them apart and the note was rendered.
   */
  it('holds unrecognized step input rather than failing on it', () => {
    const step = g.parseStep('10 Thruster @ 95lb, some phrase nobody taught the parser');
    eq(step.movement, 'Thruster');
    eq(step.unknown, ['some phrase nobody taught the parser']);
    eq(step.notes, []);
  });

  it('keeps an unknown apart from an authored note on the same line', () => {
    const step = g.parseStep('10 Thruster, note: "keep the elbows up", with a band');
    eq(step.notes, ['keep the elbows up']);
    eq(step.unknown, ['with a band']);
  });

  /**
   * A parenthetical the language does not read — neither a laterality word nor
   * an rx split — held whole in `unknown` rather than swallowed into the name
   * (queue item 14). The `s` `wdl fmt` used to staple onto `... (each direction)`
   * goes with it: once the parenthetical is out of `movement`, `pluralize`
   * never sees it.
   */
  it('holds an unread parenthetical rather than naming a movement after it', () => {
    const step = g.parseStep('12 Around The Worlds (each direction)');
    eq(step.movement, 'Around The Worlds');
    eq(step.unknown, ['(each direction)']);
    eq(step.notes, []);
  });

  it('still reads the recognised parenthetical forms ahead of the fallback', () => {
    eq(g.parseStep('10 Pistol (split)').laterality, 'split');
    eq(g.parseStep('10 Pistol (BOTH)').laterality, 'both');
    const rx = g.parseStep('30 Clean & Jerk (women 105lb / men 145lb)');
    eq(rx.movement, 'Clean & Jerk');
    eq(rx.unknown, undefined);
  });

  it('reads a bare-label header as a section', () => {
    // No digit, no comma, no kind-word at the front: a custom grouping label,
    // the inert container `conditioning:` produces, for any label (spec §2,
    // §11.1). The `note` that keeps it from being silent is `validate.ts`'s.
    const block = g.parseHeader('some shape nobody taught the parser');
    eq(block.type, 'section');
    eq(block.name, 'some shape nobody taught the parser');
  });

  it('holds a digit-bearing unrecognized block header rather than failing on it', () => {
    const block = g.parseHeader('3 shapes nobody taught the parser');
    eq(block.type, 'sequence');
    eq(block.name, '3 shapes nobody taught the parser');
  });

  it('keeps a kind-word header with no parameter an unread sequence, not a section', () => {
    // `RFT` names rounds without a count — a kind missing its parameter, which
    // spec §5.2 keeps as a reported error rather than inventing a reading.
    const block = g.parseHeader('RFT');
    eq(block.type, 'sequence');
    eq(block.name, 'RFT');
  });

  /**
   * The header's *modifier* position, which is the block-level twin: the kind is
   * read, the flag beside it is read, and the word nobody taught the language is
   * held apart from both rather than filed as a third flag.
   */
  it('holds an unrecognized header modifier apart from the flags', () => {
    const block = g.parseHeader('3 rounds, unbroken, wibble');
    eq(block.type, 'repeat');
    eq(block.count, 3);
    eq(block.flags, ['rounds', 'unbroken']);
    eq(block.unknown, ['wibble']);
  });

  /**
   * A block's *kind* may be stated in any comma position, which is what spec
   * §5.0's "order is free on input" says about the whole header rather than about
   * its opening segment. Until 2026-08-16 a kind after a comma was read as text
   * nobody taught the language, and `for time` made that silent instead of loud:
   * it parses on its own, so `for time, 3 rounds` was a perfectly good sequence
   * that ran once.
   *
   * Asserted as an equality between the two spellings rather than field by field,
   * because "these are one block" is the actual claim.
   */
  it('reads a kind stated after a comma, in any position', () => {
    const both = (a: string, b: string) => eq(strip(g.parseHeader(a)), strip(g.parseHeader(b)), `${a} / ${b}`);
    both('for time, 3 rounds', '3 rounds for time');
    both('for time, 21-15-9', '21-15-9 for time');
    both('for time, AMRAP 12min', 'AMRAP 12min for time');
    both('for time, team of 2', 'team of 2 for time');
    both('for time, cap 12min, 3 rounds', '3 rounds for time, cap 12min');
  });

  /**
   * The boundary the rule above needs, and the reason it is `blockKind` in
   * `blockModifier` rather than `headerKind`: a header states **at most one**
   * kind. A second is a contradiction and not a reordering — `AMRAP 12min,
   * 3 rounds` cannot be both — so the first stands and the second is held
   * verbatim. Letting the later one win would leave the AMRAP's window on a
   * `repeat`, whose formatter writes no window, which is a silent loss of exactly
   * the shape this rule exists to close.
   */
  it('takes the first kind a header states and holds any second one', () => {
    const block = g.parseHeader('AMRAP 12min, 3 rounds');
    eq(block.type, 'amrap');
    eq(block.duration, { kind: 'duration', seconds: 720 });
    eq(block.unknown, ['3 rounds']);
  });

  /**
   * And the head that is not a kind at all. `cap 12min` is a modifier written
   * first, which the grammar has no reading for in that position — so the block is
   * still *named* and still reported, exactly as before, while the rounds after it
   * are now read. Both halves matter: widening the kind rule must not quietly turn
   * an unreadable head into a readable header.
   */
  it('keeps an unreadable head named when the kind arrives after a comma', () => {
    const block = g.parseHeader('cap 12min, 3 rounds');
    eq(block.type, 'repeat');
    eq(block.count, 3);
    eq(block.name, 'cap 12min');
  });

  /**
   * `3 RFT` is `3 rounds for time` said short. Asserted as an equality for the
   * same reason the comma spellings are: the claim is that they are one block,
   * not that RFT happens to set three fields correctly. A bare `RFT` is left
   * unread on purpose — it names rounds without saying how many, and there is no
   * unbounded repeat to read it as (spec §5.2) — so it stays a reported header.
   */
  it('reads `3 RFT` as three rounds for time, and declines a bare `RFT`', () => {
    eq(strip(g.parseHeader('3 RFT')), strip(g.parseHeader('3 rounds for time')));
    eq(strip(g.parseHeader('3rft')), strip(g.parseHeader('3 rounds for time')), 'tight and lowercase');
    // The word has to end where the kind ends, or anything starting `RFT` reads
    // as rounds; and with no count there is no kind at all.
    eq(g.parseHeader('3 RFTX').name, '3 RFTX');
    eq(g.parseHeader('RFT').name, 'RFT');
  });

  it('reports what it cannot read, by position', () => {
    eq(g.tryStep('').ok, false);
  });

  /**
   * `on cap:` and `tiebreak:` are the one thing here with no differential
   * counterpart: which score they attach to is a question about *lines*, not
   * about one line, and it lives in the caller. So the line itself is checked
   * directly rather than through the harness above.
   */
  it('reads a score qualifier line', () => {
    eq(g.parseQualifier('on cap: reps completed'), { key: 'onCap', text: 'reps completed' });
    eq(g.parseQualifier('tiebreak: reps at 5min'), { key: 'tiebreak', text: 'reps at 5min' });
  });

  /**
   * Variants are the other multi-line assembly, for the same reason: which
   * variant a field belongs to is a question about several lines. Both spellings
   * exist because one variant with one field is a line where three with three
   * fields is a table (spec §11), and a comma separates fields inside braces
   * where on a line of its own it is just a comma.
   */
  it('reads both spellings of a variant', () => {
    eq(g.parseVariant('women:'), { name: 'women' });
    eq(g.parseVariant('women: {load: 65lb}'),
      { name: 'women', fields: [{ key: 'load', value: '65lb' }] });
    eq(g.parseVariant('women: {load: 65lb, reps: 15}'),
      { name: 'women', fields: [{ key: 'load', value: '65lb' }, { key: 'reps', value: '15' }] });
    eq(g.parseField('load: 65lb'), { key: 'load', value: '65lb' });
  });
});

/**
 * The rules the exclusion list used to stand for.
 *
 * Each of these was, until the swap, visible here only as "the two implementations
 * disagree" plus a sentence of prose. A disagreement is not a specification, and
 * with one implementation left there is nothing to disagree with — so what each
 * rule *says* is asserted on the tree instead. Every line below is also a pinned
 * vocabulary form; these are here because a rule stated once in a test that names
 * it is worth more than the same fact buried in a 9,000-line snapshot.
 */
describe('the rules the exclusions used to describe', () => {
  const step = (line: string) => strip(g.parseStep(line));

  it('reads the first character after an `@`, and nothing else', () => {
    // A letter opens a flag, a digit opens a target, and whether a unit is
    // present has nothing to do with it. The old chain swept `/@(\w[\w-]*)/g`
    // over the whole line first, and `\w` matches digits, so every tight load
    // became a flag and the weight was gone.
    // Key order is `strip`'s, which sorts — the same shape the vocabulary pins.
    const load = { kind: 'load', load: { kind: 'absolute', unit: 'lb', value: 95 } };
    eq(step('10 Thruster @95lb').targets, [load], 'tight');
    eq(step('10 Thruster @ 95lb').targets, [load], 'spaced — the same reading');
    eq(step('10 Thruster @95lb').flags, undefined, 'and no flag — `strip` drops an empty array');
    // No unit, still a target: `@95` on a whiteboard is a weight, and `raw` says
    // "a target was written and nothing can be computed from it" rather than
    // inventing pounds. See known-debts.md.
    eq(step('10 Thruster @95').targets, [{ kind: 'raw', text: '95' }]);
    // The flag form needs the `@` tight against a *letter*, because a spaced
    // target legitimately begins with one — `@ Z2`, `@ RPE 8`, `@ of
    // heavy-single`. So `@tiebreak` is a flag and `@ tiebreak` is a target, and
    // that asymmetry is stated rather than left to rule ordering.
    eq(step('21 Thruster @tiebreak').flags, ['tiebreak']);
    eq(step('21 Thruster @ tiebreak').targets, [{ kind: 'raw', text: 'tiebreak' }]);
  });

  it('reads an `@` group wherever it appears, comma or no comma', () => {
    // The old `@` split ran over the first comma segment only, so a target after
    // a comma fell through to the catch-all and became a *note* — invisible to
    // analysis, to the builder and to the board, with `wdl check` reporting ok.
    eq(step('10 Thruster, @ 95lb').targets.length, 1);
    // `strip` drops an empty array, so an absent `notes` is an empty one.
    eq(step('10 Thruster, @ 95lb').notes, undefined);
    // And on a header, where the same defect cost the children their load.
    eq(strip(g.parseHeader('3 rounds, @ 95lb')).inherited.length, 1);
    eq(strip(g.parseHeader('3 rounds, @ 95lb')).flags, ['rounds']);
  });

  it('reads an rx split wherever it appears, not only at the end', () => {
    // `peelRx` only fired at the end of a comma segment, so a space-separated
    // qualifier after the paren took the whole thing into the movement *name* —
    // both loads lost and the name matching no registry entry, so the step fell
    // out of muscle and volume analysis too.
    const s = step('10 Deadlift (105/145) each arm');
    eq(s.movement, 'Deadlift');
    eq(s.limb, 'arm');
    eq(s.rx, {
      men: { kind: 'absolute', value: 145 },
      women: { kind: 'absolute', value: 105 },
    });
  });

  it('applies a step\'s parts left to right', () => {
    // `peelTrailingQualifiers` stripped from the end, so it read right to left,
    // and the `@` sweep hoisted every flag to the front. Neither was a decision.
    eq(step('10 Deadlift unbroken building').flags, ['unbroken', 'building']);
    eq(step('10 Deadlift building @tiebreak').flags, ['building', 'tiebreak']);
    // The same order, where it decides a value rather than an array: the paren
    // is read first and `each leg` last, so `per-side` wins.
    eq(step('5 Squat (both) each leg').laterality, 'per-side');
  });

  it('does not require min < max on a range, because that is not a shape', () => {
    // The one place the notation genuinely cannot reach. A PEG states shapes, and
    // `min < max` is a constraint on *values* — `parseQuantity` checked it and
    // left the digits in the movement name when it failed. So `10-5 Squat` is a
    // descending range now, and if it should be refused that is a validation rule
    // with a message, not a parse that quietly renames the movement.
    eq(step('10-5 Squat').quantity, { kind: 'range', max: 5, min: 10 });
    eq(step('10-5 Squat').movement, 'Squat');
  });

  it('is regular about a spelled-out unit, spaced or not', () => {
    // `20cal` and `20 calories` were amounts and `20calories` was not, which is an
    // accident of a `\\s*` in one regex rather than a decision.
    const cal = { kind: 'calories', value: 20 };
    for (const line of ['20cal Row', '20 cal Row', '20calories Row', '20 calories Row']) {
      eq(step(line).quantity, cal, line);
      eq(step(line).movement, 'Row', line);
    }
  });

  it('lets a comma end nothing', () => {
    // Written into the grammar during the swap: required, a modifier after a
    // comma made `10 Thruster,` unreadable and took the movement and the amount
    // with it. A stray keystroke is a steep price on a format written by hand.
    eq(step('10 Thruster,').movement, 'Thruster');
    eq(step('10 Thruster,').quantity, { kind: 'reps', value: 10 });
    eq(strip(g.parseHeader('3 rounds,')), strip(g.parseHeader('3 rounds')));
  });
});
