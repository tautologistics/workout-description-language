/** AST -> canonical text (spec §1 rule 2: forgiving on input, strict on output). */

import type { Workout, Node, Step, Rest, Block, Interrupt, Score } from './ast.ts';
import { formatQuantity, formatDuration, formatTarget } from './units.ts';
import type { Unit } from './ast.ts';

/** Durations may legitimately be absent (`AMRAP:` inside a cap), so never assume. */
const dur = (u?: Unit) => (u ? formatDuration(u) : '');

const IND = '  ';

function stepText(s: Step): string {
  let out = '- ';
  const q = formatQuantity(s.quantity);
  if (q) out += q + ' ';
  if (s.flags.includes('max') && s.quantity.kind === 'duration') out += 'max ';
  out += s.movement;

  // Laterality and side attach to the movement, so they precede the targets —
  // `10 Dumbbell Curl each arm @ 2x35lb`, not `… @ 2x35lb each arm`. All three
  // counting modes emit in the same position (spec §4).
  if (s.laterality === 'both' || s.laterality === 'split') out += ` (${s.laterality})`;
  if (s.laterality === 'per-side') out += ` each ${s.limb ?? 'side'}`;
  if (s.side) out += ` ${s.side} ${s.limb ?? 'arm'}`;

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

function restText(r: Rest): string {
  if (r.dynamic === 'as-needed') return 'rest as needed';
  if (r.dynamic === 'equal-to-work') return 'rest = work';
  if (r.active) return `rest ${formatQuantity(r.active.quantity)} ${r.active.movement}`;
  let out = `rest ${r.duration ? formatDuration(r.duration) : ''}`.trim();
  if (r.afterLast) out += ' after last';
  return out;
}

function scoreText(s: Score): string {
  if (s.onCap || s.tiebreak) {
    const parts = [`primary: ${s.primary}`];
    if (s.onCap) parts.push(`on cap: ${s.onCap}`);
    if (s.tiebreak) parts.push(`tiebreak: ${s.tiebreak}`);
    return `score: { ${parts.join(', ')} }`;
  }
  return `score: ${s.raw}`;
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

function emit(n: Node, depth: number, out: string[]) {
  const pad = IND.repeat(depth);
  for (const c of n.comments) out.push(`${pad}// ${c}`);

  switch (n.node) {
    case 'step': out.push(pad + stepText(n)); return;
    case 'rest': out.push(pad + restText(n)); return;
    case 'interrupt':
      out.push(`${pad}every ${formatDuration(n.every)}: ${stepText(n.body[0] as Step).replace(/^- /, '')}`);
      return;
    case 'block': {
      // `min 1: 12cal Row` and `work 20s: Burpee` stay on one line
      if ((n.type === 'cycleEntry' || n.type === 'work') && n.children.length === 1) {
        const c = n.children[0];
        const inner = c.node === 'step' ? stepText(c).replace(/^- /, '') : restText(c as Rest);
        out.push(`${pad}${headerText(n).replace(/:$/, '')}: ${inner}`);
        return;
      }
      out.push(pad + headerText(n));
      for (const c of n.children) emit(c, depth + 1, out);
      if (n.score && !n.score.implied) out.push(`${pad}${IND}${scoreText(n.score)}`);
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

  if (w.score) { out.push(''); out.push(scoreText(w.score)); }
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
