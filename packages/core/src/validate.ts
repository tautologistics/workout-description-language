/**
 * Semantic validation (spec §12; roadmap plan_review A-items).
 *
 * The grammar decides whether a file is well-formed. This decides whether it
 * means anything. The third diagnostic severity is the important one:
 *
 *   error     the workout cannot be executed as written
 *   warning   it can, but something is probably wrong
 *   question  the input is genuinely ambiguous — the parser must ask rather
 *             than pick, because a silent wrong reading writes bad data into a
 *             result record that outlives the file
 *   note      nothing is wrong and nothing is being asked — this says what the
 *             language did not read, so held-and-inert is not also silent
 */

import type { Workout, Node, Step, Block, Target } from './ast.ts';
import { defaultRegistry } from './registry.ts';
import type { Registry } from './fold.ts';

export interface Diagnostic {
  severity: 'error' | 'warning' | 'question' | 'note';
  code: string;
  message: string;
  line?: number;
  /** Readings the author must choose between, for `question` diagnostics. */
  candidates?: string[];
}

export interface ValidateOptions {
  registry?: Registry;
  /** Athlete-profile keys that are resolvable — 1RM, TM, FTP, BW, named paces. */
  profile?: Set<string>;
}

const SEX_SPLIT = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/;

/**
 * The fixed section vocabulary (`sectionWord` in `spec/grammar-0.1.ohm`), lower-
 * cased the way `blockKind_section` canonicalises it. A `type: 'section'` block
 * whose name is outside this set came from the grammar's `customSection` — a bare
 * label the author coined — and that reclassification is said out loud below.
 */
const FIXED_SECTIONS = new Set([
  'warm-up', 'warmup', 'strength', 'skill',
  'conditioning', 'accessory', 'cool-down', 'cooldown',
]);

export function validate(w: Workout, opts: ValidateOptions = {}): Diagnostic[] {
  const reg = opts.registry ?? defaultRegistry();
  const out: Diagnostic[] = [];
  const labels = new Set<string>();

  const add = (d: Diagnostic) => out.push(d);

  /**
   * Text the grammar held as unknown, said out loud — the other half of failing
   * open, and decided deliberately on 2026-08-15 (queue item 0d).
   *
   * The framing this language is built to is that unknown is *"not an error and
   * not a guess"*, which settles what the tree does with it and says nothing
   * about whether anyone is told. Held silently, `10 Thruster, unbrokn` is a typo
   * that nothing anywhere mentions, and a person writing on a whiteboard is worse
   * off than if they had been told. So it is reported at a severity that claims
   * nothing: not `error`, because the workout executes exactly as the rest of the
   * line says; not `warning`, because four corpus workouts carry deliberate prose
   * the language does not model (`45lb plate overhead`) and they are not wrong;
   * not `question`, because there are no readings to choose between. It reports
   * what happened and stops there.
   */
  const unread = (text: string, line: number) =>
    add({ severity: 'note', code: 'unrecognized-text', line,
          message: `\`${text}\` is not something the language reads — it is kept as `
            + 'written, and nothing acts on it' });

  // ---- structural checks -------------------------------------------------

  const walkBlocks = (nodes: Node[], inForTime: boolean, inCap = false) => {
    for (const n of nodes) {
      if (n.node === 'step') { checkStep(n); continue; }
      if (n.node === 'interrupt') { for (const b of n.body) if (b.node === 'step') checkStep(b); continue; }
      if (n.node !== 'block') continue;

      if (n.label) labels.add(n.label);

      // A bare `AMRAP:` is legal only where an enclosing cap supplies the
      // window — "run 1.5 miles, then AMRAP in the time remaining".
      if (n.type === 'amrap' && !n.duration && !inCap) {
        add({ severity: 'error', code: 'amrap-no-duration', line: n.line,
              message: 'an AMRAP needs a duration, or an enclosing time cap to take it from' });
      }
      if (n.type === 'clock' && !n.every) {
        add({ severity: 'error', code: 'clock-no-cadence', line: n.line,
              message: 'a clock-driven block needs a cadence — `every 90s x 6:` or `EMOM 12min:`' });
      }
      if (n.type === 'clock' && !n.untilFailure && !n.count && !n.duration) {
        add({ severity: 'error', code: 'clock-unbounded', line: n.line,
              message: 'a clock-driven block needs a round count, a window, or `until failure`' });
      }
      if ((n.type === 'repeat' || n.type === 'attempts') && (n.count === undefined || n.count < 1)) {
        add({ severity: 'error', code: 'bad-round-count', line: n.line,
              message: `round count must be at least 1, got ${n.count}` });
      }
      if (n.type === 'ladder') {
        if (!n.scheme?.length) {
          add({ severity: 'error', code: 'empty-scheme', line: n.line, message: 'rep scheme is empty' });
        } else if (n.scheme.some((v) => v < 1)) {
          add({ severity: 'error', code: 'bad-scheme', line: n.line,
                message: `rep scheme contains a non-positive value: ${n.scheme.join('-')}` });
        }
        const consumers = n.children.filter((c) => c.node === 'step' && c.quantity.kind === 'open');
        if (consumers.length === 0 && n.children.length > 0) {
          add({ severity: 'warning', code: 'scheme-unused', line: n.line,
                message: `rep scheme ${n.scheme?.join('-')} has no effect — every movement already states its own count` });
        }
      }
      for (const u of n.unknown ?? []) unread(u, n.line);

      if (n.children.length === 0 && n.type !== 'tally') {
        add({ severity: 'warning', code: 'empty-block', line: n.line, message: `${n.type} block is empty` });
      }

      /**
       * A partner rotation is two people doing two things at once and then
       * swapping, so it holds exactly two (spec §5.11.1). Three is not a longer
       * rotation — it is a shape the block cannot state, because with two
       * athletes the third thing has nobody to be simultaneous with. An error
       * rather than a warning: the block's whole claim is that these run
       * alongside each other, and with three that claim is false.
       */
      if (n.type === 'partnerRotation' && n.children.length !== 2 && n.children.length !== 0) {
        add({ severity: 'error', code: 'partner-rotation-arity', line: n.line,
              message: `partner rotation holds exactly two — this has ${n.children.length}. `
                + 'Two athletes work at once and then swap, so a third has nobody to work alongside; '
                + 'split it into two rotations, or use `any order:` if the pairing does not matter' });
      }

      /**
       * A block header that was never indented into the block holding it (spec
       * §2). Reported for the same reason unknown text is: the adoption rule
       * makes a *structural* guess, and held-and-inert must not also be silent —
       * one that changes what contains what least of all. `note` rather than
       * `warning`, because nothing is wrong: writing a file flat is allowed, and
       * `wdl fmt` writes the indentation that settles it.
       */
      if (n.adopted) {
        add({ severity: 'note', code: 'adopted-block', line: n.line,
              message: 'read as inside the block above it — it was never indented into one; '
                + 'indent it to say so, or run `wdl fmt`' });
      }

      /**
       * A bare custom label read as a section (spec §2, §11.1). It groups the
       * blocks under it and does nothing else — every enclosing round still
       * cycles its descendants. `note` rather than silence for the same reason
       * unknown text is said out loud: a coined heading that nobody indented and
       * a coined heading that is a typo look identical, and the fixed eight are
       * silent only because they are a closed vocabulary. `note` rather than
       * `warning` because nothing is wrong — spec §2 allows any custom label.
       */
      if (n.type === 'section' && n.name && !FIXED_SECTIONS.has(n.name.toLowerCase())) {
        add({ severity: 'note', code: 'custom-section', line: n.line,
              message: `read \`${n.name}\` as a section label — it groups the blocks under it `
                + 'and nothing else' });
      }

      // `score: rounds + reps` only means something where rounds are open-ended.
      const s = n.score?.primary ?? '';
      const forTime = inForTime || s === 'time';
      if (/rounds/.test(s) && !n.score?.implied && n.type !== 'amrap' && n.type !== 'clock') {
        add({ severity: 'error', code: 'rounds-score-on-fixed-work', line: n.line,
              message: '`rounds + reps` needs an open-ended block — a fixed-round or for-time workout scores time' });
      }

      // A header's target is inherited by every child, so a question about it is
      // a question about all of them — and until 2026-08-18 nothing asked. Only
      // a step's own targets were checked, so `3 rounds @ 95/65:` was silent
      // where `- 10 Thruster @ 95/65` asks which reading is meant, and
      // `3 rounds @ 75%:` escaped the missing-reference warning the same way.
      checkTargets(n.inherited, n.line);

      walkBlocks(n.children, forTime, inCap || n.cap !== undefined);
    }
  };

  const checkTargets = (targets: Target[], line: number) => {
    for (const t of targets) {
      if (t.kind === 'raw' && SEX_SPLIT.test(t.text)) {
        add({ severity: 'question', code: 'ambiguous-load-split', line,
              message: `\`${t.text}\` has more than one common reading — say which`,
              candidates: ['men / women', 'Rx / scaled', 'two separate loads'] });
      }
      if (t.kind === 'load' && t.load.kind === 'percent' && !t.load.of) {
        add({ severity: 'warning', code: 'percent-no-reference', line,
              message: `\`${t.load.value}%\` has no reference — add \`1RM\`, \`TM\`, \`FTP\`, or a block label` });
      }
      if (t.kind === 'load' && t.load.kind === 'percent' && t.load.of) {
        const ref = t.load.of;
        const known = new Set(['TM', 'FTP', 'BW', ...(opts.profile ?? [])]);
        if (!known.has(ref) && !/^\d+RM$/.test(ref) && !labels.has(ref)) {
          add({ severity: 'warning', code: 'unknown-reference', line,
                message: `\`${ref}\` is neither an athlete-profile value nor a block label in this workout` });
        }
      }
      if (t.kind === 'load' && t.load.kind === 'reference' && !labels.has(t.load.name)) {
        add({ severity: 'warning', code: 'unknown-reference', line,
              message: `\`${t.load.name}\` is not a block label in this workout` });
      }
    }
  };

  // ---- step checks -------------------------------------------------------

  function checkStep(s: Step) {
    const q = s.quantity;
    if ((q.kind === 'reps' || q.kind === 'floor') && q.value < 1) {
      add({ severity: 'error', code: 'non-positive-reps', line: s.line,
            message: `repetitions must be positive, got ${q.value}` });
    }
    if (q.kind === 'distance' && q.value <= 0) {
      add({ severity: 'error', code: 'non-positive-distance', line: s.line,
            message: `distance must be positive, got ${q.value}${q.unit}` });
    }
    if (q.kind === 'duration' && q.seconds <= 0) {
      add({ severity: 'error', code: 'non-positive-duration', line: s.line,
            message: 'duration must be positive' });
    }

    checkTargets(s.targets, s.line);
    for (const u of s.unknown ?? []) unread(u, s.line);

    if (!s.movement) return;
    const r = reg.resolve(s.movement);

    if (r.status === 'ambiguous') {
      add({ severity: 'question', code: 'ambiguous-movement', line: s.line,
            message: `\`${s.movement}\` matches more than one movement — say which`,
            candidates: r.candidates.map((c) => c.title) });
      return;
    }
    if (r.status === 'unregistered') return;   // always legal (registry §7)

    const e = r.entry;

    // A calorie or distance quantity needs a readout to come from.
    if (q.kind === 'calories' && !(e.measures ?? []).includes('calories')) {
      add({ severity: 'warning', code: 'no-calorie-readout', line: s.line,
            message: `${e.title} has no calorie readout — did you mean reps or a duration?` });
    }
    if (q.kind === 'distance' && !(e.measures ?? []).includes('distance')) {
      add({ severity: 'warning', code: 'no-distance-readout', line: s.line,
            message: `${e.title} does not cover distance — did you mean reps?` });
    }

    // Paired implements change the arithmetic, so a bare load is worth querying.
    const load = s.targets.find((t) => t.kind === 'load' && t.load.kind === 'absolute');
    if (load && load.kind === 'load' && load.load.kind === 'absolute') {
      if (e.load === 'per-implement' && !load.load.implements) {
        add({ severity: 'question', code: 'implement-arity', line: s.line,
              message: `${e.title} is loaded per implement — is \`${load.load.value}${load.load.unit}\` each, or the total?`,
              candidates: [`${e.implements ?? 2}x${load.load.value}${load.load.unit} (each)`,
                           `${load.load.value}${load.load.unit} (total)`] });
      }
    }

    // Counting mode: only ask where the registry admits several modes and
    // declares no default. A stated default is a convention, not a guess
    // (spec §1 rule 3), and canonical output makes it explicit either way.
    if (!s.side && !s.laterality && !e.defaultLaterality
        && (e.laterality?.length ?? 0) > 1 && q.kind === 'reps') {
      add({ severity: 'question', code: 'counting-mode', line: s.line,
            message: `${e.title} can be counted more than one way — say which`,
            candidates: e.laterality!.map((m) =>
              m === 'per-side' ? `each side (${q.value} per side)` :
              m === 'split' ? `(split) (${q.value} total)` : '(both)') });
    }
    if (s.laterality === 'per-side' && e.laterality && !e.laterality.includes('per-side')) {
      add({ severity: 'error', code: 'bad-counting-mode', line: s.line,
            message: `${e.title} is not a per-side movement` });
    }
  }

  // ---- run ---------------------------------------------------------------

  // Collect labels first so forward references resolve.
  const collect = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.node !== 'block') continue;
      if (n.label) labels.add(n.label);
      collect(n.children);
    }
  };
  collect(w.body);

  walkBlocks(w.body, false);

  if (w.body.length === 0) {
    add({ severity: 'error', code: 'empty-workout', message: 'the workout has no blocks' });
  }

  // A score with no primary names nothing to rank by, and a `tiebreak` with
  // nothing to break the tie *in* is the inline twin of an orphan `tiebreak:`
  // line — which `parse` already reports. The two ways to write one: a brace that
  // never says `primary:` (`score: {tiebreak: reps at 5min}`), and a bare
  // `score:` with nothing after it. Both are held rather than refused, because an
  // absent field is absent and the fields the author did write are worth keeping;
  // saying so is validation's job, not the grammar's, for the same reason
  // `min < max` on a rep range is.
  if (w.score && !w.score.primary) {
    add({ severity: 'error', code: 'score-without-primary',
          message: 'a `score:` names what to rank by — this one names nothing; '
            + 'add a primary, or drop the line' });
  }

  const top = w.score?.primary ?? '';
  if (/rounds/.test(top)) {
    // The open-ended block may be nested — `3 rounds: AMRAP 5min: … rest 5min`
    // scores rounds+reps per interval, so search the whole tree, not just the top.
    const openEnded = (nodes: Node[]): boolean => nodes.some((n) =>
      n.node === 'block' && (n.type === 'amrap' || n.type === 'clock' || openEnded(n.children)));
    if (!openEnded(w.body)) {
      add({ severity: 'error', code: 'rounds-score-on-fixed-work',
            message: '`rounds + reps` needs an open-ended block; this workout has none' });
    }
  }

  return out.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

export const errorsOnly = (d: Diagnostic[]) => d.filter((x) => x.severity === 'error');
