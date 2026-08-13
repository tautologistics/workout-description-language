/**
 * A timeline, laid out as the ordered things an athlete actually does.
 *
 * The timeline is a tree: five rounds of a couplet is one group with two steps
 * in it. Running the workout is a walk through that tree — round one's thruster,
 * round one's pull-up, round two's thruster — and every display, timer and
 * runtime needs the walk rather than the tree.
 *
 * Three things this adds that the timeline leaves implicit:
 *
 * **Round context.** A cue knows it is round 2 of 5, and of which block, so a
 * display can say so without re-deriving it.
 *
 * **A source line.** Every cue points at the line that was written. A rep scheme
 * expands into three cues that all point at the one `21-15-9` line, because that
 * is the line a reader is looking at.
 *
 * **What repeats.** An AMRAP has no round count, so its cues are emitted once
 * and `loops` says to start again at the end. A display that expanded it would
 * have to invent a number.
 *
 * Nothing here starts a clock or holds a position. This is the script; who is
 * where in it is the runtime's business, and keeping them apart is what lets the
 * same script drive a screen, a watch, and a test.
 */

import type { Unit } from './ast.ts';
import type { Timeline, TimelineItem, Pacing, GroupType } from './timeline.ts';

/** Where a cue sits in the nesting, outermost first. */
export interface RoundContext {
  label: string;
  type: GroupType;
  /** 1-based. */
  round: number;
  /** Total rounds, when there is a number. Absent for an AMRAP or until-failure. */
  of?: number;
}

export interface Cue {
  index: number;
  kind: 'step' | 'rest';
  label: string;
  /** The source line this was written on, for a cursor. */
  line?: number;
  pacing: Pacing;
  /** Known duration. A timed cue ends by itself; everything else waits. */
  seconds?: number;
  movement?: string;
  quantity?: Unit;
  rounds: RoundContext[];
}

export interface Run {
  cues: Cue[];
  /**
   * True when the cue list is one pass through something with no round count —
   * an AMRAP, an until-failure block. Reaching the end means starting again.
   */
  loops: boolean;
  /** The overall clock, when one bounds the workout. */
  window?: number;
  /**
   * The parts that come round again, in order. A workout that is entirely an
   * AMRAP has one covering every cue; a buy-in around one has a cycle covering
   * only the middle, which is the difference `loops` cannot express.
   */
  cycles: Cycle[];
  /** Total seconds, when every cue is clock-bounded. */
  totalSeconds?: number;
  /** What could not be laid out in order, carried from compilation. */
  warnings: string[];
}

/** A stretch of the cue list that repeats until its clock or the athlete stops. */
export interface Cycle {
  label: string;
  window?: number;
  /** Cue indices, `from` inclusive and `to` exclusive. */
  from: number;
  to?: number;
}

export interface RunOptions {
  /**
   * Rounds to emit for a group with no fixed count, so an AMRAP can be shown as
   * a list rather than a loop. Default 0: emit one pass and set `loops`.
   */
  unboundedRounds?: number;
  /** Stop expanding past this many cues. A guard, not a feature. */
  maxCues?: number;
}

/** Groups that run their contents more than once. */
const REPEATS: GroupType[] = ['repeat', 'amrap', 'clock', 'attempts', 'build'];

export function run(t: Timeline, opts: RunOptions = {}): Run {
  const maxCues = opts.maxCues ?? 2000;
  const cues: Cue[] = [];
  const warnings = [...t.warnings];
  let loops = false;
  let window: number | undefined;
  const cycles: Cycle[] = [];
  let truncated = false;

  /**
   * `window` and `loops` describe the *workout*, so only a group that spans the
   * whole of it may set them. A group is on the spine when it and every group
   * above it is an only child: an `AMRAP 20min:` alone is the workout and its
   * clock is the workout's clock, while the same block sitting between a run
   * and a row is one part of three.
   *
   * Hoisting from anywhere reported a buy-in, a 20-minute AMRAP and a buy-out
   * as a seven-cue loop on a 20-minute clock — which is neither the number of
   * cues that repeat nor a clock the run and the row are on.
   */
  const walk = (item: TimelineItem, rounds: RoundContext[], spine: boolean) => {
    if (cues.length >= maxCues) { truncated = true; return; }

    if (item.kind === 'step') {
      cues.push({
        index: cues.length, kind: 'step', label: item.label, line: item.line,
        pacing: item.pacing, seconds: item.seconds,
        movement: item.movement, quantity: item.quantity, rounds,
      });
      return;
    }
    if (item.kind === 'rest') {
      // A rest that only fires between rounds is not a cue after the last one.
      const last = rounds[rounds.length - 1];
      if (!item.afterLast && last?.of !== undefined && last.round === last.of) return;
      cues.push({
        index: cues.length, kind: 'rest', label: item.label, line: item.line,
        pacing: item.pacing, seconds: item.seconds, rounds,
      });
      return;
    }

    if (spine && item.window !== undefined) window ??= item.window;

    const repeats = REPEATS.includes(item.type);
    const bounded = repeats && item.rounds !== undefined && !item.untilFailure;
    // An unordered block still has to be shown in some order; the file's order is
    // the only one there is, and the label says it is not prescribed.
    const passes = bounded ? item.rounds!
      : repeats ? (opts.unboundedRounds || 1)
      : 1;
    if (spine && repeats && !bounded && !opts.unboundedRounds) loops = true;
    // Whether it spans everything or not, an unbounded repeat is worth knowing
    // about: the caller needs to say which part comes round again.
    if (repeats && !bounded && !opts.unboundedRounds) {
      cycles.push({ label: item.label, window: item.window, from: cues.length });
    }
    const startedAt = cues.length;

    for (let r = 1; r <= passes; r++) {
      const inner = repeats
        ? [...rounds, { label: item.label, type: item.type, round: r, of: bounded ? item.rounds : undefined }]
        : rounds;
      const onSpine = spine && item.items.length === 1;
      for (const child of item.items) walk(child, inner, onSpine);
      // An interrupt is a periodic overlay rather than a position in the order;
      // it is emitted after the round's contents so it appears at all, and the
      // warning from compilation already says an ordered list misrepresents it.
      for (const child of item.interrupt?.items ?? []) walk(child, inner, false);
      if (cues.length >= maxCues) { truncated = true; return; }
    }
    const open = cycles[cycles.length - 1];
    if (open && open.from === startedAt && open.to === undefined) open.to = cues.length;
  };

  walk(t.root, [], true);
  if (truncated) warnings.push(`run truncated at ${maxCues} cues`);

  const totalSeconds = cues.every((c) => c.seconds !== undefined) && !loops
    ? cues.reduce((n, c) => n + (c.seconds ?? 0), 0)
    : t.estimatedSeconds;

  return { cues, loops, window, cycles, totalSeconds, warnings };
}

/**
 * How a round context reads on a display: `round 2/5`, or `round 2` where there
 * is no count.
 *
 * Two cases say nothing and are dropped. A block that runs once is not a round.
 * And the single pass emitted for an unbounded block is not "round 1" — an
 * AMRAP has no rounds until you have done some, and the runtime counts those.
 */
export function roundLabel(rounds: RoundContext[]): string {
  return rounds
    .filter((r) => r.of !== 1 && !(r.of === undefined && r.round === 1))
    .map((r) => `round ${r.round}${r.of ? `/${r.of}` : ''}`)
    .join(' · ');
}
