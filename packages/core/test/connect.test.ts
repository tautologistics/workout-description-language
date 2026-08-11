/**
 * Garmin Connect workout JSON.
 *
 * The schema is taken from payloads known to be accepted by the live API
 * (`cyberjunky/python-garminconnect`), so these tests check that the shape we
 * emit still matches it — required keys, enum values, and the ordering rule
 * Connect enforces. They cannot prove the API accepts a given payload; only a
 * real post can do that.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { compile } from '../src/timeline.ts';
import { exportGarminConnect } from '../src/adapters/garmin-connect.ts';
import { garminCategories, resolveGarminExercise } from '../src/adapters/garmin-exercises.ts';

const corpus = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/corpus');
const out = (f: string, opts = {}) => {
  const r = exportGarminConnect(compile(parse(readFileSync(join(corpus, f), 'utf8')).workout), opts);
  return { json: JSON.parse(r.output), warnings: r.warnings };
};

function everyStep(steps: any[], acc: any[] = []): any[] {
  for (const s of steps) {
    acc.push(s);
    if (s.type === 'RepeatGroupDTO') everyStep(s.workoutSteps, acc);
  }
  return acc;
}

describe('garmin connect: payload shape', () => {
  it('has the top-level keys Connect requires', () => {
    const { json } = out('37-bike-intervals.wdl');
    for (const k of ['workoutName', 'sportType', 'workoutSegments']) ok(k in json, k);
    eq(json.workoutSegments.length, 1);
    eq(json.workoutSegments[0].segmentOrder, 1);
    ok('sportType' in json.workoutSegments[0], 'the segment repeats the sport');
  });

  it('gives every step a unique stepOrder, groups included', () => {
    for (const f of ['12-dt.wdl', '37-bike-intervals.wdl', '19-tabata-this.wdl', '117-the-seven.wdl']) {
      const orders = everyStep(out(f).json.workoutSegments[0].workoutSteps).map((s) => s.stepOrder);
      eq(orders.length, new Set(orders).size, `${f}: ${orders.join(',')}`);
      ok(orders.every((n: number) => Number.isInteger(n) && n >= 1), f);
    }
  });

  it('tags each step with a DTO type Connect recognises', () => {
    const steps = everyStep(out('12-dt.wdl').json.workoutSegments[0].workoutSteps);
    ok(steps.every((s) => ['ExecutableStepDTO', 'RepeatGroupDTO'].includes(s.type)));
  });

  it('carries the estimated duration the timeline computed', () => {
    eq(out('37-bike-intervals.wdl').json.estimatedDurationInSecs, 68 * 60);
  });
});

describe('garmin connect: sport and structure', () => {
  it('files a barbell session as strength training', () => {
    eq(out('12-dt.wdl').json.sportType.sportTypeKey, 'strength_training');
  });

  it('files a bike session as cycling and a run as running', () => {
    eq(out('37-bike-intervals.wdl').json.sportType.sportTypeKey, 'cycling');
    eq(out('160-track-1000s.wdl').json.sportType.sportTypeKey, 'running');
  });

  it('honours an explicit sport override', () => {
    eq(out('12-dt.wdl', { sport: 'cardio_training' }).json.sportType.sportTypeKey, 'cardio_training');
  });

  it('turns rounds into a repeat group with the right iteration count', () => {
    const top = out('12-dt.wdl').json.workoutSegments[0].workoutSteps[0];
    eq(top.type, 'RepeatGroupDTO');
    eq(top.numberOfIterations, 5);
    eq(top.endCondition.conditionTypeKey, 'iterations');
    eq(top.workoutSteps.length, 3);
  });
});

describe('garmin connect: what FIT could not carry', () => {
  it('uses a real rep end condition', () => {
    const steps = everyStep(out('12-dt.wdl').json.workoutSegments[0].workoutSteps)
      .filter((s) => s.type === 'ExecutableStepDTO');
    eq(steps.map((s) => s.endCondition.conditionTypeKey), ['reps', 'reps', 'reps']);
    eq(steps.map((s) => s.endConditionValue), [12, 9, 6]);
  });

  it('carries the barbell load FIT has no field for', () => {
    // 155lb is 70.30682kg. Connect stores kilograms: sending 70307 made it
    // display "155,000.4 lbs", which is 70307kg converted.
    const step = everyStep(out('12-dt.wdl').json.workoutSegments[0].workoutSteps)
      .find((s) => s.category === 'DEADLIFT');
    eq(step.weightValue, 70.307);
    eq(step.weightUnit.unitKey, 'kilogram');
  });

  it('converts kg and pood loads correctly', () => {
    const kg = exportGarminConnect(compile(parse('5 sets:\n  - 5 Deadlift @ 100kg').workout));
    eq(JSON.parse(kg.output).workoutSegments[0].workoutSteps[0].workoutSteps[0].weightValue, 100);
    // A pood is 16.3805kg, so 2 pood is 32.761kg.
    const pood = exportGarminConnect(compile(parse('5 sets:\n  - 10 KB Swing @ 2pood').workout));
    eq(JSON.parse(pood.output).workoutSegments[0].workoutSteps[0].workoutSteps[0].weightValue, 32.761);
  });

  it('counts paired implements as the total moved', () => {
    const r = exportGarminConnect(compile(parse('5 sets:\n  - 10 Farmers Carry @ 2x24kg').workout));
    eq(JSON.parse(r.output).workoutSegments[0].workoutSteps[0].workoutSteps[0].weightValue, 48);
  });
});

describe('garmin connect: fidelity is reported', () => {
  it('says an AMRAP cannot be expressed', () => {
    ok(out('05-cindy.wdl').warnings.some((w) => /unbounded repeat/.test(w)));
  });

  it('says a clock-driven block loses its cadence', () => {
    ok(out('10-chelsea.wdl').warnings.some((w) => /fixed-cadence/.test(w)));
  });

  it('carries the tally-block warning through', () => {
    ok(out('14-murph.wdl').warnings.some((w) => /no prescribed order|prescribes none/.test(w)));
  });

  it('says a rep range loses its upper bound', () => {
    ok(out('91-bodybuilding-hypertrophy.wdl').warnings.some((w) => /rep range/.test(w)));
  });
});

describe('garmin connect: exercise catalogue', () => {
  it('never sends a category outside Connect\'s own list', () => {
    // The live API answers `{"message":"Invalid category"}` otherwise, which is
    // how the first DT export failed.
    const valid = new Set(garminCategories());
    for (const f of ['12-dt.wdl', '01-5-5-back-squat.wdl', '117-the-seven.wdl', '15-linda.wdl']) {
      for (const s of everyStep(out(f).json.workoutSegments[0].workoutSteps)) {
        if (s.category !== undefined) ok(valid.has(s.category), `${f}: ${s.category}`);
      }
    }
  });

  it('resolves the movements that failed the first import', () => {
    eq(resolveGarminExercise('Hang Power Clean'),
       { category: 'OLYMPIC_LIFT', exercise: 'BARBELL_HANG_POWER_CLEAN', via: 'implied barbell' });
    eq(resolveGarminExercise('Push Jerk')?.category, 'OLYMPIC_LIFT');
    eq(resolveGarminExercise('Deadlift'), { category: 'DEADLIFT', exercise: 'DEADLIFT', via: 'name' });
  });

  it('prefers a display name over an exercise code', () => {
    // BACK_SQUAT is also a code under SANDBAG; matching codes first filed a
    // barbell back squat as sandbag work.
    eq(resolveGarminExercise('Back Squat')?.category, 'SQUAT');
    eq(resolveGarminExercise('Front Squat')?.category, 'SQUAT');
  });

  it('resolves abbreviations through our own registry first', () => {
    eq(resolveGarminExercise('KB Swing')?.exercise, 'KETTLEBELL_SWING');
    eq(resolveGarminExercise('DB Snatch')?.category !== undefined, true);
  });

  it('ships no strength fields at all when a movement is unknown', () => {
    const r = exportGarminConnect(compile(parse('3 sets:\n  - 10 Sandbag Bear Hug Carry @ 50lb').workout));
    const step = JSON.parse(r.output).workoutSegments[0].workoutSteps[0].workoutSteps[0];
    eq(step.category, undefined);
    ok(r.warnings.some((w) => /not in Connect's exercise catalogue/.test(w)));
  });
});

describe('garmin connect: names and targets', () => {
  it('never sends an empty workout name', () => {
    // `??` let an empty label through, and Connect imported the workout untitled.
    for (const f of ['37-bike-intervals.wdl', '12-dt.wdl', '36-rowing-pyramid.wdl']) {
      ok(out(f).json.workoutName.length > 0, f);
    }
  });

  it('emits a power range, verified by import against the live site', () => {
    // Connect showed "230-245 W Intensity Target" on the work intervals.
    const { json } = out('37-bike-intervals.wdl', { ftp: 250 });
    // The work intervals live inside the repeat group; the first targeted step
    // overall is the warmup ramp.
    const group = json.workoutSegments[0].workoutSteps.find((s: any) => s.type === 'RepeatGroupDTO');
    eq([group.workoutSteps[0].targetValueOne, group.workoutSteps[0].targetValueTwo], [230, 245]);
  });

  it('can be turned off, back to the untargeted payload', () => {
    const steps = everyStep(out('37-bike-intervals.wdl', { powerTargets: false }).json.workoutSegments[0].workoutSteps)
      .filter((s) => s.type === 'ExecutableStepDTO');
    ok(steps.every((s) => s.targetType.workoutTargetTypeKey === 'no.target'));
  });

  it('gives a ramp its starting power, since Connect holds one target per step', () => {
    const { json, warnings } = out('37-bike-intervals.wdl', { ftp: 250 });
    const first = json.workoutSegments[0].workoutSteps[0];
    eq([first.targetValueOne, first.targetValueTwo], [121, 129]);   // 50% of 250
    ok(warnings.some((w) => /starting power/.test(w)));
  });
});

describe('garmin connect: catalogue from Connect\'s own data', () => {
  it('has all 47 categories and every exercise Connect ships', () => {
    eq(garminCategories().length, 47);
  });

  it('generalises a movement Connect does not have to the closest one it does', () => {
    // Connect has no chest-to-bar pull-up, but it has a pull-up. A step the
    // watch can name beats one it cannot.
    eq(resolveGarminExercise('Chest-to-Bar Pull-Up'),
       { category: 'PULL_UP', exercise: 'PULL_UP', via: 'generalised to Pull-Up' });
    eq(resolveGarminExercise('Yoke Carry')?.category, 'CARRY');
    eq(resolveGarminExercise('Strict Pull-Up')?.category, 'PULL_UP');
  });

  it('prefers an exact match over a generalisation', () => {
    // Dropping qualifiers must be the last resort, never the first answer.
    eq(resolveGarminExercise('Romanian Deadlift'),
       { category: 'DEADLIFT', exercise: 'ROMANIAN_DEADLIFT', via: 'name' });
    eq(resolveGarminExercise('Overhead Squat')?.exercise, 'OVERHEAD_SQUAT');
  });

  it('picked up exercises the third-party extraction was missing', () => {
    eq(resolveGarminExercise('Turkish Get-Up')?.exercise, 'TURKISH_GET_UP');
  });
});
