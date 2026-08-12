/**
 * What a workout works, and in what order.
 *
 * This is the layer the goal rules stand on. "Don't hit the same muscle twice
 * in a row" and "ramp the pulling volume week over week" are both questions
 * about muscles, and neither the AST nor the timeline knows anything about
 * muscles — they know movement names. Here is where a name becomes a set of
 * muscles, and where a timeline becomes something a constraint can be checked
 * against.
 *
 * Two honest limits, stated here because every number below inherits them:
 *
 * 1. Attribution is editorial, not measured. It comes from exercise catalogues
 *    that assigned muscles by inspection. `support` says how many independently
 *    agreed, which is the closest thing to a confidence figure available, and
 *    `minSupport` lets a caller demand more than one opinion.
 *
 * 2. Volume is not comparable across movements. A rep of a deadlift and a rep
 *    of a sit-up both count as one, so per-muscle totals are useful for trend
 *    and balance within a similar workout and misleading between dissimilar
 *    ones. Nothing here converts reps to load; that would need a 1RM and a
 *    physiological model, and inventing one would make the numbers look more
 *    authoritative than they are.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Unit } from './ast.ts';
import type { Timeline, TimelineItem, TimelineStep } from './timeline.ts';
import type { Registry } from './fold.ts';
import { canonicalRegistry } from './registry.ts';
import { stepVolume, type MovementVolume } from './volume.ts';

const here = dirname(fileURLToPath(import.meta.url));

export interface Muscle {
  id: string;
  name: string;
  region: 'upper' | 'core' | 'lower';
}

let vocab: Map<string, Muscle> | undefined;

/** The closed muscle set, in the order registry/muscles.json declares it. */
export function muscles(): Map<string, Muscle> {
  if (!vocab) {
    const path = join(here, '../../../registry/muscles.json');
    const data = JSON.parse(readFileSync(path, 'utf8')) as { muscles: Muscle[] };
    vocab = new Map(data.muscles.map((m) => [m.id, { id: m.id, name: m.name, region: m.region }]));
  }
  return vocab;
}

export interface Attribution {
  /** Muscles the movement is for. */
  primary: string[];
  /** Muscles it also demands. */
  secondary: string[];
}

export interface AttributionOptions {
  registry?: Registry;
  /**
   * Discard muscles fewer than this many sources named. The default of 1 keeps
   * everything; 2 keeps only what two catalogues independently agreed on, which
   * cuts the long tail of single-source claims — a movement listed as working
   * nine muscles usually has one source to thank for six of them.
   *
   * Clamped to the number of sources that said anything about the movement, so
   * asking for corroboration does not delete the movements with none to give.
   * Most of the CrossFit and strongman vocabulary appears in one catalogue only.
   */
  minSupport?: number;
}

/** The muscles a movement works, or undefined when the name resolves to nothing. */
export function musclesFor(movement: string, opts: AttributionOptions = {}): Attribution | undefined {
  const reg = opts.registry ?? canonicalRegistry();
  const res = reg.resolve(movement);
  if (res.status !== 'ok') return undefined;
  const m = res.entry.muscles;
  if (!m) return undefined;

  const min = Math.min(opts.minSupport ?? 1, m.sources ?? 1);
  const known = muscles();
  const keep = (xs: string[] | undefined) => (xs ?? []).filter((id) => {
    if (!known.has(id)) return false;
    if (min <= 1) return true;
    // No support record means the claim predates the counting, not that it has
    // none — treat it as a single source rather than discarding it silently.
    const s = m.support?.[id];
    return (s ? s[0] + s[1] : 1) >= min;
  });

  const primary = keep(m.primary);
  const secondary = keep(m.secondary);
  if (!primary.length && !secondary.length) return undefined;
  return { primary, secondary };
}

/**
 * One step's worth of muscle work, in the order the workout is written.
 *
 * `path` is the chain of group indices that reach the step, so two exposures
 * sharing a prefix are in the same block. `cycle` names the innermost enclosing
 * group that repeats: within it, the last exposure runs immediately before the
 * first again, which is an adjacency a straight reading of the list misses.
 */
export interface Exposure {
  index: number;
  movement: string;
  quantity: Unit;
  primary: string[];
  secondary: string[];
  path: number[];
  cycle?: { path: number[]; rounds?: number };
  /** True when the step resolved to no muscle data at all. */
  unattributed: boolean;
}

export interface Exposures {
  list: Exposure[];
  /** Movement names that resolved to nothing, once each. Every total below is short by these. */
  unresolved: string[];
}

/** Groups whose contents run more than once, so their end abuts their start. */
const REPEATING = new Set(['repeat', 'amrap', 'clock', 'attempts', 'build']);

export function exposures(t: Timeline, opts: AttributionOptions = {}): Exposures {
  const list: Exposure[] = [];
  const unresolved = new Set<string>();

  const walk = (item: TimelineItem, path: number[], cycle: Exposure['cycle']) => {
    if (item.kind === 'rest') return;
    if (item.kind === 'step') {
      const a = musclesFor(item.movement, opts);
      if (!a && item.movement) unresolved.add(item.movement);
      list.push({
        index: list.length,
        movement: item.movement,
        quantity: item.quantity,
        primary: a?.primary ?? [],
        secondary: a?.secondary ?? [],
        path,
        cycle,
        unattributed: !a,
      });
      return;
    }
    // A tally block has no prescribed order, so nothing inside it is "before"
    // anything else and adjacency questions do not apply. It still contributes
    // volume; it just cannot be sequenced.
    const inner = REPEATING.has(item.type) && !item.freeOrder
      ? { path, rounds: item.rounds }
      : item.freeOrder ? undefined : cycle;
    item.items.forEach((c, i) => walk(c, [...path, i], inner));
    (item.interrupt?.items ?? []).forEach((c, i) => walk(c, [...path, -1 - i], inner));
  };

  walk(t.root, [], undefined);
  return { list, unresolved: [...unresolved] };
}

/**
 * Consecutive pairs, including the wrap from a repeating group's last exposure
 * back to its first. Without the wrap, "no muscle twice in a row" passes a
 * round that ends and begins on the same movement, which is the case it exists
 * to catch.
 */
export function adjacent(list: Exposure[]): [Exposure, Exposure][] {
  const pairs: [Exposure, Exposure][] = [];
  for (let i = 1; i < list.length; i++) pairs.push([list[i - 1], list[i]]);

  const inside = (e: Exposure, p: number[]) =>
    e.cycle !== undefined && p.length <= e.cycle.path.length
      && p.every((v, i) => v === e.cycle!.path[i]);

  const seen = new Set<string>();
  for (const e of list) {
    if (!e.cycle) continue;
    const key = e.cycle.path.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const members = list.filter((x) => inside(x, e.cycle!.path));
    if (members.length > 1 && e.cycle.rounds !== 1) {
      pairs.push([members[members.length - 1], members[0]]);
    }
  }
  return pairs;
}

export interface MuscleLoad {
  muscle: string;
  region: Muscle['region'];
  /** Work from steps where this muscle is a primary mover. */
  primary: MovementVolume;
  /** Work from steps where it assists. */
  secondary: MovementVolume;
  /** How many steps involved it at either level. */
  exposures: number;
}

export interface MuscleLoadReport {
  byMuscle: Record<string, MuscleLoad>;
  byRegion: Record<string, MovementVolume>;
  /** True when some part of the workout has no fixed amount, so totals are floors. */
  unbounded: boolean;
  unresolved: string[];
}

const zero = (): MovementVolume => ({ reps: 0, distanceM: 0, calories: 0, seconds: 0 });
const addInto = (a: MovementVolume, b: MovementVolume, times = 1) => {
  a.reps += b.reps * times;
  a.distanceM += b.distanceM * times;
  a.calories += b.calories * times;
  a.seconds += b.seconds * times;
};

/**
 * Work attributed to each muscle, with rounds counted.
 *
 * Primary and secondary are reported apart rather than combined behind a
 * weighting, because any weight would be a guess. A caller that wants one
 * number can pick its own.
 */
export function muscleLoad(t: Timeline, opts: AttributionOptions = {}): MuscleLoadReport {
  const known = muscles();
  const byMuscle: Record<string, MuscleLoad> = {};
  const byRegion: Record<string, MovementVolume> = {};
  const unresolved = new Set<string>();
  let unbounded = false;

  const slot = (id: string): MuscleLoad => (byMuscle[id] ??= {
    muscle: id, region: known.get(id)!.region, primary: zero(), secondary: zero(), exposures: 0,
  });

  const step = (s: TimelineStep, times: number) => {
    const a = musclesFor(s.movement, opts);
    if (!a) { if (s.movement) unresolved.add(s.movement); return; }
    const { volume: v, open } = stepVolume(s);
    if (open) unbounded = true;
    for (const [ids, level] of [[a.primary, 'primary'], [a.secondary, 'secondary']] as const) {
      for (const id of ids) {
        const m = slot(id);
        addInto(m[level], v, times);
        m.exposures += times;
        addInto(byRegion[known.get(id)!.region] ??= zero(), v, times);
      }
    }
  };

  const walk = (item: TimelineItem, times: number) => {
    if (item.kind === 'rest') return;
    if (item.kind === 'step') return step(item, times);

    let factor = times;
    switch (item.type) {
      case 'repeat':
      case 'attempts':
      case 'clock':
        // An unbounded repeat still exposes its muscles; it just cannot say how
        // many times. Counting the contents once keeps the balance question
        // answerable and makes the total a floor, which `unbounded` announces.
        if (item.rounds === undefined || (item.type === 'clock' && item.untilFailure)) unbounded = true;
        else factor = times * item.rounds;
        break;
      case 'amrap':
      case 'build':
        unbounded = true;
        break;
    }
    for (const c of item.items) walk(c, factor);
    for (const c of item.interrupt?.items ?? []) walk(c, factor);
  };

  walk(t.root, 1);
  return { byMuscle, byRegion, unbounded, unresolved: [...unresolved] };
}
