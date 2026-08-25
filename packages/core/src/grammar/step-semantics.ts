/**
 * What the step-line grammar *means*.
 *
 * `spec/grammar-0.1.ohm` states the shape of a step line and carries no
 * semantic actions — that separation is the reason Ohm was chosen (see
 * docs/context/topics/settled-decisions.md). This file is the other half for the step
 * line: one action per production, mapping a parse into the `Step` in `../ast.ts`.
 *
 * The amounts, durations and thresholds a step is built out of are in
 * `lexical-semantics.ts`, because the block header is built out of the same ones;
 * `block-semantics.ts` is its counterpart for headers; `parser.ts` puts all three
 * on one semantics object and hands out the entry points.
 *
 * `parse.ts` runs this. `parseStep` matches the grammar's `step` rule and calls
 * `toStep` below; there is no other reading of a step line in the project.
 *
 * Where the meaning is already written down — thresholds, targets, durations —
 * this delegates to `../units.ts` rather than re-deriving it. Two derivations of
 * `95% of heavy-single` is exactly the duplication the grammar exists to end.
 */

import type { Semantics } from './vendor/ohm.js';
import type { Step, Load, Laterality } from '../ast.ts';
import { parseTarget } from '../units.ts';
import { num, origin, type Origin } from './lexical-semantics.ts';

export const blankStep = (o: Origin): Step => ({
  node: 'step', movement: '', quantity: { kind: 'open' },
  targets: [], flags: [], notes: [], comments: o.comments, line: o.line,
});

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

export function installStep(semantics: Semantics): void {
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

    /**
     * `5x5 Back Squat` — sets, then reps.
     *
     * It contributes exactly what the trailing `x5` contributes, which is the
     * whole argument for reading it: `3x10 Curl` and `10 Curl x3` are the same
     * prescription, so they produce the same tree and nothing downstream learns a
     * new concept. `sets` is already expanded by `timeline.ts` into that many
     * identical repetitions, so the rep total comes out right for free.
     *
     * Written with a trailing `x3` as well, the trailing one wins — it is read
     * later, and "the later qualifier wins" is the reading already settled for
     * every other part of a step line that is stated twice.
     */
    leadQuantity_setsByReps(sets, _s) { sets.addTo(this.args.step); },
    // Three children, not four: the trailing `~wordChar` is an inline lookahead
    // and contributes none, where a *rule application* like `headEnd` would have
    // contributed one even though it matches nothing.
    setsByReps(n, _x, reps) {
      this.args.step.sets = num(n);
      this.args.step.quantity = { kind: 'reps', value: num(reps) };
    },
    leadQuantity_plain(q, _s) { this.args.step.quantity = q.unit(); },
    // `100-150ft` — a range wearing a unit the language does not read (spec §3
    // gives a range to reps and nothing else). Held the way an unrecognized
    // comma modifier is: quantity stays `open` rather than a guess, the raw
    // text goes in `unknown` so `validate.ts`'s existing `unread()` reports it,
    // and the movement name is left correctly *without* the digits, so the step
    // still resolves against the registry. See `unreadableRange` in the grammar.
    leadQuantity_unreadableRange(r, _s) {
      const step = this.args.step;
      step.quantity = { kind: 'open' };
      (step.unknown ??= []).push(r.sourceString.trim());
    },

    // --- what may trail a movement ---
    targetGroup_flag(_at, name) { this.args.step.flags.push(name.sourceString); },
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
    // Unrecognized input, held verbatim in a field of its own — a production,
    // not a failure and not a guess. It used to land in `notes`, the same array
    // as an authored `note: "…"`, which meant an unknown token silently acquired
    // the meaning "the author wrote a note" and was rendered as one. `unknown`
    // is carried by nothing downstream: closed 2026-08-15 by queue item 0d.
    modifier_unknown(_rest) {
      const step = this.args.step;
      (step.unknown ??= []).push(this.sourceString.trim());
    },
  });

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
      const step = blankStep(origin(this.args.origin));
      if (lead.numChildren) lead.child(0).addTo(step);
      if (alt.numChildren) {
        // `10 alternating DB Snatch` — the word sits before the movement name,
        // which is how it is written on a whiteboard.
        step.laterality = 'split';
        step.notes.push('alternating');
      }
      step.movement = movement.sourceString.trim();
      for (const p of parts.children) p.child(1).addTo(step);
      // A comma with nothing after it contributes nothing — the modifier is
      // optional in the grammar, so this is an iteration of nought or one.
      for (const m of mods.children) {
        const mod = m.child(3);
        if (mod.numChildren) mod.child(0).addTo(step);
      }
      return step;
    },
  });
}
