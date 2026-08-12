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
import { checkSeriesExposures, type Goals, type Finding } from './goals.ts';

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

/** Where a chosen movement lands: one session, one exposure in it. */
interface Site {
  session: number;
  exposure: number;
}

/** A hole, plus every place its choice is written. */
interface Group extends Hole {
  key: string;
  sites: Site[];
}

/** One workout to be filled, and what it is an instance of. */
export interface GenerateSession {
  name: string;
  workout: Workout;
  /**
   * Holes in the same slot and the same position share a choice across cycles.
   * Generating week 1 and week 2 of the pull session independently gives them
   * different movements, which makes `progress` on the lats an accident rather
   * than a plan.
   */
  slot?: string;
}

export interface GenerateProgramResult {
  sessions: { name: string; slot?: string; workout: Workout }[];
  groups: Hole[];
  /** What was chosen for each group, by group index. */
  chosen: (MovementEntry | undefined)[];
  /** Session-level findings, per workout. Empty unless `solved`. */
  perWorkout: { name: string; findings: Finding[] }[];
  /** Findings about the block: `progress`, and anything scoped `per: block`. */
  findings: Finding[];
  solved: boolean;
  unfilled: Hole[];
  impossible: Hole[];
  searched: number;
  gaveUp: boolean;
}

/**
 * Fill the holes across a whole block at once.
 *
 * Holes are grouped before the search, not after: every `? pull` sitting first
 * in the pull slot is one decision, however many weeks the block runs. That is
 * what makes a `progress` rule satisfiable — the volume can ramp because the
 * movement stayed put.
 */
export function generateProgram(
  sessions: GenerateSession[], goals: Goals, opts: GenerateOptions = {},
): GenerateProgramResult {
  const reg: Registry = opts.registry ?? canonicalRegistry();
  const budget = opts.budget ?? 20_000;
  const seed = opts.seed ?? 1;

  // 1. Mark the holes. A group key is the slot and the position within it, so
  //    the same hole in week 1 and week 5 is one decision.
  const marked = sessions.map((s) => clone(s.workout));
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();
  const steps = new Map<string, Step[]>();
  marked.forEach((w, si) => {
    let ordinal = 0;
    walkSteps(w.body, (step) => {
      const m = step.movement?.match(HOLE);
      if (!m) return;
      const key = `${sessions[si].slot ?? `#${si}`}/${ordinal++}`;
      let g = byKey.get(key);
      if (!g) {
        g = {
          index: groups.length, key, sites: [], candidates: [],
          constraint: [], line: step.line,
        };
        groups.push(g);
        byKey.set(key, g);
        steps.set(key, []);
      }
      // Constraints union across cycles: a token written in any week applies.
      for (const t of m[1].split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)) {
        if (!g.constraint.includes(t)) g.constraint.push(t);
      }
      steps.get(key)!.push(step);
      step.movement = sentinel(g.index);
    });
  });

  // 2. The pool, narrowed once per group. Every site's measurement has to work,
  //    not just the first — week 1 may count reps where week 4 counts metres.
  const base = (opts.pool ?? reg.entries.filter((e) => (e as { core?: boolean }).core))
    .filter((e) => e.muscles?.primary?.length);
  const have = new Set((opts.equipment ?? []).map((e) => fold(e)));
  for (const g of groups) {
    g.candidates = shuffled(base.filter((e) =>
      g.constraint.every((t) => satisfies(e, t))
      && (!have.size || usable(e, have))
      && steps.get(g.key)!.every((st) => measurable(e, st))), seed + g.index);
  }

  // 3. One compilation per session.
  const exps = marked.map((w) => exposures(compile(w), opts).list);
  exps.forEach((exp, si) => {
    for (const e of exp) {
      const i = sentinelIndex(e.movement);
      if (i !== undefined) groups[i].sites.push({ session: si, exposure: e.index });
    }
  });

  const impossible = groups.filter((g) => !g.candidates.length);
  const attribution = groups.map((g) => g.candidates.map((e) => musclesFor(e.title, { ...opts, registry: reg })));
  const series = () => sessions.map((s, i) => ({ name: s.name, slot: s.slot, exp: exps[i] }));

  const chosen: (number | undefined)[] = groups.map(() => undefined);
  let best: {
    pick: (number | undefined)[];
    perWorkout: { name: string; findings: Finding[] }[];
    findings: Finding[];
    score: number;
  } | undefined;
  let searched = 0;
  let gaveUp = false;

  const apply = (gi: number, candidate: number | undefined) => {
    const a = candidate === undefined ? undefined : attribution[gi][candidate];
    for (const site of groups[gi].sites) {
      const e = exps[site.session][site.exposure];
      e.primary = a?.primary ?? [];
      e.secondary = a?.secondary ?? [];
      e.movement = candidate === undefined ? sentinel(gi) : groups[gi].candidates[candidate].title;
      e.unattributed = !a;
    }
  };

  const score = () => {
    const r = checkSeriesExposures(series(), goals);
    return {
      perWorkout: r.perWorkout.map((w) => ({ name: w.name, findings: w.report.findings })),
      findings: r.findings,
      total: r.perWorkout.reduce((n, w) => n + weigh(w.report.findings), 0) + weigh(r.findings),
    };
  };

  /**
   * Prune on ordering only, and only where both ends are already filled: a pair
   * of stacked squats does not become unstacked by filling the rest of the
   * block, but a rule about volume can still be satisfied by what comes next.
   */
  const scorePartial = (upTo: number): number => {
    const open = new Set<string>();
    for (let g = upTo; g < groups.length; g++) {
      for (const site of groups[g].sites) open.add(`${site.session}:${site.exposure}`);
    }
    let n = 0;
    checkSeriesExposures(series(), goals).perWorkout.forEach((w, si) => {
      for (const f of w.report.findings) {
        if (f.rule !== 'no repeat') continue;
        if ((f.where ?? []).some((i) => open.has(`${si}:${i}`))) continue;
        n += f.count;
      }
    });
    return n;
  };

  const recurse = (gi: number, used: Set<string>, prune: boolean): boolean => {
    if (gi === groups.length) {
      searched++;
      const s = score();
      if (!best || s.total < best.score) {
        best = { pick: chosen.slice(), perWorkout: s.perWorkout, findings: s.findings, score: s.total };
      }
      return s.total === 0;
    }
    const list = groups[gi].candidates;
    if (!list.length) return recurse(gi + 1, used, prune);
    for (let c = 0; c < list.length; c++) {
      if (searched >= budget) { gaveUp = true; return false; }
      const key = list[c].id;
      if (!opts.repeatMovements && used.has(key)) continue;
      chosen[gi] = c;
      apply(gi, c);
      if (!prune || scorePartial(gi + 1) === 0) {
        used.add(key);
        if (recurse(gi + 1, used, prune)) return true;
        used.delete(key);
      }
      chosen[gi] = undefined;
      apply(gi, undefined);
    }
    return false;
  };

  recurse(0, new Set(), true);
  // Pruning finds a clean answer fast, but it can cut away every branch — one
  // pull that clashes with every squat leaves nothing at all. Rather than hand
  // back an unfilled template and call it a success, search again without the
  // prune and return the least-bad complete assignment.
  if (!best && groups.some((g) => g.candidates.length)) {
    for (let g = 0; g < groups.length; g++) { chosen[g] = undefined; apply(g, undefined); }
    gaveUp = false;
    recurse(0, new Set(), false);
  }

  // 4. Write the winner back into each session.
  const pick = best?.pick ?? groups.map(() => undefined);
  const out = sessions.map((s, si) => {
    const w = clone(s.workout);
    let ordinal = 0;
    walkSteps(w.body, (step) => {
      if (!step.movement?.match(HOLE)) return;
      const g = byKey.get(`${s.slot ?? `#${si}`}/${ordinal++}`)!;
      const c = pick[g.index];
      if (c !== undefined) step.movement = g.candidates[c].title;
    });
    return { name: s.name, slot: s.slot, workout: w };
  });

  // With holes left open, the rules were judged against something other than
  // what was asked for, so the findings say nothing. Report the holes instead.
  const unfilled = groups.filter((g) => pick[g.index] === undefined);
  for (let g = 0; g < groups.length; g++) apply(g, pick[g]);
  const plain = groups.map(({ index, constraint, line, candidates }) => ({ index, constraint, line, candidates }));

  return {
    sessions: out,
    groups: plain,
    chosen: pick.map((c, g) => (c === undefined ? undefined : groups[g].candidates[c])),
    perWorkout: unfilled.length ? [] : best?.perWorkout ?? [],
    findings: unfilled.length ? [] : best?.findings ?? [],
    solved: !unfilled.length,
    unfilled: unfilled.map((g) => plain[g.index]),
    impossible: impossible.map((g) => plain[g.index]),
    searched,
    gaveUp,
  };
}

/**
 * One workout. The block case with a single session in it, which is why the two
 * cannot drift apart.
 */
export function generate(template: Workout, goals: Goals, opts: GenerateOptions = {}): GenerateResult {
  const r = generateProgram([{ name: template.title ?? 'workout', workout: template }], goals, opts);
  return {
    workout: r.sessions[0].workout,
    holes: r.groups,
    chosen: r.chosen,
    findings: [...(r.perWorkout[0]?.findings ?? []), ...r.findings],
    solved: r.solved,
    unfilled: r.unfilled,
    impossible: r.impossible,
    searched: r.searched,
    gaveUp: r.gaveUp,
  };
}
