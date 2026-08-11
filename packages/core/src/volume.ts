/**
 * Total work in a compiled workout.
 *
 * This exists to be checked against the outside world. Round-tripping proves
 * the parser and formatter agree with each other, and validation proves no rule
 * of mine fires — neither says the interpretation is *right*. But how many
 * thrusters are in Fran is a fact that exists independently of this codebase,
 * so totals derived here can be compared against it.
 *
 * A misread rep scheme, an off-by-one in a ladder, a `reversed` step taking the
 * wrong tier, or a repeat count applied at the wrong level all change a total.
 */

import type { Timeline, TimelineItem, TimelineStep } from './timeline.ts';

export interface MovementVolume {
  reps: number;
  distanceM: number;
  calories: number;
  seconds: number;
}

export interface Volume {
  /** Per movement, keyed by the name as written. */
  byMovement: Record<string, MovementVolume>;
  totals: MovementVolume;
  /** True when some part has no fixed amount — AMRAP, until-failure, max effort. */
  unbounded: boolean;
}

const TO_METRES: Record<string, number> = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048, yd: 0.9144 };

const zero = (): MovementVolume => ({ reps: 0, distanceM: 0, calories: 0, seconds: 0 });

function addInto(target: MovementVolume, src: MovementVolume, times: number) {
  target.reps += src.reps * times;
  target.distanceM += src.distanceM * times;
  target.calories += src.calories * times;
  target.seconds += src.seconds * times;
}

/**
 * Optional filter, so a caller can ask a narrower question — "only work at or
 * above 50% of a 1RM", which is how powerlifting counts its number of lifts.
 * Without one, everything counts.
 */
export type StepFilter = (step: TimelineStep) => boolean;

/** True when a step carries a percentage load at or above `min`. */
export function atOrAbove(min: number): StepFilter {
  return (s) => s.targets.some((t) =>
    t.kind === 'load' && t.load.kind === 'percent' && t.load.value >= min);
}

export function volume(t: Timeline, keep?: StepFilter): Volume {
  const byMovement: Record<string, MovementVolume> = {};
  const totals = zero();
  let unbounded = false;

  const walk = (item: TimelineItem, times: number) => {
    if (item.kind === 'rest') return;

    if (item.kind === 'step') {
      if (keep && !keep(item)) return;
      const q = item.quantity;
      const v = zero();
      switch (q.kind) {
        case 'reps': v.reps = q.value; break;
        case 'range': v.reps = q.min; unbounded = true; break;   // a range has no single total
        case 'calories': v.calories = q.value; break;
        case 'duration': v.seconds = q.seconds; break;
        case 'distance': v.distanceM = q.value * (TO_METRES[q.unit] ?? 1); break;
        case 'floor': v.reps = q.value; unbounded = true; break;
        case 'max': case 'maxEffort': case 'open': case 'threshold': unbounded = true; break;
      }
      if (item.perRound) unbounded = true;   // ascending inside an unbounded repeat
      const key = item.movement || '(unnamed)';
      byMovement[key] ??= zero();
      addInto(byMovement[key], v, times);
      addInto(totals, v, times);
      return;
    }

    // group
    let factor = times;
    switch (item.type) {
      case 'repeat':
      case 'attempts':
        if (item.rounds === undefined) { unbounded = true; return; }
        factor = times * item.rounds;
        break;
      case 'amrap':
      case 'build':
        unbounded = true;
        return;                       // contents repeat an unknown number of times
      case 'clock':
        if (item.untilFailure || item.rounds === undefined) { unbounded = true; return; }
        factor = times * item.rounds;
        break;
      case 'team':
        // Shared totals are the work the team does, not per athlete.
        break;
    }
    for (const c of item.items) walk(c, factor);
    for (const c of item.interrupt?.items ?? []) unbounded = true, walk(c, factor);
  };

  walk(t.root, 1);
  return { byMovement, totals, unbounded };
}

/** Convenience for assertions: reps of one movement, by name as written. */
export function repsOf(v: Volume, movement: string): number {
  return v.byMovement[movement]?.reps ?? 0;
}
