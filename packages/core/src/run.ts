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
  /** Total seconds, when every cue is clock-bounded. */
  totalSeconds?: number;
  /** What could not be laid out in order, carried from compilation. */
  warnings: string[];
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
  let truncated = false;

  const walk = (item: TimelineItem, rounds: RoundContext[]) => {
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

    if (item.window !== undefined) window ??= item.window;

    const repeats = REPEATS.includes(item.type);
    const bounded = repeats && item.rounds !== undefined && !item.untilFailure;
    // An unordered block still has to be shown in some order; the file's order is
    // the only one there is, and the label says it is not prescribed.
    const passes = bounded ? item.rounds!
      : repeats ? (opts.unboundedRounds || 1)
      : 1;
    if (repeats && !bounded && !opts.unboundedRounds) loops = true;

    for (let r = 1; r <= passes; r++) {
      const inner = repeats
        ? [...rounds, { label: item.label, type: item.type, round: r, of: bounded ? item.rounds : undefined }]
        : rounds;
      for (const child of item.items) walk(child, inner);
      // An interrupt is a periodic overlay rather than a position in the order;
      // it is emitted after the round's contents so it appears at all, and the
      // warning from compilation already says an ordered list misrepresents it.
      for (const child of item.interrupt?.items ?? []) walk(child, inner);
      if (cues.length >= maxCues) { truncated = true; return; }
    }
  };

  walk(t.root, []);
  if (truncated) warnings.push(`run truncated at ${maxCues} cues`);

  const totalSeconds = cues.every((c) => c.seconds !== undefined) && !loops
    ? cues.reduce((n, c) => n + (c.seconds ?? 0), 0)
    : t.estimatedSeconds;

  return { cues, loops, window, totalSeconds, warnings };
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
