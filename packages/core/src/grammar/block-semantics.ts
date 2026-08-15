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
 * Every action spells out one parameter per child, ignored ones included: Ohm's
 * arity check reads `fn.length` and a rest parameter reports zero.
 */

import type { Semantics } from './vendor/ohm.js';
import type { Block, Score } from '../ast.ts';
import { expandRuns, parseTarget } from '../units.ts';
import { num, origin, type Origin } from './lexical-semantics.ts';

export const blankBlock = (o: Origin): Block => ({
  node: 'block', type: 'sequence', inherited: [], equipment: [], flags: [],
  children: [], comments: o.comments, line: o.line,
});

const implied = (primary: string): Score => ({ primary, raw: primary, implied: true });

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
      // `headerKind` and `blockModifier` are alternations with no meaning of
      // their own. Anything else here is a missing action, and naming it beats a
      // silent no-op that drops a cap or a label.
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
    headerKind_rounds(n, _s, word, _end) {
      const block = this.args.block;
      block.type = 'repeat';
      block.count = num(n);
      // Rounds and sets are the same structure and different words, and which
      // word was written survives because the formatter has to write it back.
      block.flags.push(/^set/i.test(word.sourceString) ? 'sets' : 'rounds');
    },
    headerKind_attempts(n, _s, _word, _end) {
      this.args.block.type = 'attempts';
      this.args.block.count = num(n);
    },
    headerKind_teamOf(_team, _s1, _of, _s2, n, _end) {
      this.args.block.type = 'team';
      this.args.block.count = num(n);
    },
    headerKind_forDuration(_for, _s, d, _end) {
      // `for 12min:` — bounded by a clock but not an AMRAP, so it carries no
      // implied score. The Cooper test is the shape: run for twelve minutes.
      const block = this.args.block;
      block.type = 'amrap';
      block.duration = d.unit();
      block.flags.push('for-duration');
    },
    headerKind_amrap(_word, window, _end) {
      const block = this.args.block;
      block.type = 'amrap';
      if (window.numChildren) block.duration = window.child(0).child(1).unit();
      block.score ??= implied('rounds + reps');
    },
    headerKind_emom(_e, every, _mom, _s, d, _end) {
      const block = this.args.block;
      block.type = 'clock';
      // `EMOM` is every minute; `E2MOM` every two. The number is minutes and is
      // written into the word itself, which is how gyms write it.
      block.every = { kind: 'duration', seconds: (every.numChildren ? num(every.child(0)) : 1) * 60 };
      block.duration = d.unit();
    },
    headerKind_work(_word, _s, d, _end) {
      this.args.block.type = 'work';
      this.args.block.duration = d.unit();
    },
    headerKind_cycleEntry(_word, _s, n, _end) {
      this.args.block.type = 'cycleEntry';
      this.args.block.count = num(n);
    },
    headerKind_tally(_any, _s, _order, _end) { this.args.block.type = 'tally'; },
    headerKind_superset(_word, _end) { this.args.block.type = 'superset'; },
    headerKind_complex(_word, _end) { this.args.block.type = 'complex'; },
    headerKind_sequence(_word, _end) { this.args.block.type = 'sequence'; },
    headerKind_section(word, _end) {
      this.args.block.type = 'section';
      this.args.block.name = word.sourceString.toLowerCase();
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
    // Unrecognized, held verbatim. It lands in `flags`, which is the block-level
    // twin of the step-level debt where an unknown modifier becomes a note —
    // both are queue item 0d.
    blockModifier_unknown(_rest) { this.args.block.flags.push(this.sourceString.trim()); },
  });

  semantics.addOperation<Block>('toBlock(origin)', {
    blockHeader(head, mods) {
      const block = blankBlock(origin(this.args.origin));
      head.addToBlock(block);
      for (const m of mods.children) {
        // Nought or one: a comma with nothing after it qualifies nothing.
        const mod = m.child(3);
        if (mod.numChildren) mod.child(0).addToBlock(block);
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
