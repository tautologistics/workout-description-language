/** AST -> canonical text (spec §1 rule 2: forgiving on input, strict on output). */

import { pluralize } from './fold.ts';
import type { Workout, Node, Step, Rest, Block, Interrupt, Score } from './ast.ts';
import { formatQuantity, formatDuration, formatTarget } from './units.ts';
import type { Unit } from './ast.ts';

/** Durations may legitimately be absent (`AMRAP:` inside a cap), so never assume. */
const dur = (u?: Unit) => (u ? formatDuration(u) : '');

const IND = '  ';

/**
 * The count that decides how a movement reads, which is not always on the step.
 *
 * Under a rep scheme the step carries no number — `21-15-9:` then `- Thruster` —
 * so the scheme supplies it. Every tier of a scheme is either all above one or
 * it is not, and a scheme ending in a single rep is still a plural prescription:
 * the largest tier is what the line reads as.
 */
function countFor(s: Step, scheme?: Scheme): number | undefined {
  const q = s.quantity;
  if (q.kind === 'reps' || q.kind === 'floor') return q.value;
  if (q.kind === 'range') return q.max;
  // A scheme in metres or seconds counts distance or time, not repetitions:
  // `250-500-750 m: - Row` is one row of each distance, not 250 rows.
  if (q.kind === 'open' && scheme?.tiers.length && (!scheme.unit || scheme.unit === 'reps')) {
    return Math.max(...scheme.tiers);
  }
  return undefined;
}

/** A rep scheme, and what its numbers count. */
interface Scheme { tiers: number[]; unit?: string }

function stepText(s: Step, scheme?: Scheme): string {
  let out = '- ';
  // A threshold reads as a condition on the movement, so it trails it —
  // `Bike until HR > 160bpm`, not `until HR > 160bpm Bike`.
  const trailing = s.quantity.kind === 'threshold';
  const q = formatQuantity(s.quantity);
  if (q && !trailing) out += q + ' ';
  if (s.flags.includes('max') && s.quantity.kind === 'duration') out += 'max ';
  // A whiteboard says `21 Thrusters`. Identity is unaffected — `fold()`
  // depluralizes — so this is only how the line reads.
  const count = countFor(s, scheme);
  const name = (m: string) => (count !== undefined && count > 1 ? pluralize(m) : m);
  out += name(s.movement);
  if (trailing) out += ` ${q}`;

  // `A or B`. An alternative measured the same way as the first says only its
  // name — writing `1min Bike or 1min Row` where `1min Bike or Row` was meant is
  // how a format starts reading like a form.
  for (const opt of (s.options ?? []).slice(1)) {
    const same = JSON.stringify(opt.quantity) === JSON.stringify(s.quantity);
    out += ` or ${same ? name(opt.movement) : `${formatQuantity(opt.quantity)} ${name(opt.movement)}`}`;
  }

  // Laterality and side attach to the movement, so they precede the targets —
  // `10 Dumbbell Curl each arm @ 2x35lb`, not `… @ 2x35lb each arm`. All three
  // counting modes emit in the same position (spec §4).
  if (s.laterality === 'both' || s.laterality === 'split') out += ` (${s.laterality})`;
  if (s.laterality === 'per-side') out += ` each ${s.limb ?? 'side'}`;
  if (s.side) out += ` ${s.side} ${s.limb ?? 'arm'}`;

  // Written back labelled, whichever way it came in. `(105/145)` is readable
  // once you know the rule; `(women 105lb / men 145lb)` needs no rule at all,
  // and canonical output is where the ambiguity should stop.
  if (s.rx) {
    const one = (l: any) => `${l.value}${l.unit ?? ''}`;
    out += ` (women ${one(s.rx.women)} / men ${one(s.rx.men)})`;
  }

  for (const t of s.targets) out += ` @ ${formatTarget(t)}`;

  // Team words trail the target, since they qualify the whole prescription.
  if (s.team) out += ` ${s.team}`;
  if (s.sets) out += ` x${s.sets}`;

  const quals: string[] = [];
  if (s.tempo) quals.push(`tempo ${s.tempo}`);
  if (s.measures === 'calories') quals.push('count cal');
  if (s.measures === 'reps' && !s.flags.includes('max')) quals.push('count reps');
  if (s.perRound) quals.push(`+${s.perRound.delta} each round`);
  for (const f of s.flags) if (f !== 'tiebreak' && f !== 'max') quals.push(f);
  for (const n of s.notes) quals.push(n);
  if (quals.length) out += ', ' + quals.join(', ');
  if (s.flags.includes('tiebreak')) out += ' @tiebreak';
  return out;
}

/**
 * A rest, and `after last` is not part of its bound.
 *
 * The bound is five different kinds of thing — the athlete's discretion, the
 * preceding work, work of its own, a sensor reading, a clock — and `after last`
 * says *which* rest rather than how long it is (spec §5.2, N1), so it can sit
 * after any of them and is appended once, here, rather than by each branch.
 *
 * *It used to be appended by one branch only.* Four of the five returned early,
 * so `rest as needed after last` formatted to `rest as needed` — "rest only
 * after the last round" quietly became "rest between every round", which is a
 * different workout, and `wdl check` said ok. The round trip could not see it
 * either: the *second* format of the shortened line is stable, so the shape
 * settled perfectly on a reading that had lost a fact. One more case of the
 * standing lesson that a fixpoint proves stability and not correctness.
 */
function restText(r: Rest): string {
  const bound = (): string => {
    if (r.dynamic === 'as-needed') return 'as needed';
    if (r.dynamic === 'equal-to-work') return '= work';
    if (r.active) return `${formatQuantity(r.active.quantity)} ${r.active.movement}`;
    if (r.duration?.kind === 'threshold') return formatQuantity(r.duration);
    return r.duration ? formatDuration(r.duration) : '';
  };
  // Joined rather than concatenated, so an unbounded `rest after last` does not
  // come out with two spaces in it and a bound is never reformatted on its way
  // through — an active recovery's movement name is held verbatim.
  return ['rest', bound(), r.afterLast ? 'after last' : ''].filter(Boolean).join(' ');
}

/**
 * Scoring emits as plain sibling lines, never a nested object. A compound score
 * used to canonicalise to `score: { primary: time, on cap: reps }`, which is
 * JSON wearing a costume — and if the at-rest format degenerates into that, the
 * whole premise is gone: nobody writes braces on a whiteboard.
 */
function scoreLines(s: Score): string[] {
  // `.trimEnd()` for the one case that has nothing to put here: a brace score
  // that named a tiebreak and no `primary:`. The primary is empty, deliberately —
  // an absent primary is absent — and the line must not go out with a trailing
  // space, which is neither what the author wrote nor a fixpoint.
  const out = [`score: ${s.onCap || s.tiebreak ? s.primary : s.raw}`.trimEnd()];
  // `on cap: reps` is the default when a cap exists, so only state it otherwise.
  if (s.onCap && s.onCap !== 'reps') out.push(`on cap: ${s.onCap}`);
  if (s.tiebreak) out.push(`tiebreak: ${s.tiebreak}`);
  return out;
}

/** Collapse contiguous runs of 1 into `a..b`; anything else stays explicit. */
function formatScheme(scheme: number[]): string {
  const points: number[] = [scheme[0]];
  for (let i = 1; i < scheme.length; i++) {
    const d = scheme[i] - scheme[i - 1];
    if (Math.abs(d) !== 1) return scheme.join('-');
    const prev = scheme[i - 1] - (points.length > 1 || i > 1 ? scheme[i - 2] ?? scheme[i - 1] : scheme[i - 1]);
    if (i > 1 && Math.sign(d) !== Math.sign(scheme[i - 1] - scheme[i - 2])) points.push(scheme[i - 1]);
  }
  points.push(scheme[scheme.length - 1]);
  return scheme.length > 3 ? points.join('..') : scheme.join('-');
}

function headerText(b: Block): string {
  let head = '';
  switch (b.type) {
    case 'repeat': head = `${b.count} ${b.flags.includes('sets') ? 'sets' : 'rounds'}`; break;
    case 'attempts': head = `${b.count} attempts`; break;
    case 'team': head = `team of ${b.count}`; break;
    case 'ladder': head = formatScheme(b.scheme!) + (b.schemeUnit ? ` ${b.schemeUnit}` : ''); break;
    case 'amrap':
      head = b.flags.includes('for-duration') ? `for ${dur(b.duration)}` : `AMRAP ${dur(b.duration)}`.trim();
      break;
    case 'clock': {
      const every = dur(b.every);
      if (b.untilFailure) head = `every ${every} until failure`;
      else if (b.duration && b.every?.seconds === 60) head = `EMOM ${dur(b.duration)}`;
      else if (b.duration) head = `every ${every} for ${dur(b.duration)}`;
      else head = `every ${every} x ${b.count}`;
      break;
    }
    case 'work': head = `work ${dur(b.duration)}`.trim(); break;
    case 'cycleEntry': head = `min ${b.count}`; break;
    case 'tally': head = 'any order'; break;
    case 'superset': head = 'superset'; break;
    case 'complex': head = 'complex'; break;
    case 'build':
      head = `build to ${b.buildTarget} in ${dur(b.duration)}`.trim();
      if (b.label) head += ` as ${b.label}`;
      break;
    case 'section': head = b.name!; break;
    default: head = b.name ?? 'sequence';
  }

  // `for time` fuses onto a repeat header, matching how workouts are written.
  const fusedForTime =
    b.score?.implied && b.score.primary === 'time' &&
    (b.type === 'repeat' || b.type === 'sequence');
  if (fusedForTime) head = head === 'sequence' ? 'for time' : `${head} for time`;

  for (const t of b.inherited) head += ` @ ${formatTarget(t)}`;

  const mods: string[] = [];
  if (b.cap) mods.push(`cap ${dur(b.cap)}`);
  if (b.onOverrun) mods.push(`${b.onOverrun} on overrun`);
  for (const e of b.equipment) mods.push(`wearing ${e}`);
  for (const f of b.flags) if (!['sets', 'rounds', 'for-duration'].includes(f)) mods.push(f);

  return [head, ...mods].join(', ') + ':';
}

function emit(n: Node, depth: number, out: string[], scheme?: Scheme) {
  const pad = IND.repeat(depth);
  for (const c of n.comments) out.push(`${pad}// ${c}`);

  switch (n.node) {
    case 'step': {
      // The block form is written back as a block: it was chosen because three
      // measures on one line is a mouthful, and rewriting it inline would undo
      // the reason.
      if (n.optionsForm === 'block' && n.options && n.options.length > 1) {
        out.push(`${pad}choice:`);
        for (const o of n.options) {
          const q = formatQuantity(o.quantity);
          const count = o.quantity.kind === 'reps' ? o.quantity.value : undefined;
          const name = count !== undefined && count > 1 ? pluralize(o.movement) : o.movement;
          out.push(`${pad}${IND}- ${[q, name].filter(Boolean).join(' ')}`);
        }
        return;
      }
      out.push(pad + stepText(n, scheme));
      return;
    }
    case 'rest': out.push(pad + restText(n)); return;
    case 'interrupt':
      out.push(`${pad}every ${formatDuration(n.every)}: ${stepText(n.body[0] as Step).replace(/^- /, '')}`);
      return;
    case 'block': {
      // `min 1: 12cal Row` and `work 20s: Burpee` stay on one line
      if ((n.type === 'cycleEntry' || n.type === 'work') && n.children.length === 1) {
        const c = n.children[0];
        const inner = c.node === 'step' ? stepText(c, scheme).replace(/^- /, '') : restText(c as Rest);
        out.push(`${pad}${headerText(n).replace(/:$/, '')}: ${inner}`);
        return;
      }
      out.push(pad + headerText(n));
      // A rep scheme reaches the steps under it, which carry no count of their own.
      for (const c of n.children) emit(c, depth + 1, out, n.scheme ? { tiers: n.scheme, unit: n.schemeUnit } : scheme);
      if (n.score && !n.score.implied) for (const l of scoreLines(n.score)) out.push(`${pad}${IND}${l}`);
      return;
    }
  }
}

export function format(w: Workout): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(w.directives)) out.push(`@${k}${v ? ' ' + v : ''}`);
  if (out.length) out.push('');
  if (w.title) { out.push(`# ${w.title}`); out.push(''); }

  for (const n of w.body) emit(n, 0, out);

  if (w.score) { out.push(''); out.push(...scoreLines(w.score)); }
  if (w.variants) {
    out.push('');
    out.push('variants:');
    for (const [name, entries] of Object.entries(w.variants)) {
      out.push(`${IND}${name}:`);
      for (const [k, v] of Object.entries(entries)) out.push(`${IND}${IND}${k}: ${v}`);
    }
  }
  for (const c of w.comments) out.push(`// ${c}`);
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
