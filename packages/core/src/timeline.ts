/**
 * Timeline compilation (roadmap §2.4).
 *
 * The AST says what a workout *is*. A timeline says how it is *executed*: an
 * ordered structure of steps with concrete quantities, resolved targets, and a
 * pacing classification for each step. Both the display runtime and every
 * exporter consume this — FIT workout steps, Zwift `.zwo` elements, and
 * WorkoutKit interval blocks are all the same shape, which is why exports
 * become mechanical once this exists.
 *
 * Compilation does five things the AST deliberately leaves undone:
 *   1. expands rep schemes into explicit per-round quantities (spec §5.3)
 *   2. pushes block-level targets down onto steps (spec §5.0)
 *   3. resolves `+N each round` where the round count is bounded (spec §8.1)
 *   4. classifies every step as timed, athlete-paced, or capped
 *   5. records what cannot be expressed as an ordered timeline at all (§2.5)
 */

import type {
  Workout, Node, Step, Rest, Block, Interrupt, Unit, Target, Score, StepOption, Load,
} from './ast.ts';
import { pluralize } from './fold.ts';
// The same renderers `fmt` uses. A cue and a canonical line say a target the
// same way, and until 2026-08-18 they said it in two places that happened to
// agree — `targetLabel` here was a verbatim copy of `formatTarget`.
import { formatTarget, formatRx } from './units.ts';

/**
 * A movement reads plural when more than one of it is prescribed — `21
 * Thrusters`, not `21 Thruster`. Only a rep count pluralizes: a step measured in
 * distance or time is one continuous effort, so `400m Run` and `2min Plank`
 * stay as they are.
 */
function readAs(movement: string, q: Unit): string {
  const count = q.kind === 'reps' || q.kind === 'floor' ? q.value
    : q.kind === 'range' ? q.max ?? q.min
    : undefined;
  return count !== undefined && count > 1 ? pluralize(movement) : movement;
}

/** What advances a step. The axis the display runtime switches on. */
export type Pacing =
  | 'timed'      // a clock ends it; auto-advances
  | 'athlete'    // the athlete ends it; needs an input to advance
  | 'capped'     // athlete-paced, but a running clock can end it first
  | 'threshold'; // a sensor reading ends it — advance on heart rate or power

export interface TimelineStep {
  kind: 'step';
  movement: string;
  quantity: Unit;
  targets: Target[];
  /**
   * The unresolved rx split, when no division has been chosen. Carried
   * structurally as well as in the label so a consumer can offer the choice
   * rather than parse the text back out of the cue. Absent once `resolve()`
   * has picked a division — the load is then an ordinary target.
   */
  rx?: Record<string, Load>;
  pacing: Pacing;
  /** Known duration in seconds, when the step is clock-bounded. */
  seconds?: number;
  measures?: 'reps' | 'calories' | 'distance';
  laterality?: string;
  side?: string;
  limb?: string;
  tempo?: string;
  team?: string;
  /** Retained when the round count is unbounded and the delta cannot be expanded. */
  perRound?: { delta: number; unit: string };
  /** Alternatives the athlete picks between; the first is the prescription. */
  options?: StepOption[];
  flags: string[];
  notes: string[];
  /** Human-readable line for a display. */
  label: string;
  /**
   * The source line this came from. A rep scheme expands into several steps
   * that all point at the one line that was written, which is what a cursor on
   * a whiteboard needs: the reader is looking at `21-15-9`, not at tier two.
   */
  line?: number;
}

export interface TimelineRest {
  kind: 'rest';
  seconds?: number;
  dynamic?: 'as-needed' | 'equal-to-work';
  /** Whether this rest also fires after the final round (spec §5.2, N1). */
  afterLast: boolean;
  pacing: Pacing;
  label: string;
  /** The source line this came from. */
  line?: number;
}

export type GroupType =
  | 'sequence' | 'repeat' | 'amrap' | 'clock' | 'tally' | 'attempts' | 'team'
  | 'partnerRotation' | 'build';

export interface TimelineGroup {
  kind: 'group';
  type: GroupType;
  /** Bounded iteration count, when known. */
  rounds?: number;
  untilFailure?: boolean;
  /** Total window in seconds (AMRAP, EMOM, build). */
  window?: number;
  /** Cadence in seconds for clock-driven groups. */
  every?: number;
  onOverrun?: 'carry' | 'cut' | 'fail';
  cap?: number;
  /** True for tally blocks: the items have no prescribed order (§2.5). */
  freeOrder?: boolean;
  /** Team size, for shared/each arithmetic. */
  teamSize?: number;
  /**
   * A periodic interruption of everything in this group (spec §5.8). Its
   * interval may state the same bound a clock-driven group's does (§5.5) —
   * a count of cycles, a window, or failure — carried here so it reaches a
   * display and round-trips. It does not feed `estimate()`: an overlay is
   * bounded by the primary work beside it, and whether its own bound ends the
   * group first is a per-execution question the ordered timeline does not
   * answer (the block path leaves the same question open for a bare `AMRAP:`
   * under a cap). No corpus workout writes a bounded overlay.
   */
  interrupt?: { every: number; count?: number; window?: number; untilFailure?: boolean; items: TimelineItem[] };
  equipment: string[];
  score?: Score;
  label: string;
  /** The source line this came from. */
  line?: number;
  items: TimelineItem[];
}

export type TimelineItem = TimelineStep | TimelineRest | TimelineGroup;

export interface Timeline {
  root: TimelineGroup;
  /** Total seconds, when every part is clock-bounded. Undefined if athlete-paced. */
  estimatedSeconds?: number;
  /**
   * The most the workout may take, when a cap bounds the whole of it.
   *
   * Kept apart from `estimatedSeconds` on purpose: a cap says *at most*, and a
   * for-time workout under one is still athlete-paced — an athlete who finishes
   * Open 25.2 in eight minutes took eight, not the twelve they were allowed.
   * Both are set only where the cap is also the length, which is the block that
   * runs until the clock stops (spec §5.6).
   */
  cap?: number;
  /** Regions an ordered timeline cannot represent, for exporters to report. */
  warnings: string[];
  score?: Score;
}

// ---------------------------------------------------------------------------

const secondsOf = (u?: Unit) => (u && u.kind === 'duration' ? u.seconds : undefined);

function quantityLabel(u: Unit): string {
  switch (u.kind) {
    case 'reps': return `${u.value}`;
    case 'distance': return `${u.value}${u.unit}`;
    case 'calories': return `${u.value}cal`;
    case 'duration': return fmtClock(u.seconds);
    case 'max': return 'max';
    case 'floor': return `${u.value}+`;
    case 'range': return `${u.min}-${u.max}`;
    case 'maxEffort': return 'max';
    case 'threshold': return `until ${u.metric === 'hr' ? 'HR' : 'power'} ${u.compare === 'lt' ? '<' : '>'} ${u.zone !== undefined ? `Z${u.zone}` : `${u.value}${u.unit}`}`;
    case 'open': return '';
  }
}

export function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

/** Merge inherited targets under a step's own, which always win. */
function mergeTargets(own: Target[], inherited: Target[]): Target[] {
  const has = (k: string) => own.some((t) => t.kind === k);
  return [...own, ...inherited.filter((t) => !has(t.kind))];
}

/** Turn a scheme tier into a quantity of the scheme's declared unit. */
function schemeQuantity(value: number, unit?: string): Unit {
  switch (unit) {
    case undefined: case 'reps': return { kind: 'reps', value };
    case 'cal': return { kind: 'calories', value };
    case 's': return { kind: 'duration', seconds: value };
    case 'min': return { kind: 'duration', seconds: value * 60 };
    default: return { kind: 'distance', value, unit: unit as any };
  }
}

interface Ctx {
  inherited: Target[];
  schemeUnit?: string;
  /** The enclosing rep scheme, so a `reversed` step can index from the far end. */
  scheme?: number[];
  schemeIndex?: number;
  /** Round index (1-based) when expanding a bounded repeat. */
  round?: number;
  /** Quantity imposed by an enclosing rep scheme. */
  schemeReps?: number;
  warnings: string[];
}

function compileStep(s: Step, ctx: Ctx, enclosing: { clock?: boolean; capped?: boolean }): TimelineStep {
  let quantity = s.quantity;

  // A rep scheme supplies the count for steps that don't carry their own.
  // `reversed` takes the mirrored tier — the ascending/descending pairing that
  // J.J., "The Ladder", and Open 22.2's couplet are all built on.
  if (ctx.schemeReps !== undefined && quantity.kind === 'open') {
    const reversed = s.flags.includes('reversed');
    const value = reversed && ctx.scheme && ctx.schemeIndex !== undefined
      ? ctx.scheme[ctx.scheme.length - 1 - ctx.schemeIndex]
      : ctx.schemeReps;
    quantity = schemeQuantity(value, ctx.schemeUnit);
  }
  // `+N each round`, resolved when the round is known.
  if (s.perRound && ctx.round !== undefined && quantity.kind === 'reps') {
    quantity = { kind: 'reps', value: quantity.value + s.perRound.delta * (ctx.round - 1) };
  }

  // Pacing and duration follow the resolved quantity: `1..5..1 min:` makes an
  // otherwise open step a timed one, and the scheme is only known here.
  const pacing = pacingFor(quantity, enclosing);
  const seconds = quantity.kind === 'duration' ? quantity.seconds : undefined;

  const targets = mergeTargets(s.targets, ctx.inherited);
  // A threshold reads as a condition on the movement, so it trails it.
  const trailing = quantity.kind === 'threshold';
  const q = quantityLabel(quantity);
  const name = readAs(s.movement, quantity);
  let label = (trailing ? [name, q] : [q, name]).filter(Boolean).join(' ');
  // The alternatives belong on the board: the choice is the athlete's, and a
  // cue naming only the first is a cue that has quietly made it for them.
  for (const opt of (s.options ?? []).slice(1)) {
    const same = JSON.stringify(opt.quantity) === JSON.stringify(s.quantity);
    label += ` or ${same ? readAs(opt.movement, quantity)
      : `${quantityLabel(opt.quantity)} ${readAs(opt.movement, opt.quantity)}`}`;
  }
  if (s.laterality === 'per-side') label += ` each ${s.limb ?? 'side'}`;
  if (s.side) label += ` ${s.side} ${s.limb ?? 'arm'}`;
  // An rx split that nobody has resolved reads as what was written — both
  // magnitudes, labelled, in the position `fmt` puts them. `resolve()` in
  // `variants.ts` replaces it with one division's load and leaves nothing here
  // to render; **with no division chosen the step still has to say a weight**,
  // and that is the state both apps are permanently in. Until 2026-08-18 this
  // line did not exist and an rx step reached the board with no load at all.
  if (s.rx) label += ` (${formatRx(s.rx)})`;
  for (const t of targets) label += ` @ ${formatTarget(t)}`;
  // A team qualifier trails the target, exactly where `format` writes it (§5.11),
  // because it qualifies the whole prescription. Spec §5.11 requires it stated
  // *always* — "40 Burpees" in a team context is what a reader guesses wrong
  // about — and the board's cue label is the one place a reader sees it, so
  // dropping it here (as this did until 2026-08-28) defeated the rule. The bare
  // `each` team word never collides with per-side `each <limb>` laterality: the
  // grammar consumes `each arm` as the `-- limb` production before `-- team` can
  // see it, so `s.team` is only ever set by an explicit second word. Written
  // together (`each arm each`) both render, matching `format` line for line.
  if (s.team) label += ` ${s.team}`;
  if (s.perRound && ctx.round === undefined) label += `, +${s.perRound.delta} each round`;

  return {
    kind: 'step',
    movement: s.movement,
    quantity,
    targets,
    rx: s.rx,
    pacing,
    seconds,
    measures: s.measures ?? (quantity.kind === 'calories' ? 'calories' : undefined),
    laterality: s.laterality,
    side: s.side,
    limb: s.limb,
    tempo: s.tempo,
    team: s.team,
    perRound: s.perRound && ctx.round === undefined ? s.perRound : undefined,
    flags: s.flags,
    notes: s.notes,
    options: s.options,
    label,
    line: s.line,
  };
}

function compileRest(r: Rest): TimelineRest {
  const seconds = secondsOf(r.duration);
  const threshold = r.duration?.kind === 'threshold';
  return {
    kind: 'rest',
    line: r.line,
    seconds,
    dynamic: r.dynamic,
    afterLast: r.afterLast,
    pacing: threshold ? 'threshold' : seconds !== undefined ? 'timed' : 'athlete',
    label: threshold ? `rest ${quantityLabel(r.duration!)}`
      : r.active ? `rest — ${quantityLabel(r.active.quantity)} ${r.active.movement}`
      : r.dynamic === 'equal-to-work' ? 'rest (equal to work)'
      : r.dynamic === 'as-needed' ? 'rest as needed'
      : `rest ${seconds !== undefined ? fmtClock(seconds) : ''}`.trim(),
  };
}

/** Pacing for a step, given what encloses it. */
function pacingFor(q: Unit, enclosing: { clock?: boolean; capped?: boolean }): Pacing {
  if (q.kind === 'duration') return 'timed';
  // `max` is a remainder only when a clock encloses it. With no clock it is a
  // max effort to failure, which the athlete ends (Lynne, not an EMOM).
  if (q.kind === 'threshold') return 'threshold';
  if (q.kind === 'max') return enclosing.clock || enclosing.capped ? 'timed' : 'athlete';
  if (enclosing.capped) return 'capped';
  return 'athlete';
}

function compileNodes(nodes: Node[], ctx: Ctx, enclosing: { clock?: boolean; capped?: boolean }): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const n of nodes) {
    if (n.node === 'step') {
      const compiled = compileStep(n, ctx, enclosing);
      // `x5` is five identical sets, expanded so totals and timelines are right.
      for (let i = 0; i < (n.sets ?? 1); i++) out.push(compiled);
    } else if (n.node === 'rest') {
      out.push(compileRest(n));
    } else if (n.node === 'interrupt') {
      // handled by the enclosing group
    } else {
      out.push(compileBlock(n, ctx, enclosing));
    }
  }
  return out;
}

function compileBlock(b: Block, parent: Ctx, enclosing: { clock?: boolean; capped?: boolean }): TimelineGroup {
  const ctx: Ctx = {
    inherited: [...parent.inherited, ...b.inherited],
    round: parent.round,
    warnings: parent.warnings,
  };

  const cap = secondsOf(b.cap);
  const window = secondsOf(b.duration);
  const every = secondsOf(b.every);
  const here = {
    clock: enclosing.clock || b.type === 'clock',
    capped: enclosing.capped || cap !== undefined || b.type === 'amrap',
  };

  const group: TimelineGroup = {
    kind: 'group',
    type: 'sequence',
    line: b.line,
    cap,
    equipment: [...b.equipment],
    score: b.score,
    label: '',
    items: [],
  };

  // An interrupt overlays everything else in the block (spec §5.8).
  const interrupt = b.children.find((c) => c.node === 'interrupt') as Interrupt | undefined;
  const children = b.children.filter((c) => c.node !== 'interrupt');
  if (interrupt) {
    group.interrupt = {
      every: secondsOf(interrupt.every) ?? 60,
      ...(interrupt.count !== undefined ? { count: interrupt.count } : {}),
      ...(interrupt.duration ? { window: secondsOf(interrupt.duration) } : {}),
      ...(interrupt.untilFailure ? { untilFailure: true } : {}),
      items: compileNodes(interrupt.body, ctx, here),
    };
  }

  switch (b.type) {
    case 'ladder': {
      // A rep scheme is sugar: expand it into one explicit round per tier.
      group.type = 'sequence';
      group.label = b.scheme!.join('-') + (b.schemeUnit ? ' ' + b.schemeUnit : '');
      b.scheme!.forEach((reps, i) => {
        const round: TimelineGroup = {
          kind: 'group', type: 'sequence', rounds: 1, equipment: [],
          label: `round ${i + 1} — ${reps}`,
          items: compileNodes(children, {
            ...ctx, schemeReps: reps, round: i + 1, scheme: b.scheme, schemeIndex: i,
            schemeUnit: b.schemeUnit,
          }, here),
        };
        group.items.push(round);
      });
      return group;
    }
    case 'repeat': {
      group.type = 'repeat';
      group.rounds = b.count;
      group.label = `${b.count} ${b.flags.includes('sets') ? 'sets' : 'rounds'}`;
      // `+N each round` only expands when the round count is known.
      const ascending = children.some((c) => c.node === 'step' && (c as Step).perRound);
      if (ascending && b.count) {
        group.type = 'sequence';
        group.rounds = undefined;
        for (let r = 1; r <= b.count; r++) {
          group.items.push({
            kind: 'group', type: 'sequence', rounds: 1, equipment: [],
            label: `round ${r}`,
            items: compileNodes(children, { ...ctx, round: r }, here),
          });
        }
        return group;
      }
      break;
    }
    case 'amrap':
      group.type = 'amrap';
      group.window = window;
      group.label = `AMRAP ${window !== undefined ? fmtClock(window) : ''}`.trim();
      break;
    case 'clock':
      group.type = 'clock';
      group.every = every;
      group.window = window;
      group.rounds = b.count ?? (window && every ? Math.floor(window / every) : undefined);
      group.untilFailure = b.untilFailure;
      group.onOverrun = b.onOverrun ?? 'carry';
      group.label = b.untilFailure
        ? `every ${every !== undefined ? fmtClock(every) : ''} until failure`
        : `every ${every !== undefined ? fmtClock(every) : ''} x ${group.rounds ?? '?'}`;
      if (b.untilFailure) {
        parent.warnings.push('unbounded repeat: the number of rounds is not known until execution');
      }
      break;
    case 'tally':
      group.type = 'tally';
      group.freeOrder = true;
      group.label = 'any order';
      parent.warnings.push(
        'tally block: totals with no prescribed order — cannot be expressed as an ordered timeline',
      );
      break;
    case 'team':
      group.type = 'team';
      group.teamSize = b.count;
      group.label = `team of ${b.count}`;
      break;
    // Both steps are live at once, one partner on each, and then they swap. A
    // timeline is one athlete's order, so the two are *sequential* here and that
    // is correct for either partner — what a timeline cannot say is that the
    // second is bounded by the first rather than by its own count, so it says so
    // out loud rather than compiling a duration nobody prescribed (spec §5.11.1).
    case 'partnerRotation':
      group.type = 'partnerRotation';
      group.teamSize = 2;
      group.label = 'partner rotation';
      // No prescribed order, for the reason a tally block has none but arrived
      // at from the other side: the order is prescribed *per athlete* and the
      // two athletes take opposite ones, so "which comes first" has no single
      // answer and adjacency questions cannot be asked of it.
      group.freeOrder = true;
      parent.warnings.push(
        'partner rotation: each step is bounded by the partner working alongside it, '
        + 'so its length is not known until execution',
      );
      break;
    case 'attempts':
      group.type = 'attempts';
      group.rounds = b.count;
      group.label = `${b.count} attempts`;
      break;
    case 'build':
      group.type = 'build';
      group.window = window;
      group.label = `build to ${b.buildTarget ?? 'a heavy single'}`;
      break;
    case 'work':
      group.type = 'sequence';
      group.label = `work ${window !== undefined ? fmtClock(window) : ''}`.trim();
      // A `work 20s:` wrapper makes its single child a timed step.
      group.items = compileNodes(children, ctx, { ...here, clock: true }).map((it) =>
        it.kind === 'step' && it.quantity.kind === 'open'
          ? { ...it, quantity: { kind: 'duration', seconds: window ?? 0 } as Unit,
              pacing: 'timed' as Pacing, seconds: window,
              label: `${fmtClock(window ?? 0)} ${it.movement}` }
          : it,
      );
      return group;
    case 'cycleEntry':
      group.type = 'sequence';
      group.label = `min ${b.count}`;
      break;
    case 'section':
      group.type = 'sequence';
      group.label = b.name ?? '';
      break;
    default:
      group.type = 'sequence';
      group.label = b.name ?? '';
  }

  group.items = compileNodes(children, ctx, here);
  return group;
}

/**
 * Work that runs until a clock stops rather than until the work is done: an
 * AMRAP or a build with no window of its own. Under a cap it takes whatever
 * time is left (spec §5.6), which is why such a block's cap is a duration where
 * every other cap is only a bound. A group carrying its own cap fills that one
 * and not the one above it.
 */
function fillsTheClock(item: TimelineItem): boolean {
  if (item.kind !== 'group') return false;
  if ((item.type === 'amrap' || item.type === 'build') && item.window === undefined) return true;
  return item.cap === undefined && item.items.some(fillsTheClock);
}

/**
 * The cap that bounds the *workout*, when one does.
 *
 * The same rule `run` applies to a window, and for the same reason: a statement
 * about the whole may only be made by something that spans the whole, so a cap
 * counts only where it and every group above it is an only child. A capped
 * section between two others caps that section and says nothing about how long
 * the workout may take.
 */
function spineCap(item: TimelineItem): number | undefined {
  if (item.kind !== 'group') return undefined;
  if (item.cap !== undefined) return item.cap;
  return item.items.length === 1 ? spineCap(item.items[0]) : undefined;
}

/** Sum the wall-clock duration of a timeline, when every part is clock-bounded. */
function estimate(item: TimelineItem): number | undefined {
  if (item.kind === 'step') return item.seconds;
  if (item.kind === 'rest') return item.seconds;

  if (item.type === 'amrap' || item.type === 'build') return item.window;
  if (item.type === 'clock') {
    if (item.untilFailure) return undefined;
    return item.window ?? (item.every && item.rounds ? item.every * item.rounds : undefined);
  }

  let total = 0;
  let unknown = false;
  let filled = false;
  for (const c of item.items) {
    if (fillsTheClock(c)) { filled = true; continue; }
    const s = estimate(c);
    if (s === undefined) unknown = true;
    else total += s;
  }
  // A cap is a bound, not a length. `for time, cap 12min:` over athlete-paced
  // work says *at most* twelve minutes, and returning the cap here reported it
  // as how long the workout takes — the same conflation as an AMRAP's window,
  // one step along. The cap is carried by `Timeline.cap` instead, so a caller
  // can say "at most" rather than having to guess which of the two it holds.
  //
  // The exception is work that runs until the clock stops: the cap supplies a
  // bare AMRAP's window (§5.6), so the block ends *at* the cap and that is a
  // real duration.
  if (filled) return item.cap;
  if (unknown) return undefined;

  const repeats = (item.type === 'repeat' || item.type === 'attempts') ? item.rounds : undefined;
  if (repeats) {
    total *= repeats;
    // A trailing rest fires *between* rounds, not after the last one (spec §5.2) —
    // which is what makes Fight Gone Bad 17 minutes rather than 18.
    //
    // Unless the round is an interval: a `work Xs:` block makes the paired rest
    // structural rather than recovery, so it fires every round. That is why a
    // Tabata block is exactly 4:00 and not 3:50.
    const interval = item.items.some((c) => c.kind === 'group' && /^work /.test(c.label));
    const last = item.items[item.items.length - 1];
    if (!interval && last?.kind === 'rest' && !last.afterLast && last.seconds !== undefined) {
      total -= last.seconds;
    }
  }
  return item.cap !== undefined ? Math.min(total, item.cap) : total;
}

export function compile(w: Workout): Timeline {
  const warnings: string[] = [];
  const ctx: Ctx = { inherited: [], warnings };
  const root: TimelineGroup = {
    kind: 'group', type: 'sequence', equipment: [],
    label: w.title ?? '', items: [], score: w.score,
  };
  root.items = compileNodes(w.body, ctx, {});
  return { root, estimatedSeconds: estimate(root), cap: spineCap(root), warnings, score: w.score };
}

/** Flatten to a readable outline — what a display would render, and a debugging aid. */
export function outline(t: Timeline): string[] {
  const out: string[] = [];
  const walk = (item: TimelineItem, depth: number) => {
    const pad = '  '.repeat(depth);
    if (item.kind === 'step') { out.push(`${pad}${item.label}  [${item.pacing}]`); return; }
    if (item.kind === 'rest') { out.push(`${pad}${item.label}  [${item.pacing}]`); return; }
    if (item.label) out.push(`${pad}${item.label}:`);
    for (const c of item.items) walk(c, item.label ? depth + 1 : depth);
    if (item.interrupt) {
      const iv = item.interrupt;
      const bound = iv.untilFailure ? ' until failure'
        : iv.window !== undefined ? ` for ${fmtClock(iv.window)}`
        : iv.count !== undefined ? ` x ${iv.count}`
        : '';
      out.push(`${pad}  ↻ every ${fmtClock(iv.every)}${bound}:`);
      for (const c of iv.items) walk(c, depth + 2);
    }
  };
  walk(t.root, 0);
  return out;
}
