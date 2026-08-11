/**
 * Garmin Connect workout JSON export.
 *
 * Connect's workout system runs on a JSON API, not FIT. FIT is the *device*
 * format — it reaches a watch only by USB copy into `GARMIN/NewFiles`. JSON is
 * the *service* format: posted to an account, it syncs to the watch wirelessly,
 * which is what anyone actually wants.
 *
 * Two things make this a better target than FIT for strength work in
 * particular. Connect has a real rep-based end condition, and it carries an
 * external load — the field FIT has no room for, so a barbell weight survives
 * here where it is lost there.
 *
 * Schema taken from the payloads in `cyberjunky/python-garminconnect`, which
 * are known to be accepted by the live API.
 */

import type { Timeline, TimelineItem, TimelineGroup, TimelineStep } from '../timeline.ts';
import type { ExportResult } from './zwo.ts';
import { resolveGarminExercise } from './garmin-exercises.ts';

// --- Connect's own enum values, from /workout-service/workout/types ---------

const StepType = { WARMUP: 1, COOLDOWN: 2, INTERVAL: 3, RECOVERY: 4, REST: 5, REPEAT: 6 } as const;
const ConditionType = { LAP_BUTTON: 1, TIME: 2, DISTANCE: 3, CALORIES: 4, ITERATIONS: 7, REPS: 10 } as const;
const TargetType = { NO_TARGET: 1, POWER_ZONE: 2, CADENCE: 3, HEART_RATE_ZONE: 4, PACE_ZONE: 6 } as const;
const SportType = {
  running: 1, cycling: 2, other: 3, swimming: 4,
  strength_training: 5, cardio_training: 6,
} as const;

/** Connect stores weight in kilograms under this unit tag. */
const WEIGHT_UNIT_KILOGRAM = { unitId: 8, unitKey: 'kilogram', factor: 1000.0 };

const stepType = (id: number, key: string, displayOrder: number) =>
  ({ stepTypeId: id, stepTypeKey: key, displayOrder });
const endCondition = (id: number, key: string, displayOrder: number, displayable = true) =>
  ({ conditionTypeId: id, conditionTypeKey: key, displayOrder, displayable });
const noTarget = { workoutTargetTypeId: TargetType.NO_TARGET, workoutTargetTypeKey: 'no.target', displayOrder: 1 };

const LB_TO_KG = 0.45359237;
const POOD_TO_KG = 16.3805;

export interface ConnectExportOptions {
  name?: string;
  /** Overrides the sport Connect files the workout under. */
  sport?: keyof typeof SportType;
  description?: string;
  /**
   * Emit power targets. On by default: verified by import, where Connect
   * showed "230-245 W Intensity Target" on the work intervals. Set false to
   * fall back to an untargeted workout.
   */
  powerTargets?: boolean;
  /** Resolves `% FTP` targets into the watts Connect stores. */
  ftp?: number;
}

/** Guess the sport, since Connect files workouts by it and a wrong guess hides them. */
function sportOf(steps: TimelineStep[]): keyof typeof SportType {
  const j = steps.map((s) => s.movement).join(' ').toLowerCase();
  if (/\bbike\b|cycl/.test(j)) return 'cycling';
  if (/\bswim\b/.test(j)) return 'swimming';
  if (/\brun\b|sprint|jog/.test(j)) return 'running';
  const lifting = steps.filter((s) => s.targets.some(
    (t) => t.kind === 'load' && t.load.kind === 'absolute')).length;
  return lifting > 0 ? 'strength_training' : 'cardio_training';
}

/** Absolute watts for a step, resolving `% FTP` when an FTP is supplied. */
function powerWatts(s: TimelineStep, ftp?: number): number | undefined {
  for (const t of s.targets) {
    if (t.kind === 'power') {
      const w = t.text.match(/^(\d+(?:\.\d+)?)W$/i);
      if (w) return Number(w[1]);
      const p = t.text.match(/^(\d+(?:\.\d+)?)%\s*FTP$/i);
      if (p && ftp) return (Number(p[1]) / 100) * ftp;
    }
    if (t.kind === 'load' && t.load.kind === 'percent' && /^FTP$/i.test(t.load.of ?? '') && ftp) {
      return (t.load.value / 100) * ftp;
    }
  }
  // A ramp keeps its bounds in a note, and Connect holds one target per step,
  // so the best available answer is where the ramp starts.
  for (const n of s.notes) {
    const m = n.match(/ramp\s+(\d+(?:\.\d+)?)%\s*->/i);
    if (m && ftp) return (Number(m[1]) / 100) * ftp;
    const w = n.match(/ramp\s+(\d+(?:\.\d+)?)W\s*->/i);
    if (w) return Number(w[1]);
  }
  return undefined;
}

function weightKg(s: TimelineStep): number | undefined {
  for (const t of s.targets) {
    if (t.kind !== 'load' || t.load.kind !== 'absolute') continue;
    const { value, unit, implements: n } = t.load;
    const each = unit === 'kg' ? value : unit === 'pood' ? value * POOD_TO_KG : value * LB_TO_KG;
    return each * (n ?? 1);                          // paired implements are the total moved
  }
  return undefined;
}


export function exportGarminConnect(t: Timeline, opts: ConnectExportOptions = {}): ExportResult {
  const warnings: string[] = [...t.warnings];
  let order = 0;
  const next = () => ++order;

  const collect = (i: TimelineItem, out: TimelineStep[] = []): TimelineStep[] => {
    if (i.kind === 'step') out.push(i);
    else if (i.kind === 'group') i.items.forEach((c) => collect(c, out));
    return out;
  };
  const allSteps = collect(t.root);
  const sport = opts.sport ?? sportOf(allSteps);
  const sportType = { sportTypeId: SportType[sport], sportTypeKey: sport, displayOrder: SportType[sport] };

  const executable = (s: TimelineStep): Record<string, unknown> => {
    const role = s.notes.join(' ').toLowerCase();
    const type = role.includes('warmup') ? stepType(StepType.WARMUP, 'warmup', 1)
      : role.includes('cooldown') ? stepType(StepType.COOLDOWN, 'cooldown', 2)
      : stepType(StepType.INTERVAL, 'interval', 3);

    let condition = endCondition(ConditionType.LAP_BUTTON, 'lap.button', 1);
    let value: number | null = null;
    const q = s.quantity;
    if (q.kind === 'duration') { condition = endCondition(ConditionType.TIME, 'time', 2); value = q.seconds; }
    else if (q.kind === 'distance') {
      condition = endCondition(ConditionType.DISTANCE, 'distance', 3);
      value = q.value * ({ m: 1, km: 1000, mi: 1609.344, ft: 0.3048, yd: 0.9144 }[q.unit] ?? 1);
    } else if (q.kind === 'calories') { condition = endCondition(ConditionType.CALORIES, 'calories', 4); value = q.value; }
    else if (q.kind === 'reps' || q.kind === 'floor') { condition = endCondition(ConditionType.REPS, 'reps', 10); value = q.value; }
    else if (q.kind === 'range') {
      condition = endCondition(ConditionType.REPS, 'reps', 10); value = q.min;
      warnings.push(`"${s.movement}": a rep range exports as its lower bound — Connect stores a single rep count`);
    }

    const step: Record<string, unknown> = {
      type: 'ExecutableStepDTO',
      stepOrder: next(),
      stepType: type,
      endCondition: condition,
      endConditionValue: value,
      targetType: noTarget,
      description: s.label,
    };

    if (opts.powerTargets !== false) {
      const watts = powerWatts(s, opts.ftp);
      if (watts !== undefined) {
        step.targetType = { workoutTargetTypeId: TargetType.POWER_ZONE, workoutTargetTypeKey: 'power.zone', displayOrder: 2 };
        step.targetValueOne = Math.round(watts * 0.97);
        step.targetValueTwo = Math.round(watts * 1.03);
        step.zoneNumber = null;
      }
    }

    if (sport === 'strength_training' && (q.kind === 'reps' || q.kind === 'floor' || q.kind === 'range')) {
      // Connect refuses a category outside its own 47 with "Invalid category",
      // so an unresolved movement ships without the strength fields rather
      // than with a guess that fails the whole import.
      const ex = resolveGarminExercise(s.movement);
      if (ex) {
        step.category = ex.category;
        step.exerciseName = ex.exercise;
      } else {
        warnings.push(`"${s.movement}" is not in Connect's exercise catalogue — exported as a plain rep step`);
      }
      const kg = weightKg(s);
      if (kg !== undefined) {
        // Kilograms, not grams. Sending 70307 for a 155lb bar made Connect
        // display "155,000.4 lbs" — it read the number as kg — which settles a
        // reference implementation whose comment says grams.
        step.weightValue = Math.round(kg * 1000) / 1000;
        step.weightUnit = { ...WEIGHT_UNIT_KILOGRAM };
      }
    } else if (weightKg(s) !== undefined) {
      warnings.push(`"${s.movement}": load dropped — Connect carries weight only on strength workouts`);
    }
    return step;
  };

  const repeatGroup = (iterations: number, children: unknown[]): Record<string, unknown> => ({
    type: 'RepeatGroupDTO',
    stepOrder: next(),
    stepType: stepType(StepType.REPEAT, 'repeat', 6),
    numberOfIterations: iterations,
    smartRepeat: false,
    endCondition: endCondition(ConditionType.ITERATIONS, 'iterations', 7, false),
    endConditionValue: iterations,
    workoutSteps: children,
  });

  const build = (item: TimelineItem): unknown[] => {
    if (item.kind === 'step') return [executable(item)];
    if (item.kind === 'rest') {
      return [{
        type: 'ExecutableStepDTO',
        stepOrder: next(),
        stepType: stepType(StepType.REST, 'rest', 5),
        endCondition: item.seconds !== undefined
          ? endCondition(ConditionType.TIME, 'time', 2)
          : endCondition(ConditionType.LAP_BUTTON, 'lap.button', 1),
        endConditionValue: item.seconds ?? null,
        targetType: noTarget,
        description: item.label,
      }];
    }

    const g = item as TimelineGroup;
    if (g.interrupt) warnings.push('interrupt overlay dropped — Connect has no periodic interruption');
    if (g.freeOrder) warnings.push('tally block exported in document order — the workout prescribes none');

    if (g.type === 'repeat' || g.type === 'attempts') {
      if (g.rounds === undefined) { warnings.push('repeat with no round count skipped'); return []; }
      // The group takes an order number before its children, matching Connect.
      const at = next();
      const children = g.items.flatMap(build);
      const group = repeatGroup(g.rounds, children);
      group.stepOrder = at;
      order--;                                        // repeatGroup() consumed one
      return [group];
    }
    if (g.type === 'clock') {
      if (g.untilFailure || g.rounds === undefined) {
        warnings.push('unbounded repeat skipped — the round count is not known until execution');
        return [];
      }
      const at = next();
      const children = g.items.flatMap(build);
      const group = repeatGroup(g.rounds, children);
      group.stepOrder = at;
      order--;
      warnings.push('a clock-driven block exports as a plain repeat — Connect has no fixed-cadence step');
      return [group];
    }
    if (g.type === 'amrap' || g.type === 'build') {
      warnings.push(`${g.type} block exported as one open step — Connect cannot express an unbounded repeat`);
      return [{
        type: 'ExecutableStepDTO',
        stepOrder: next(),
        stepType: stepType(StepType.INTERVAL, 'interval', 3),
        endCondition: g.window !== undefined
          ? endCondition(ConditionType.TIME, 'time', 2)
          : endCondition(ConditionType.LAP_BUTTON, 'lap.button', 1),
        endConditionValue: g.window ?? null,
        targetType: noTarget,
        description: g.label,
      }];
    }
    return g.items.flatMap(build);
  };

  const workoutSteps = build(t.root);

  const ramps = allSteps.filter((s) => s.notes.some((n) => /^ramp /i.test(n))).length;
  if (ramps && opts.powerTargets !== false) {
    warnings.push(`${ramps} ramp(s) target their starting power — Connect holds one target per step`);
  }

  const payload = {
    workoutName: (opts.name || t.root.label || 'Workout').slice(0, 80),
    description: opts.description ?? '',
    sportType,
    estimatedDurationInSecs: t.estimatedSeconds ?? 0,
    workoutSegments: [{ segmentOrder: 1, sportType, workoutSteps }],
  };



  return { output: JSON.stringify(payload, null, 2), warnings };
}
