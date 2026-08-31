/**
 * What the block-header grammar *means*.
 *
 * The counterpart to `step-semantics.ts`, mapping `blockHeader` and its comma
 * modifiers onto the `Block` in `../ast.ts`. The amounts and targets it is built
 * out of are in `lexical-semantics.ts`, shared with the step line — which is the
 * reason headers were stated in the grammar before the parser was swapped over to
 * any of it, and the reason `cap 12min` and `12min Bike` cannot come apart.
 *
 * Two orderings here are load-bearing rather than incidental, and both mirror the
 * hand-written `parseHeader`:
 *
 * 1. **Everything qualifying the head is applied before the kind.** `for time`
 *    on `3 rounds for time` is a score the author *chose*; the score AMRAP and
 *    `build` contribute is one *implied* by the shape. The implied one must not
 *    overwrite a chosen one, which is what `??=` says in the old parser and what
 *    doing the extras first says here.
 * 2. **Comma modifiers are applied after the head**, so `AMRAP 12min, for time`
 *    ends up scored by time — a modifier states the score outright and overwrites.
 *
 * A *kind* may arrive from either place, because spec §5.0's "order is free on
 * input" applies to the whole header: `blockKind` is reached from `headerKind`
 * and again from `blockModifier`, and one set of actions serves both.
 *
 * That makes a header's **one** kind the exception to point 2 above. A modifier
 * overwrites because a later qualifier wins; a second *kind* is not a later
 * qualifier but a contradiction, so the first one stands and the second is held
 * verbatim. `toBlock` is where that is arranged, because it is the only place
 * that sees the head and the modifiers together.
 *
 * Every action spells out one parameter per child, ignored ones included: Ohm's
 * arity check reads `fn.length` and a rest parameter reports zero.
 */

import type { Node, Semantics } from './vendor/ohm.js';
import type { Block, Score } from '../ast.ts';
import { expandRuns, parseTarget } from '../units.ts';
import { num, origin, type Origin } from './lexical-semantics.ts';

export const blankBlock = (o: Origin): Block => ({
  node: 'block', type: 'sequence', inherited: [], equipment: [], flags: [],
  children: [], comments: o.comments, line: o.line,
});

const implied = (primary: string): Score => ({ primary, raw: primary, implied: true });

/**
 * Whether a header's head named a kind the language knows.
 *
 * `headerHead = headerKind? headerExtra*`, and `headerKind` is one of three
 * cases: `known`, wrapping the shared `blockKind`; `section`, a bare custom
 * label; or `unknown`, wrapping a name. Only `known` claims the block's one kind.
 * A plain `unknown` head leaves the position open for a comma to fill, which is
 * what reads `cap 12min, 3 rounds`. A `section` head leaves it open too, and on
 * purpose: a bare label is a section only while *no kind appears anywhere on the
 * header*, so `Barbell movements, 3 rounds:` must still take the `3 rounds` after
 * the comma — and once it does, `parse.ts` reports the leftover label, the same
 * "three rounds and an error" the fixed vocabulary is spared but a coined label
 * is not (spec §11.1).
 */
function headStatesKind(head: Node): boolean {
  const opt = head.child(0);
  return opt.numChildren > 0 && opt.child(0).child(0).ctorName === 'headerKind_known';
}

export function installBlock(semantics: Semantics): void {
  /** The numbers a rep scheme states, with `..` runs expanded. */
  semantics.addOperation<number[]>('scheme()', {
    // The shape is already proved; reading the numbers back off the matched text
    // is the same move `rxSide` and the duration actions make, and `expandRuns`
    // is imported rather than re-derived so a ladder cannot expand two ways.
    schemeNumbers_run(_first, _tails) {
      return expandRuns(this.sourceString.split('..').map(Number));
    },
    schemeNumbers_tiers(_first, _tails) {
      return this.sourceString.split('-').map(Number);
    },
  });

  // `addToBlock` mutates for the same reason `addTo` does on a step: a header's
  // parts are not independent, and the order they arrive in is the order the
  // hand-written parser applied them.
  semantics.addOperation<void>('addToBlock(block)', {
    _nonterminal(...children) {
      // `headerKind`, `blockKind` and `blockModifier` are alternations with no
      // meaning of their own — including the two wrappers that let a kind be
      // reached from a comma position, `headerKind_known` and
      // `blockModifier_kind`. Anything else here is a missing action, and naming
      // it beats a silent no-op that drops a cap or a label.
      if (children.length === 1) { children[0].addToBlock(this.args.block); return; }
      throw new Error(`block-semantics: no addToBlock action for \`${this.ctorName}\``);
    },

    // --- the head, and what qualifies it ---
    headerHead(kind, extras) {
      const block = this.args.block;
      // Extras first — see the note at the top of this file.
      for (const e of extras.children) e.child(1).addToBlock(block);
      if (kind.numChildren) kind.child(0).addToBlock(block);
    },

    // A target on the header is inherited by every child (spec §5.0, N5).
    targetGroup_target(_at, _s, text) {
      this.args.block.inherited.push(parseTarget(text.sourceString.trim()));
    },
    // `@tiebreak` on a header is not a target and not a flag anyone has defined
    // for a block; held as a flag, which is where the old parser's catch-all put
    // an unrecognized modifier too.
    targetGroup_flag(_at, name) { this.args.block.flags.push(name.sourceString); },

    forTime(_for, _s, _time) { this.args.block.score = implied('time'); },

    // --- the kinds ---
    blockKind_rounds(n, _s, word, _end) {
      const block = this.args.block;
      block.type = 'repeat';
      block.count = num(n);
      // Rounds and sets are the same structure and different words, and which
      // word was written survives because the formatter has to write it back.
      block.flags.push(/^set/i.test(word.sourceString) ? 'sets' : 'rounds');
    },
    // `3 RFT` is `3 rounds for time`, and it produces that block exactly — same
    // type, same count, same `rounds` flag, same score — so nothing downstream
    // learns an abbreviation and canonical output writes the long form. The
    // score is `??=` for the same reason AMRAP's is: a score already chosen on
    // this header is the author's, and `3 RFT` restating it changes nothing.
    blockKind_roundsForTime(n, _s, _rft, _end) {
      const block = this.args.block;
      block.type = 'repeat';
      block.count = num(n);
      block.flags.push('rounds');
      block.score ??= implied('time');
    },
    blockKind_attempts(n, _s, _word, _end) {
      this.args.block.type = 'attempts';
      this.args.block.count = num(n);
    },
    blockKind_teamOf(_team, _s1, _of, _s2, n, _end) {
      this.args.block.type = 'team';
      this.args.block.count = num(n);
    },
    blockKind_forDuration(_for, _s, d, _end) {
      // `for 12min:` — bounded by a clock but not an AMRAP, so it carries no
      // implied score. The Cooper test is the shape: run for twelve minutes.
      const block = this.args.block;
      block.type = 'amrap';
      block.duration = d.unit();
      block.flags.push('for-duration');
    },
    blockKind_amrap(_word, window, _end) {
      const block = this.args.block;
      block.type = 'amrap';
      if (window.numChildren) block.duration = window.child(0).child(1).unit();
      block.score ??= implied('rounds + reps');
    },
    blockKind_emom(_e, every, _mom, _s, d, _end) {
      const block = this.args.block;
      block.type = 'clock';
      // `EMOM` is every minute; `E2MOM` every two. The number is minutes and is
      // written into the word itself, which is how gyms write it.
      block.every = { kind: 'duration', seconds: (every.numChildren ? num(every.child(0)) : 1) * 60 };
      block.duration = d.unit();
    },
    blockKind_work(_word, _s, d, _end) {
      this.args.block.type = 'work';
      this.args.block.duration = d.unit();
    },
    blockKind_cycleEntry(_word, _s, n, _end) {
      this.args.block.type = 'cycleEntry';
      this.args.block.count = num(n);
    },
    // Two athletes by definition, so it carries no count — that is the whole
    // reason it is its own kind rather than a `team of 2` qualifier (spec §5.11.1).
    blockKind_partnerRotation(_p, _s, _r, _end) { this.args.block.type = 'partnerRotation'; },
    blockKind_tally(_any, _s, _order, _end) { this.args.block.type = 'tally'; },
    blockKind_superset(_word, _end) { this.args.block.type = 'superset'; },
    blockKind_complex(_word, _end) { this.args.block.type = 'complex'; },
    blockKind_sequence(_word, _end) { this.args.block.type = 'sequence'; },
    blockKind_section(word, _end) {
      this.args.block.type = 'section';
      this.args.block.name = word.sourceString.toLowerCase();
    },
    // A bare custom label — no digit, no kind, no comma. The same inert labelled
    // container `blockKind_section` builds for the fixed eight words, opened up to
    // any label. Case is preserved verbatim where the fixed vocabulary is folded
    // to lower case: the eight are canonical spellings, a coined label is the
    // author's. `validate.ts` emits the `note` that keeps this from being silent
    // (code `custom-section`), for the same reason `parse.ts` — not this file —
    // reports `headerKind_unknown`: an error or a note is not part of the AST.
    headerKind_section(label) {
      this.args.block.type = 'section';
      this.args.block.name = label.sourceString.trim();
    },
    // Unrecognized, and held rather than rejected: a named sequence, which keeps
    // every child and every modifier. It is also *reported*, and that is
    // `parse.ts`'s job rather than this file's — an error is not part of the AST,
    // and a semantics that could raise one would be a semantics with an opinion
    // about how the caller wants to be told.
    headerKind_unknown(name) {
      this.args.block.type = 'sequence';
      this.args.block.name = name.sourceString.trim();
    },

    every_untilFailure(_e, _s1, d, _s2, _until, _s3, _failure, _end) {
      const block = this.args.block;
      block.type = 'clock';
      block.every = d.unit();
      block.untilFailure = true;
    },
    // The same shape `EMOM 10min` states — an interval and a window it runs for —
    // so it lands on the same two fields and nothing downstream learns a form.
    every_forDuration(_e, _s1, d, _s2, _for, _s3, window, _end) {
      const block = this.args.block;
      block.type = 'clock';
      block.every = d.unit();
      block.duration = window.unit();
    },
    every_times(_e, _s1, d, _s2, _x, _s3, n, _end) {
      const block = this.args.block;
      block.type = 'clock';
      block.every = d.unit();
      block.count = num(n);
    },
    every_bare(_e, _s, d, _end) {
      this.args.block.type = 'clock';
      this.args.block.every = d.unit();
    },

    ladder_unit(numbers, _s, unit, _end) {
      const block = this.args.block;
      block.type = 'ladder';
      block.scheme = numbers.scheme();
      // A scheme may count something other than reps: `1..5..1 min:` is the
      // interval pyramid, `250-500-750 m:` the rowing one.
      block.schemeUnit = unit.sourceString.toLowerCase();
    },
    ladder_reps(numbers, _end) {
      this.args.block.type = 'ladder';
      this.args.block.scheme = numbers.scheme();
    },

    build(_b, _s1, _to, _s2, goal, _s3, _in, _s4, d, label, _end) {
      const block = this.args.block;
      block.type = 'build';
      block.buildTarget = goal.sourceString.trim();
      block.duration = d.unit();
      if (label.numChildren) block.label = label.child(0).child(3).sourceString;
      block.score ??= implied('max load');
    },

    // --- what may qualify a header, after a comma ---
    blockModifier_cap(_cap, _s, d, _end) { this.args.block.cap = d.unit(); },
    blockModifier_overrun(word, _s1, _on, _s2, _overrun, _end) {
      this.args.block.onOverrun = word.sourceString.toLowerCase() as never;
    },
    blockModifier_wearing(_word, _s, rest) { this.args.block.equipment.push(rest.sourceString.trim()); },
    blockModifier_label(_as, _s, label, _end) { this.args.block.label = label.sourceString; },
    blockModifier_forTime(f, _end) { f.addToBlock(this.args.block); },
    blockModifier_flag(word, _end) { this.args.block.flags.push(word.sourceString.toLowerCase()); },
    blockModifier_target(g) { g.addToBlock(this.args.block); },
    // Unrecognized, held verbatim in a field of its own. It used to land in
    // `flags`, beside `unbroken` and `rounds`, so nothing afterwards could tell
    // an unknown token from a flag the language defines. Closed 2026-08-15 by
    // queue item 0d, together with its step-level twin.
    blockModifier_unknown(_rest) {
      const block = this.args.block;
      (block.unknown ??= []).push(this.sourceString.trim());
    },
  });

  semantics.addOperation<Block>('toBlock(origin)', {
    blockHeader(head, mods) {
      const block = blankBlock(origin(this.args.origin));
      head.addToBlock(block);
      // A header states **at most one** kind. Which comma position states it does
      // not matter; stating a second one is not a reordering but a contradiction
      // — `AMRAP 12min, 3 rounds` cannot be both, and applying the later one over
      // the earlier leaves the first kind's fields behind on a block whose type no
      // longer writes them, which is a silent loss of exactly the kind this rule
      // exists to close. So the first kind stands and the second is held verbatim,
      // the answer the language already gives anything it will not act on.
      let kindTaken = headStatesKind(head);
      for (const m of mods.children) {
        // Nought or one: a comma with nothing after it qualifies nothing.
        const mod = m.child(3);
        if (mod.numChildren) {
          // `blockModifier` is the alternation; the case node naming which
          // modifier this is sits one below it, the level `addToBlock`'s
          // `_nonterminal` would otherwise pass through without looking.
          const one = mod.child(0).child(0);
          if (one.ctorName !== 'blockModifier_kind') one.addToBlock(block);
          else if (kindTaken) (block.unknown ??= []).push(one.sourceString.trim());
          else { one.addToBlock(block); kindTaken = true; }
        }
        // And then whatever trails it without a comma of its own. Written order,
        // because that is what `, @ 95lb for time` says: a target, then a score.
        // Unlike the head's extras these do not go first — a comma modifier
        // states a score outright and is meant to overwrite an implied one, and
        // these arrive on the same footing as the modifier they trail.
        for (const e of m.child(4).children) e.child(1).addToBlock(block);
      }
      return block;
    },
  });
}
