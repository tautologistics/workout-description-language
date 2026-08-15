/**
 * What the rest line *means*.
 *
 * Small, because a rest is a small idea: one bound, plus whether it applies after
 * the last round. What makes it worth its own file is that the bound is *five*
 * different kinds of thing — a clock, the athlete's discretion, the preceding
 * work, a sensor reading, or work of its own — and the AST keeps them apart
 * (`duration`, `dynamic`, `active`) because a timeline compiles each differently.
 *
 * Every action spells out one parameter per child, ignored ones included: Ohm's
 * arity check reads `fn.length` and a rest parameter reports zero.
 */

import type { Semantics } from './vendor/ohm.js';
import type { Rest } from '../ast.ts';
import { origin, type Origin } from './lexical-semantics.ts';

export const blankRest = (o: Origin): Rest => ({
  node: 'rest', afterLast: false, comments: o.comments, line: o.line,
});

export function installRest(semantics: Semantics): void {
  semantics.addOperation<void>('addToRest(rest)', {
    _nonterminal(...children) {
      if (children.length === 1) { children[0].addToRest(this.args.rest); return; }
      throw new Error(`rest-semantics: no addToRest action for \`${this.ctorName}\``);
    },

    // A threshold is filed as the rest's `duration` rather than a kind of its
    // own: what ends the interval is one fact, and a sensor reading is one of the
    // things that can end it (spec §4).
    restSpec_threshold(t) { this.args.rest.duration = t.unit(); },
    restSpec_asNeeded(_a) { this.args.rest.dynamic = 'as-needed'; },
    restSpec_equalToWork(_e) { this.args.rest.dynamic = 'equal-to-work'; },
    restSpec_duration(d) { this.args.rest.duration = d.unit(); },

    activeRecovery(quantity, _s, movement) {
      this.args.rest.active = {
        quantity: quantity.unit(),
        movement: movement.sourceString.trim(),
      };
    },
  });

  semantics.addOperation<Rest>('toRest(origin)', {
    restLine(_word, body, afterLast) {
      const rest = blankRest(origin(this.args.origin));
      if (body.numChildren) body.child(0).child(1).addToRest(rest);
      rest.afterLast = afterLast.numChildren > 0;
      return rest;
    },
  });
}
