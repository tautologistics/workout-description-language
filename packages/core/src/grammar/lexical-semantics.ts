/**
 * What the grammar's shared lexical layer *means*: amounts, durations,
 * thresholds and note bodies.
 *
 * This is the half of phase 2 the step line and the block header have in common,
 * and it is a file of its own for the same reason the grammar states those
 * productions once. A duration appears in `12min Bike`, in `cap 12min`, in
 * `every 90s` and in `AMRAP 12min`; if `12min` were read by two operations they
 * could disagree, and one of them would be wrong somewhere nobody was looking.
 *
 * Operations installed here — `unit()` and `noteText()` — go on the one
 * semantics object `parser.ts` builds, alongside the step and block actions.
 * Ohm scopes an operation to a semantics rather than to a rule, so sharing means
 * sharing the object and not copying the actions into two of them.
 *
 * **Every action spells out one parameter per child, including the ones it
 * ignores.** Ohm's arity check reads `fn.length`, so a rest parameter reports
 * zero and is rejected — see lessons-learned.md.
 */

import type { Semantics } from './vendor/ohm.js';
import type { Unit } from '../ast.ts';
import { parseDuration, parseThreshold } from '../units.ts';

/** What a host supplies alongside a line: where it came from. */
export interface Origin { line: number; comments: string[] }

export const origin = (o?: Origin): Origin => o ?? { line: 0, comments: [] };

export const num = (n: { sourceString: string }) => Number(n.sourceString);

/**
 * `400 meters` and `400 m` are the same distance. Kept identical to the
 * normalization in `parseQuantity`, which is the thing this must reproduce.
 */
export function distanceUnit(word: string): 'm' | 'km' | 'mi' | 'ft' | 'yd' {
  const u = word.toLowerCase();
  const norm = u.startsWith('me') ? 'm'
    : u.startsWith('mi') && u !== 'mi' ? 'mi'
      : u === 'feet' ? 'ft' : u;
  return norm as never;
}

/** `12 minutes`, `45 seconds`, `1 hour` — spelled out, so the word carries the scale. */
export const durationScale = (word: string): number =>
  (/^h/i.test(word) ? 3600 : /^m/i.test(word) ? 60 : 1);

export function installLexical(semantics: Semantics): void {
  // `unit()` answers "what amount is this?" and nothing else. Every duration
  // form routes through `parseDuration`, so `1min30s`, `1:30` and `90 seconds`
  // cannot drift apart from the way the rest of the core reads them.
  semantics.addOperation<Unit>('unit()', {
    // No amount has a bare terminal for its meaning, and a default that
    // returned `open` would turn a missing action into a step with no
    // measure — the quietest wrong answer available.
    _terminal(): Unit { throw new Error('grammar: asked a terminal for an amount'); },
    _nonterminal(...children) {
      // `quantityBody` and `headerDuration_exact` are pass-throughs: an
      // alternation with no meaning of its own. Anything else reaching here is a
      // missing action, and saying which one beats a plausible wrong amount.
      if (children.length === 1) return children[0].unit();
      throw new Error(`grammar: no unit action for \`${this.ctorName}\``);
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

    // A bare number in a *header* duration position is minutes — `AMRAP 12`,
    // `every 5`. That is precisely what `parseDuration`'s second argument means,
    // so it is that call rather than a multiplication written out again here.
    headerDuration_minutes(_i) { return parseDuration(this.sourceString, true)!; },

    // The rest line's spelling, where internal spacing is free — `rest 1 min 30 s`.
    // `parseDuration` strips whitespace before matching, so all five forms reach it
    // as the same string the tight spellings do, and cannot mean anything else.
    looseDuration_hms(_h, _m, _s) { return parseDuration(this.sourceString, true)!; },
    looseDuration_ms(_m, _s) { return parseDuration(this.sourceString, true)!; },
    looseDuration_s(_s) { return parseDuration(this.sourceString, true)!; },
    looseDuration_clock(_m, _colon, _s, _sp) { return parseDuration(this.sourceString, true)!; },
    looseDuration_minutes(_i, _sp) { return parseDuration(this.sourceString, true)!; },

    // `until HR < Z2` and `until power > 250W`. The grammar has proved the
    // shape; `parseThreshold` is where what it means already lives.
    threshold_zone(_u, _s1, _metric, _s2, _cmp, _s3, _zone) {
      return parseThreshold(this.sourceString)!;
    },
    threshold_value(_u, _s1, _metric, _s2, _cmp, _s3, _n, _s4, _rate) {
      return parseThreshold(this.sourceString)!;
    },
  });

  semantics.addOperation<string>('noteText()', {
    quotedOrRest_quoted(_open, inner, _close) { return inner.sourceString; },
    quotedOrRest_bare(rest) { return rest.sourceString.trim(); },
  });
}
