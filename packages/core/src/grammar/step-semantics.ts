/**
 * What the step-line grammar *means*.
 *
 * `spec/grammar-0.1.ohm` states the shape of a step line and carries no
 * semantic actions — that separation is the reason Ohm was chosen (see
 * docs/context/settled-decisions.md). This file is the other half: one action
 * per production, mapping a parse into the `Step` in `../ast.ts`.
 *
 * It is not wired into `parse.ts`. Today it runs beside the hand-written parser
 * as a differential test (`test/grammar.test.ts`), and it swaps in only once the
 * grammar covers all of phase 2 — steps and block headers share their lexical
 * layer (durations in `cap 12min` and `every 90s`, targets as inherited `@`,
 * `21-15-9` as a ladder against `8-12` as a range), so landing steps alone would
 * mean reworking these actions once headers force those productions apart.
 *
 * The grammar source is **handed in** rather than read, for the same reason the
 * movement registry is (see `../env.ts`): nothing under `src/` opens a file or
 * knows a path. A Node host reads `spec/grammar-0.1.ohm`; a browser fetches it.
 *
 * Where the meaning is already written down — thresholds, targets, durations —
 * this delegates to `../units.ts` rather than re-deriving it. Two derivations of
 * `95% of heavy-single` is exactly the duplication the grammar exists to end.
 */

// Vendored, and imported by relative path on purpose: nothing under `src/`
// resolves a bare specifier, because the browser emit has no resolver to do it
// with. See `vendor/README.md`.
import * as ohm from './vendor/ohm.js';
import type { Step, Unit, Load, Laterality } from '../ast.ts';
import { parseDuration, parseTarget, parseThreshold } from '../units.ts';

/** What a host supplies alongside the line: where it came from. */
export interface StepOrigin { line: number; comments: string[] }

export type StepMatch =
  | { ok: true; step: Step }
  | { ok: false; message: string };

export interface StepParser {
  /** Parse one step line. Throws if the grammar does not match it. */
  parseStep(text: string, origin?: StepOrigin): Step;
  /** The same, reporting a failure instead of throwing. */
  tryStep(text: string, origin?: StepOrigin): StepMatch;
}

const blank = (origin: StepOrigin): Step => ({
  node: 'step', movement: '', quantity: { kind: 'open' },
  targets: [], flags: [], notes: [], comments: origin.comments, line: origin.line,
});

const num = (n: { sourceString: string }) => Number(n.sourceString);

/**
 * `400 meters` and `400 m` are the same distance. Kept identical to the
 * normalization in `parseQuantity`, which is the thing this must reproduce.
 */
function distanceUnit(word: string): 'm' | 'km' | 'mi' | 'ft' | 'yd' {
  const u = word.toLowerCase();
  const norm = u.startsWith('me') ? 'm'
    : u.startsWith('mi') && u !== 'mi' ? 'mi'
      : u === 'feet' ? 'ft' : u;
  return norm as never;
}

/** `12 minutes`, `45 seconds`, `1 hour` — spelled out, so the word carries the scale. */
const durationScale = (word: string): number =>
  (/^h/i.test(word) ? 3600 : /^m/i.test(word) ? 60 : 1);

/**
 * One side of `(women 105lb / men 145lb)`.
 *
 * The grammar has already proved the shape, so this reads the pieces back off
 * the matched text with the same expression `peelRx` uses — one derivation of
 * what a division load looks like, not two.
 */
function rxSide(text: string): { who?: string; value: number; unit?: string } {
  const g = text.trim().match(/^(?:(women|men|w|m)\s+)?(\d+(?:\.\d+)?)\s*([a-z#]*)$/i)!;
  const who = g[1] ? (/^w/i.test(g[1]) ? 'women' : 'men') : undefined;
  const unit = g[3] ? (g[3] === '#' ? 'lb' : g[3].toLowerCase().replace(/s$/, '')) : undefined;
  return { who, value: Number(g[2]), unit };
}

/**
 * Build a step parser over a grammar source.
 *
 * The grammar is compiled once and the semantics attached once; parsing a line
 * after that is a match plus a walk.
 */
export function makeStepParser(grammarSource: string): StepParser {
  const grammar = ohm.grammar(grammarSource);
  const semantics = grammar.createSemantics();

  // ---------- quantities ----------
  //
  // `unit()` answers "what amount is this?" and nothing else. Every duration
  // form routes through `parseDuration`, so `1min30s`, `1:30` and `90 seconds`
  // cannot drift apart from the way the rest of the core reads them.

  semantics.addOperation<Unit>('unit()', {
    // No amount has a bare terminal for its meaning, and a default that
    // returned `open` would turn a missing action into a step with no
    // measure — the quietest wrong answer available.
    _terminal(): Unit { throw new Error('step-semantics: asked a terminal for an amount'); },
    _nonterminal(...children) {
      // `quantityBody` is a pass-through: an alternation with no meaning of its
      // own. Anything else reaching here is a missing action, and saying which
      // one beats returning a plausible wrong amount.
      if (children.length === 1) return children[0].unit();
      throw new Error(`step-semantics: no unit action for \`${this.ctorName}\``);
    },

    anyQuantity(body, _end) { return body.unit(); },

    spacedQuantity_cal(n, _s, _w) { return { kind: 'calories', value: num(n) }; },
    spacedQuantity_reps(n, _s, _w) { return { kind: 'reps', value: num(n) }; },
    spacedQuantity_duration(n, _s, w) {
      return { kind: 'duration', seconds: num(n) * durationScale(w.sourceString) };
    },
    spacedQuantity_distance(n, _s, w) {
      return { kind: 'distance', value: num(n), unit: distanceUnit(w.sourceString) };
    },

    unspacedQuantity_range(a, _dash, b) {
      return { kind: 'range', min: num(a), max: num(b) };
    },
    unspacedQuantity_floor(i, _plus) { return { kind: 'floor', value: num(i) }; },
    unspacedQuantity_distance(n, u) {
      return { kind: 'distance', value: num(n), unit: distanceUnit(u.sourceString) };
    },
    unspacedQuantity_cal(i, _w) { return { kind: 'calories', value: num(i) }; },
    unspacedQuantity_duration(d) { return d.unit(); },
    unspacedQuantity_reps(i) { return { kind: 'reps', value: num(i) }; },

    // Every duration spelling means the same thing to `parseDuration`, and the
    // grammar has already ruled out the spellings it must not accept here.
    durationQty_hms(_h, _hu, _min, _sec) { return parseDuration(this.sourceString, true)!; },
    durationQty_ms(_m, _mu, _sec) { return parseDuration(this.sourceString, true)!; },
    durationQty_s(_s, _su) { return parseDuration(this.sourceString, true)!; },
    durationQty_clock(_m, _colon, _s) { return parseDuration(this.sourceString, true)!; },

    // `until HR < Z2` and `until power > 250W`. The grammar has proved the
    // shape; `parseThreshold` is where what it means already lives.
    threshold_zone(_u, _s1, _metric, _s2, _cmp, _s3, _zone) {
      return parseThreshold(this.sourceString)!;
    },
    threshold_value(_u, _s1, _metric, _s2, _cmp, _s3, _n, _s4, _rate) {
      return parseThreshold(this.sourceString)!;
    },
  });

  // ---------- everything that contributes to a step ----------
  //
  // `addTo` mutates rather than returning, because a step line's parts are not
  // independent: `@ 20lb shared` puts a load in one place and a team mode in
  // another, and the order the parts arrive in is the order the old parser
  // applied them.

  semantics.addOperation<void>('addTo(step)', {
    _nonterminal(...children) {
      // `stepPart` is a pass-through: an alternation with exactly one child and
      // no meaning of its own. Anything else reaching here is a missing action,
      // and saying so by name beats a silent no-op that drops a load.
      if (children.length === 1) { children[0].addTo(this.args.step); return; }
      throw new Error(`step-semantics: no addTo action for \`${this.ctorName}\``);
    },

    // --- the leading amount ---
    leadQuantity_threshold(t) { this.args.step.quantity = t.unit(); },
    leadQuantity_clockMax(d, _s1, _max, _s2) {
      // `2min max Push-Up` — the clock ends the step, the reps are what it
      // measures. Completion and measurement are different facts (spec §4, N6).
      const step = this.args.step;
      step.quantity = d.unit();
      step.measures = 'reps';
      step.flags.push('max');
    },
    leadQuantity_max(_max, _s) { this.args.step.quantity = { kind: 'max' }; },
    leadQuantity_plain(q, _s) { this.args.step.quantity = q.unit(); },

    // --- what may trail a movement ---
    targetGroup_flag(_at, word) { this.args.step.flags.push(word.sourceString); },
    targetGroup_target(_at, _s, text) { text.addTo(this.args.step); },

    targetText(atom, tails) {
      const step = this.args.step;
      step.targets.push(parseTarget(atom.sourceString));
      // `9kg to 10ft` is a load plus a target height.
      for (const tail of tails.children) step.targets.push(parseTarget(tail.child(3).sourceString));
    },

    laterality(_open, word, _close) {
      const m = word.sourceString.toLowerCase();
      this.args.step.laterality = (m === 'total' ? 'split' : m) as Laterality;
    },

    rxSplit(_o, _s1, a, _s2, _slash, _s3, b, _s4, _c) {
      const left = rxSide(a.sourceString), right = rxSide(b.sourceString);
      // A unit on one side covers both: `(105/145lb)` is two weights in pounds.
      const unit = left.unit ?? right.unit;
      // Labels win. Unlabelled, the heavier is the men's, whichever side it is on.
      const [women, men] = left.who && right.who
        ? (left.who === 'women' ? [left, right] : [right, left])
        : (left.value <= right.value ? [left, right] : [right, left]);
      const load = (side: typeof left): Load =>
        ({ kind: 'absolute', value: side.value, unit: (side.unit ?? unit) as never });
      this.args.step.rx = { women: load(women), men: load(men) };
    },

    thresholdPart(t) { this.args.step.quantity = t.unit(); },

    trailingQualifier_limb(_each, _s, limb) {
      const step = this.args.step;
      step.laterality = 'per-side';
      step.limb = limb.sourceString.toLowerCase();
    },
    trailingQualifier_side(side, _s, limb) {
      const step = this.args.step;
      step.side = side.sourceString.toLowerCase() as never;
      step.limb = limb.sourceString.toLowerCase();
    },
    trailingQualifier_team(word) { this.args.step.team = word.sourceString.toLowerCase() as never; },
    trailingQualifier_alternating(_word) {
      // A counting mode, not part of the name (registry §6): it maps to `split`
      // and survives as a note.
      const step = this.args.step;
      step.laterality = 'split';
      step.notes.push('alternating');
    },
    trailingQualifier_flag(word) { this.args.step.flags.push(word.sourceString.toLowerCase()); },
    trailingQualifier_sets(_x, _s, n) { this.args.step.sets = num(n); },

    // --- comma-separated modifiers ---
    modifier_tempo(_t, _s, word) { this.args.step.tempo = word.sourceString; },
    modifier_count(_c, _s, word) {
      const w = word.sourceString.toLowerCase();
      this.args.step.measures = (w.startsWith('cal') ? 'calories' : w) as never;
    },
    modifier_perRound(_plus, n, _s1, _each, _s2, _round) {
      this.args.step.perRound = { delta: num(n), unit: 'reps' };
    },
    modifier_qualifier(q) { q.addTo(this.args.step); },
    modifier_note(_note, _s, body) { this.args.step.notes.push(body.noteText()); },
    modifier_flag(word) { this.args.step.flags.push(word.sourceString.toLowerCase()); },
    modifier_prose(_word, _rest) { this.args.step.notes.push(this.sourceString.trim()); },
    modifier_target(g) { g.addTo(this.args.step); },
    // Unrecognized input, held verbatim. That it lands in `notes` beside an
    // authored `note:` is the known debt queue item 0d exists to close; until
    // there is somewhere else for it to live, reproducing the old parser here
    // is the point.
    modifier_unknown(_rest) { this.args.step.notes.push(this.sourceString.trim()); },
  });

  semantics.addOperation<string>('noteText()', {
    quotedOrRest_quoted(_open, inner, _close) { return inner.sourceString; },
    quotedOrRest_bare(rest) { return rest.sourceString.trim(); },
  });

  // ---------- the step itself ----------

  semantics.addOperation<Step>('toStep(origin)', {
    step(one, tails) {
      const first = one.toStep(this.args.origin);
      if (tails.numChildren === 0) return first;

      // `A or B or C` — one step, several ways to do it. The first is the
      // prescription and stays in `movement`/`quantity`, so every consumer that
      // does not care about the choice is untouched.
      const parsed = [first, ...tails.children.map((t) => t.child(3).toStep(this.args.origin))];
      // An alternative that is only a name parses to an open quantity; that is
      // the shared-measure form, not an open-ended step.
      first.options = parsed.map((s) => ({
        movement: s.movement,
        quantity: s.quantity.kind === 'open' ? first.quantity : s.quantity,
      }));
      first.optionsForm = 'inline';
      return first;
    },

    oneStep(lead, alt, movement, parts, mods) {
      const step = blank(this.args.origin);
      if (lead.numChildren) lead.child(0).addTo(step);
      if (alt.numChildren) {
        // `10 alternating DB Snatch` — the word sits before the movement name,
        // which is how it is written on a whiteboard.
        step.laterality = 'split';
        step.notes.push('alternating');
      }
      step.movement = movement.sourceString.trim();
      for (const p of parts.children) p.child(1).addTo(step);
      for (const m of mods.children) m.child(3).addTo(step);
      return step;
    },
  });

  const origin = (o?: StepOrigin): StepOrigin => o ?? { line: 0, comments: [] };

  return {
    tryStep(text, o) {
      const m = grammar.match(text, 'step');
      if (m.failed()) return { ok: false, message: m.shortMessage ?? 'no match' };
      return { ok: true, step: semantics(m).toStep(origin(o)) };
    },
    parseStep(text, o) {
      const m = grammar.match(text, 'step');
      if (m.failed()) throw new Error(`step-semantics: ${m.message}`);
      return semantics(m).toStep(origin(o));
    },
  };
}
