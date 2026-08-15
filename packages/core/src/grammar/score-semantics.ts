/**
 * What the score line *means*.
 *
 * A `Score` carries both a *reading* and the text it was read from: `primary` is
 * what a tool ranks by, and `raw` is what the author wrote, kept because the
 * formatter has to write the line back and because `min per round` names its
 * aggregate and its shape in one phrase. Where the two differ is deliberate —
 * `time per round` has `primary: time`, `sum of blocks` has `primary: blocks` —
 * and reproducing that difference exactly is most of what this file does.
 *
 * `on cap:` and `tiebreak:` are lines of their own that qualify the score above
 * them. They produce a key and a text and nothing else; which score they attach to
 * is a question about lines rather than about one line, so it stays with the caller.
 *
 * Every action spells out one parameter per child, ignored ones included: Ohm's
 * arity check reads `fn.length` and a rest parameter reports zero.
 */

import type { Semantics } from './vendor/ohm.js';
import type { Score } from '../ast.ts';

/** One `key: value` from the brace form. */
export interface ScoreField { key: string; value: string }

/** What an `on cap:` or `tiebreak:` line contributes to the score above it. */
export interface ScoreQualifier { key: 'onCap' | 'tiebreak'; text: string }

export function installScore(semantics: Semantics): void {
  semantics.addOperation<ScoreField[]>('braceFields()', {
    braceScore(_open, first, tails, _close) {
      return [first, ...tails.children.map((t) => t.child(1))]
        .flatMap((e) => e.braceFields());
    },
    braceEntry_field(_s1, key, _colon, _s2, value) {
      return [{
        // `on cap` is two words, and how much whitespace sits between them is not
        // part of the key.
        key: key.sourceString.toLowerCase().replace(/\s+/g, ' '),
        value: value.sourceString.trim(),
      }];
    },
    // An entry naming nothing the format defines. Held by the grammar, and
    // contributes nothing — the same fail-open reading an unknown step modifier
    // gets, except that here there is genuinely nowhere for it to go.
    braceEntry_other(_s, _value) { return []; },
  });

  semantics.addOperation<Score>('toScore()', {
    scoreLine(_word, _colon, _s, spec) {
      // `score:` with nothing after it. Held as an empty score rather than
      // refused, and it is what the parser does today — see the note about the
      // spec's nested `score:` block in known-debts.md.
      if (!spec.numChildren) return { primary: '', raw: '' };
      return spec.child(0).toScore();
    },

    scoreSpec_brace(brace) {
      const raw = this.sourceString.trim();
      // With no `primary:` field the whole brace text stands as the primary. That
      // is the old parser's reading and it is a poor one; it is reproduced here
      // rather than quietly improved.
      const score: Score = { primary: raw, raw };
      for (const { key, value } of brace.braceFields()) {
        if (key === 'primary') score.primary = value;
        else if (key === 'on cap') score.onCap = value;
        else if (key === 'tiebreak') score.tiebreak = value;
      }
      return score;
    },

    // `min per round` names the aggregate *and* the shape, and there is no
    // separate thing being aggregated — so the whole phrase stays the primary.
    scoreSpec_aggregatePerRound(word, _s, _per) {
      const raw = this.sourceString.trim();
      return {
        primary: raw, raw, perRound: true,
        aggregate: word.sourceString.toLowerCase() as Score['aggregate'],
      };
    },

    // `time per round` names a thing and a shape, so the thing is the primary.
    scoreSpec_perRound(text, _s, _per) {
      return { primary: text.sourceString.trim(), raw: this.sourceString.trim(), perRound: true };
    },

    scoreSpec_sumOfBlocks(_sum, _s1, _of, _s2, _blocks) {
      return { primary: 'blocks', raw: this.sourceString.trim(), aggregate: 'sum' };
    },

    scoreSpec_plain(text) {
      const raw = text.sourceString.trim();
      return { primary: raw, raw };
    },
  });

  semantics.addOperation<ScoreQualifier>('qualifier()', {
    onCapLine(_on, _s1, _cap, _colon, _s2, text) {
      return { key: 'onCap', text: text.sourceString.trim() };
    },
    tiebreakLine(_word, _colon, _s, text) {
      return { key: 'tiebreak', text: text.sourceString.trim() };
    },
  });
}
