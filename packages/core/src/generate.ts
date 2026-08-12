/**
 * Filling the holes in a template so the result satisfies a set of goals.
 *
 * A template is an ordinary workout file with `?` where a movement would go:
 *
 *     5 rounds:
 *       - 12 ? squat
 *       - 10 ? pull
 *       - 400m ?
 *
 * The structure — rounds, rep schemes, loads, rests — is the author's. Only the
 * movements are chosen. That division is deliberate: deciding how hard a workout
 * should be is a judgement about the athlete, while deciding what not to put
 * next to what is a mechanical question the rules already answer.
 *
 * The search is cheap because the structure is fixed. Compiling the template
 * once yields the exposure list — quantities, rounds, adjacency, all of it — and
 * every candidate differs from every other only in which muscles sit at the hole
 * positions. So a thousand candidates cost one compilation, not a thousand, and
 * `checkExposures` grades each one with the same code that grades a real
 * workout. The generator has no opinions of its own; it searches, and the goals
 * file is the whole of the judgement.
 */

import type { Workout, Node, Step, Block } from './ast.ts';
import type { MovementEntry, Registry } from './fold.ts';
import { fold } from './fold.ts';
import { canonicalRegistry } from './registry.ts';
import { compile } from './timeline.ts';
import { muscles, musclesFor, exposures, type Exposure, type AttributionOptions } from './muscles.ts';
import { checkExposures, type Goals, type Finding } from './goals.ts';

/**
 * A movement to be chosen. `constraint` is whatever followed the `?`, so
 * `? squat` requires a squat and `? lats` requires a movement that works them.
 */
export interface Hole {
  index: number;
  constraint: string[];
  /** The step's own line in the template, for reporting. */
  line?: number;
  candidates: MovementEntry[];
}

export interface GenerateOptions extends AttributionOptions {
  /** Movements to choose from. Defaults to the registry's core set. */
  pool?: MovementEntry[];
  /** Restrict the pool to what these can perform. Matched loosely; the sources spell equipment five ways. */
  equipment?: string[];
  /** Fixed by default, so the same template and goals give the same workout. */
  seed?: number;
  /** Assignments to try before giving up and returning the best so far. */
  budget?: number;
  /** Allow one movement to fill more than one hole. Off by default. */
  repeatMovements?: boolean;
}

export interface GenerateResult {
  /** The template with its holes filled, as far as the search got. */
  workout: Workout;
  holes: Hole[];
  /** What the chosen movements are, by hole. */
  chosen: (MovementEntry | undefined)[];
  /** Empty when every rule is satisfied. Meaningless unless `solved`. */
  findings: Finding[];
  /** True when every hole was filled. False means the template came back with holes in it. */
  solved: boolean;
  /** Holes still open, whatever the reason. */
  unfilled: Hole[];
  /** Holes with no candidate at all — the constraint and the pool disagree. */
  impossible: Hole[];
  /** Assignments tried. */
  searched: number;
  /** True when the search ran out of budget rather than out of possibilities. */
  gaveUp: boolean;
}

/** A movement name marked as a hole. `?`, `? squat`, `? vertical-pull lats`. */
const HOLE = /^\?\s*(.*)$/;

/** Sentinel written into the AST so a hole survives compilation identifiably. */
const sentinel = (i: number) => `?hole-${i}`;
const sentinelIndex = (movement: string) => {
  const m = movement.match(/^\?hole-(\d+)$/);
  return m ? Number(m[1]) : undefined;
};

// --- the pool ------------------------------------------------------------

/** Deep enough to copy an AST without dragging in a dependency. */
const clone = <T>(x: T): T => structuredClone(x);

function walkSteps(nodes: Node[], fn: (s: Step) => void) {
  for (const n of nodes) {
    if (n.node === 'step') fn(n);
    else if ((n as Block).children) walkSteps((n as Block).children, fn);
  }
}

/**
 * Does a movement satisfy one token of a hole's constraint?
 *
 * A token is read as a muscle first, then a region, then a movement pattern —
 * `squat`, `pull`, `carry`. A pattern matches on substring so `pull` catches
 * both the vertical and horizontal kinds, which is what someone writing `? pull`
 * means.
 */
function satisfies(entry: MovementEntry, token: string): boolean {
  const t = token.toLowerCase();
  const known = muscles();
  const primary = entry.muscles?.primary ?? [];
  if (known.has(t)) return primary.includes(t);
  const region = [...known.values()].filter((m) => m.region === t);
  if (region.length) return primary.some((p) => region.some((m) => m.id === p));
  return (entry.pattern ?? []).some((p) => p.toLowerCase().includes(t));
}

/**
 * Can this be done with what is to hand?
 *
 * Undeclared equipment excludes the movement rather than passing it. Absent is
 * not the same as bodyweight, and treating it as bodyweight put a sandbag carry
 * in a workout generated for a dumbbell and a pull-up bar — a filter that
 * silently lies is worse than no filter. Bodyweight is declared explicitly.
 *
 * Matching within a declared list is loose on purpose: the sources spell the
 * same rack five ways — `barbell`, `Barbell`, `bar` — and a strict match empties
 * the pool without saying why.
 */
function usable(entry: MovementEntry, have: Set<string>): boolean {
  const needs = entry.equipment ?? [];
  if (!needs.length) return false;
  return needs.some((e) => {
    const f = fold(e);
    if (/^(none|body|bodyweight)/.test(f)) return true;
    for (const h of have) if (f.includes(h) || h.includes(f)) return true;
    return false;
  });
}

/**
 * Can this movement be measured the way the step measures it?
 *
 * `measures` names the readouts a movement offers beyond reps and duration, so
 * a step in metres needs a movement that reports metres. The reverse matters
 * too and the registry does not state it directly: nobody does ten reps of a
 * run. Locomotion is the signal — those are the movements counted by ground
 * covered, never by repetition.
 */
function measurable(entry: MovementEntry, step: Step): boolean {
  const q = step.quantity;
  if (!q) return true;
  const measures = entry.measures ?? [];
  switch (q.kind) {
    case 'distance': return measures.includes('distance');
    case 'calories': return measures.includes('calories');
    case 'reps': case 'range': case 'floor':
      return !(entry.pattern ?? []).includes('locomotion');
    default: return true;
  }
}

// --- search --------------------------------------------------------------

/** Reproducible ordering, so the same template and goals give the same workout. */
function shuffled<T>(xs: T[], seed: number): T[] {
  let s = seed >>> 0 || 1;
  const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000;
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Findings, weighted by how many times each recurred. */
const weigh = (fs: Finding[]) => fs.reduce((n, f) => n + f.count, 0);

export function generate(template: Workout, goals: Goals, opts: GenerateOptions = {}): GenerateResult {
  const reg: Registry = opts.registry ?? canonicalRegistry();
  const budget = opts.budget ?? 20_000;
  const seed = opts.seed ?? 1;

  // 1. Find the holes and mark them, so they survive compilation identifiably.
  const marked = clone(template);
  const holes: Hole[] = [];
  const stepOf: Step[] = [];
  walkSteps(marked.body, (s) => {
    const m = s.movement?.match(HOLE);
    if (!m) return;
    const i = holes.length;
    holes.push({
      index: i,
      constraint: m[1].split(/[\s,]+/).map((x) => x.trim()).filter(Boolean),
      line: s.line,
      candidates: [],
    });
    stepOf.push(s);
    s.movement = sentinel(i);
  });

  // 2. The pool, narrowed once per hole.
  const base = (opts.pool ?? reg.entries.filter((e) => (e as { core?: boolean }).core))
    .filter((e) => e.muscles?.primary?.length);
  const have = new Set((opts.equipment ?? []).map((e) => fold(e)));
  for (const h of holes) {
    h.candidates = shuffled(base.filter((e) =>
      h.constraint.every((t) => satisfies(e, t))
      && (!have.size || usable(e, have))
      && measurable(e, stepOf[h.index])), seed + h.index);
  }

  // 3. One compilation. Every candidate shares this structure and differs only
  //    in which muscles sit at the hole positions.
  const exp = exposures(compile(marked), opts).list;
  const holeAt = new Map<number, number[]>();   // hole index -> exposure indices
  for (const e of exp) {
    const i = sentinelIndex(e.movement);
    if (i === undefined) continue;
    (holeAt.get(i) ?? holeAt.set(i, []).get(i)!).push(e.index);
  }

  const impossible = holes.filter((h) => !h.candidates.length);
  const attribution = holes.map((h) => h.candidates.map((e) => musclesFor(e.title, { ...opts, registry: reg })));

  const chosen: (number | undefined)[] = holes.map(() => undefined);
  let best: { pick: (number | undefined)[]; findings: Finding[]; score: number } | undefined;
  let searched = 0;
  let gaveUp = false;

  const apply = (hole: number, candidate: number | undefined) => {
    const a = candidate === undefined ? undefined : attribution[hole][candidate];
    for (const i of holeAt.get(hole) ?? []) {
      exp[i].primary = a?.primary ?? [];
      exp[i].secondary = a?.secondary ?? [];
      exp[i].movement = candidate === undefined
        ? sentinel(hole) : holes[hole].candidates[candidate].title;
      exp[i].unattributed = !a;
    }
  };

  /**
   * Score a partial assignment. Findings that name an unfilled hole are ignored:
   * they are not yet true of anything. Findings about what *is* filled are, and
   * they prune — a pair of stacked squats does not become unstacked by filling
   * the rest of the workout.
   */
  const scorePartial = (upTo: number): number => {
    const open = new Set<number>();
    for (let h = upTo; h < holes.length; h++) for (const i of holeAt.get(h) ?? []) open.add(i);
    const fs = checkExposures(exp, goals).findings.filter((f) =>
      f.rule === 'no repeat' && !(f.where ?? []).some((i) => open.has(i)));
    return weigh(fs);
  };

  const recurse = (hole: number, used: Set<string>, prune: boolean): boolean => {
    if (hole === holes.length) {
      searched++;
      const { findings } = checkExposures(exp, goals);
      const score = weigh(findings);
      if (!best || score < best.score) best = { pick: chosen.slice(), findings, score };
      return score === 0;
    }
    const list = holes[hole].candidates;
    if (!list.length) {   // nothing fits; leave it open and carry on
      return recurse(hole + 1, used, prune);
    }
    for (let c = 0; c < list.length; c++) {
      if (searched >= budget) { gaveUp = true; return false; }
      const key = list[c].id;
      if (!opts.repeatMovements && used.has(key)) continue;
      chosen[hole] = c;
      apply(hole, c);
      // Ordering is the one thing a later hole cannot repair, so it is the one
      // thing worth pruning on.
      if (!prune || scorePartial(hole + 1) === 0) {
        used.add(key);
        if (recurse(hole + 1, used, prune)) return true;
        used.delete(key);
      }
      chosen[hole] = undefined;
      apply(hole, undefined);
    }
    return false;
  };

  recurse(0, new Set(), true);
  // Pruning finds a clean answer fast, but it can cut away every branch — one
  // pull that clashes with every squat leaves nothing at all. Rather than hand
  // back an unfilled template and call it a success, search again without the
  // prune and return the least-bad complete assignment.
  if (!best && holes.some((h) => h.candidates.length)) {
    for (let h = 0; h < holes.length; h++) { chosen[h] = undefined; apply(h, undefined); }
    gaveUp = false;
    recurse(0, new Set(), false);
  }

  // 4. Write the winner back into the workout.
  const out = clone(template);
  const pick = best?.pick ?? holes.map(() => undefined);
  let n = 0;
  walkSteps(out.body, (s) => {
    if (!s.movement?.match(HOLE)) return;
    const h = n++;
    const c = pick[h];
    if (c !== undefined) s.movement = holes[h].candidates[c].title;
  });

  // With holes left open, the rules were judged against a workout that is not
  // the one asked for, so the findings say nothing. Report the holes instead.
  const unfilled = holes.filter((h) => pick[h.index] === undefined);
  for (let h = 0; h < holes.length; h++) apply(h, pick[h]);

  return {
    workout: out,
    holes,
    chosen: pick.map((c, h) => (c === undefined ? undefined : holes[h].candidates[c])),
    findings: unfilled.length ? [] : best?.findings ?? [],
    solved: !unfilled.length,
    unfilled,
    impossible,
    searched,
    gaveUp,
  };
}
