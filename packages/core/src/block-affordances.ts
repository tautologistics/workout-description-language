/**
 * What a block header can take next — the block-level counterpart of the step
 * row's "what this movement supports" panel, and, like it, derived rather than
 * hand-kept.
 *
 * The grammar (`spec/grammar-0.1.ohm`) is the source of truth for the *set*: the
 * comma modifiers a header accepts are its `blockModifier_*` cases, and the
 * quantity a kind still needs is a `headerDuration` sitting in the kind's rule
 * body. What the grammar deliberately does not carry — it has no semantic
 * actions — is a human label and a default to splice in. Those two are the only
 * things annotated here, keyed by the grammar's own rule names, and
 * `test/block-affordances.test.ts` fails if a `blockModifier_*` case ever exists
 * with no annotation, if an annotation names a rule the grammar dropped, or if
 * an annotation's "already present" probe uses a word the rule does not match.
 * So the affordance cannot silently lag the grammar; only its wording is
 * maintained by hand. See `docs/context/topics/deliberately-not-done.md` — "a
 * field per property in the builder" — for why that distinction is the whole
 * point.
 */

/** The slice of an `ohm.Grammar` this module reads. `WdlParser.grammar` supplies it. */
export interface GrammarView {
  rules: Record<string, { body: { source: { contents: string } } }>;
}

/** A comma modifier a header can take, ready for the builder to offer. */
export interface ModifierOption {
  /** The grammar rule this came from, e.g. `blockModifier_cap`. */
  rule: string;
  /** One-line description, shown after the default text. */
  label: string;
  /** Editable default spliced into the line — grammatically valid on its own. */
  insert: string;
  /**
   * True when the header text already carries this modifier, so the builder
   * hides it (a header takes at most one `cap`, one `for time`, one label).
   * Absent for modifiers that may legitimately repeat or stack.
   */
  present?: (headerText: string) => boolean;
}

/** A kind that parses (or half-parses) without the quantity it needs. */
export interface KindCompletion {
  /** The grammar rule, e.g. `blockKind_amrap`. */
  rule: string;
  /**
   * Matches the header's leading token when it names this kind and nothing has
   * been added after it yet — derived from the rule's own literals.
   */
  head: RegExp;
  /** The `Block` field that, once set, means the quantity is already there. */
  filled: 'duration' | 'every';
  label: string;
  insert: string;
}

// ---------- annotation, keyed by grammar rule name ----------

/**
 * `null` marks a case that is real in the grammar but deliberately not offered:
 * `blockModifier_kind` is structural (you say what a block *is* by typing it,
 * not from a menu) and `blockModifier_unknown` is the catch-all. Keeping the
 * keys here — rather than omitting them — is what lets the coverage test tell
 * "handled, on purpose not shown" from "nobody wrote an entry".
 */
const MODIFIER_NOTES: Record<string, { label: string; insert: string; probe?: string[] } | null> = {
  blockModifier_cap: {
    label: 'a time cap for the whole block',
    insert: 'cap 12min',
    probe: ['cap'],
  },
  blockModifier_overrun: {
    label: 'what a cap does to the round in progress — carry it, cut it, or fail it',
    insert: 'carry on overrun',
    probe: ['on', 'overrun'],
  },
  blockModifier_wearing: {
    label: 'a load worn for every movement in the block',
    insert: 'wearing a weight vest',
    probe: ['wearing'],
  },
  blockModifier_label: {
    label: 'a name, so a score or another line can point at this block',
    insert: 'as this-block',
    probe: ['as'],
  },
  blockModifier_forTime: {
    label: 'score the block by the clock',
    insert: 'for time',
    probe: ['for', 'time'],
  },
  blockModifier_flag: {
    // The choices are filled in from the grammar at build time — see below.
    label: 'a block-wide flag',
    insert: 'unbroken',
  },
  blockModifier_target: {
    label: 'a load or pace the movements inherit',
    insert: '@ 95lb',
  },
  blockModifier_kind: null,
  blockModifier_unknown: null,
};

/**
 * Kinds whose grammar rule requires a `headerDuration` (or, for `every`, whose
 * whole point is the interval). The `insert` is a sensible whiteboard default;
 * `filled` names the field the semantics set once the quantity is read, so the
 * builder only offers the completion while it is genuinely missing.
 */
const KIND_NOTES: Record<string, { filled: 'duration' | 'every'; label: string; insert: string }> = {
  blockKind_amrap: { filled: 'duration', label: 'a time window — how long the AMRAP runs', insert: '12min' },
  blockKind_emom: { filled: 'every', label: 'a window — an E·MOM needs a length, e.g. 10min', insert: '10min' },
  blockKind_forDuration: { filled: 'duration', label: 'how long to keep working', insert: '20min' },
  blockKind_work: { filled: 'duration', label: 'how long the work interval lasts', insert: '30s' },
  blockKind_every: { filled: 'every', label: 'how often the clock fires', insert: '90s' },
};

// ---------- deriving from the grammar ----------

/**
 * Every `caseInsensitive<"...">` literal reachable from a rule body, in order,
 * resolving a leading reference to another rule one level deep so
 * `blockModifier_forTime` (`forTime modEnd`) yields `for`, `time`. Lower-cased.
 */
function literalsOf(g: GrammarView, rule: string, seen = new Set<string>()): string[] {
  const info = g.rules[rule];
  if (!info || seen.has(rule)) return [];
  seen.add(rule);
  const src = info.body.source.contents;
  const direct = [...src.matchAll(/caseInsensitive<"([^"]+)">/g)].map((m) => m[1].toLowerCase());
  if (direct.length) return direct;
  // No literals of its own: it may just delegate. Resolve bare rule references.
  const refs = [...src.matchAll(/(?:^|[|\s(])([a-z][A-Za-z0-9_]*)(?![A-Za-z0-9_<])/g)]
    .map((m) => m[1])
    .filter((r) => g.rules[r] && r !== rule);
  return refs.flatMap((r) => literalsOf(g, r, seen));
}

/**
 * Does this rule ask for a `headerDuration` — directly, or through `amrapWindow`
 * (`spaces headerDuration`), which is the one wrapper the grammar puts around it?
 * This is the quantity a kind completion offers to supply.
 */
function needsDuration(g: GrammarView, rule: string): boolean {
  return /\b(?:headerDuration|amrapWindow)\b/.test(g.rules[rule]?.body.source.contents ?? '');
}

/**
 * The literal word(s) that open a kind, up to where its quantity would go —
 * `blockKind_emom` gives `['e', 'mom']`, `blockKind_amrap` gives `['amrap']`.
 * Stops at the first `headerDuration`/`amrapWindow` so a kind's own name is all
 * that comes back, and follows a bare delegation (`blockKind_every` -> `every`
 * -> `everyWord`) to reach it.
 */
function kindHeadLiterals(g: GrammarView, rule: string, seen = new Set<string>()): string[] {
  const info = g.rules[rule];
  if (!info || seen.has(rule)) return [];
  seen.add(rule);
  const src = info.body.source.contents;
  const cut = src.search(/\b(?:headerDuration|amrapWindow)\b/);
  const scope = cut === -1 ? src : src.slice(0, cut);
  const lits = [...scope.matchAll(/caseInsensitive<"([^"]+)">/g)].map((m) => m[1].toLowerCase());
  if (lits.length) return lits;
  const firstRef = scope.match(/^\s*([a-z][A-Za-z0-9_]*)/);
  return firstRef && g.rules[firstRef[1]] ? kindHeadLiterals(g, firstRef[1], seen) : [];
}

/**
 * A regex over a header's leading token that fires only when the token names
 * this kind and carries nothing after it — `emom` becomes `/^e\d*mom$/i` so
 * `E2MOM` matches while `EMOM 10min` (two tokens) never reaches it.
 */
function headMatcher(literals: string[]): RegExp {
  if (!literals.length) return /^$/;
  // `e` + `mom` -> allow the optional set count the `integer?` in the rule permits.
  const body = literals.map((w, i) => escapeRe(w) + (i < literals.length - 1 ? '\\d*' : '')).join('');
  return new RegExp(`^${body}$`, 'i');
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "already carries this modifier" — the probe words, in order, on word boundaries. */
function probeFor(words: string[]): (headerText: string) => boolean {
  const re = new RegExp(`\\b${words.map(escapeRe).join('\\s+')}\\b`, 'i');
  return (t: string) => re.test(t);
}

// ---------- the public surface ----------

/**
 * The comma modifiers a block header can take, derived from the grammar's
 * `blockModifier_*` cases and annotated with a label and a default. A case with
 * no annotation still comes through — labelled generically, inserting its first
 * literal — so a new grammar rule is visible in the builder immediately rather
 * than silently missing; the test is what turns "visible but unlabelled" into a
 * failure that gets it a proper entry.
 */
export function blockModifierOptions(g: GrammarView): ModifierOption[] {
  const flagChoices = literalsOf(g, 'blockFlagWord');
  const out: ModifierOption[] = [];
  for (const rule of Object.keys(g.rules)) {
    if (!/^blockModifier_[a-z]/i.test(rule)) continue;
    const note = rule in MODIFIER_NOTES ? MODIFIER_NOTES[rule] : undefined;
    if (note === null) continue;                       // handled, deliberately not shown
    if (note) {
      let label = note.label;
      if (rule === 'blockModifier_flag' && flagChoices.length) {
        label = `a block-wide flag — ${flagChoices.join(', ')}`;
      }
      out.push({
        rule,
        label,
        insert: note.insert,
        present: note.probe ? probeFor(note.probe) : undefined,
      });
    } else {
      const lit = literalsOf(g, rule)[0];
      out.push({ rule, label: 'a block modifier', insert: lit ?? rule.replace(/^blockModifier_/, '') });
    }
  }
  return out;
}

/**
 * The kinds that need a quantity, so the builder can offer to finish a bare
 * `AMRAP:` or an `EMOM:` that never got its window. Every entry in `KIND_NOTES`
 * is checked against the grammar: the rule must exist and (except `every`, whose
 * interval is the kind) must reference `headerDuration`.
 */
export function blockKindCompletions(g: GrammarView): KindCompletion[] {
  const out: KindCompletion[] = [];
  for (const [rule, note] of Object.entries(KIND_NOTES)) {
    if (!g.rules[rule]) continue;
    out.push({
      rule,
      head: headMatcher(kindHeadLiterals(g, rule)),
      filled: note.filled,
      label: note.label,
      insert: note.insert,
    });
  }
  return out;
}

/**
 * What the coverage test asserts. Empty arrays mean the annotation and the
 * grammar are in step.
 */
export function affordanceCoverage(g: GrammarView): {
  /** `blockModifier_*` cases the grammar has and this file never mentions. */
  unannotatedModifiers: string[];
  /** Keys in the annotation maps naming a rule the grammar no longer has. */
  staleKeys: string[];
  /** Annotated "already present" probes that match a word the rule cannot. */
  badProbes: string[];
  /** `KIND_NOTES` entries whose rule needs no duration (and is not `every`). */
  kindsWithoutDuration: string[];
} {
  const modifierRules = Object.keys(g.rules).filter((r) => /^blockModifier_[a-z]/i.test(r));
  const unannotatedModifiers = modifierRules.filter((r) => !(r in MODIFIER_NOTES));

  const staleKeys = [
    ...Object.keys(MODIFIER_NOTES),
    ...Object.keys(KIND_NOTES),
  ].filter((r) => !g.rules[r]);

  const badProbes: string[] = [];
  for (const [rule, note] of Object.entries(MODIFIER_NOTES)) {
    if (!note?.probe || !g.rules[rule]) continue;
    const lits = literalsOf(g, rule);
    if (!note.probe.every((w) => lits.includes(w))) badProbes.push(rule);
  }

  // `every` is the one kind whose quantity is the interval itself, not a
  // `headerDuration`; every other annotated kind must show one in its rule.
  const kindsWithoutDuration = Object.keys(KIND_NOTES).filter(
    (r) => g.rules[r] && r !== 'blockKind_every' && !needsDuration(g, r),
  );

  return { unannotatedModifiers, staleKeys, badProbes, kindsWithoutDuration };
}
