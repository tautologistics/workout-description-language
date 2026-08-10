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
 */

import type { Workout, Node, Step, Block, Target } from './ast.ts';
import { defaultRegistry } from './registry.ts';
import type { Registry } from './fold.ts';

export interface Diagnostic {
  severity: 'error' | 'warning' | 'question';
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

export function validate(w: Workout, opts: ValidateOptions = {}): Diagnostic[] {
  const reg = opts.registry ?? defaultRegistry();
  const out: Diagnostic[] = [];
  const labels = new Set<string>();

  const add = (d: Diagnostic) => out.push(d);

  // ---- structural checks -------------------------------------------------

  const walkBlocks = (nodes: Node[], inForTime: boolean) => {
    for (const n of nodes) {
      if (n.node === 'step') { checkStep(n); continue; }
      if (n.node === 'interrupt') { for (const b of n.body) if (b.node === 'step') checkStep(b); continue; }
      if (n.node !== 'block') continue;

      if (n.label) labels.add(n.label);

      if (n.type === 'amrap' && !n.duration) {
        add({ severity: 'error', code: 'amrap-no-duration', line: n.line,
              message: 'an AMRAP needs a duration — `AMRAP 12min:`' });
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
      if (n.children.length === 0 && n.type !== 'tally') {
        add({ severity: 'warning', code: 'empty-block', line: n.line, message: `${n.type} block is empty` });
      }

      // `score: rounds + reps` only means something where rounds are open-ended.
      const s = n.score?.primary ?? '';
      const forTime = inForTime || s === 'time';
      if (/rounds/.test(s) && !n.score?.implied && n.type !== 'amrap' && n.type !== 'clock') {
        add({ severity: 'error', code: 'rounds-score-on-fixed-work', line: n.line,
              message: '`rounds + reps` needs an open-ended block — a fixed-round or for-time workout scores time' });
      }

      walkBlocks(n.children, forTime);
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
        const known = new Set(['1RM', 'TM', 'FTP', 'BW', ...(opts.profile ?? [])]);
        if (!known.has(ref) && !labels.has(ref)) {
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

  const top = w.score?.primary ?? '';
  if (/rounds/.test(top)) {
    const openEnded = w.body.some((n) =>
      n.node === 'block' && (n.type === 'amrap' || n.type === 'clock'));
    if (!openEnded) {
      add({ severity: 'error', code: 'rounds-score-on-fixed-work',
            message: '`rounds + reps` needs an open-ended block; this workout has none' });
    }
  }

  return out.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

export const errorsOnly = (d: Diagnostic[]) => d.filter((x) => x.severity === 'error');
