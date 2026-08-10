/**
 * External-truth checks.
 *
 * Everything else in this suite is internal: round-tripping shows the parser
 * and formatter agree, validation shows no rule of mine fires. Neither says the
 * interpretation is correct.
 *
 * These assertions come from outside the codebase. How many thrusters are in
 * Fran, how long Fight Gone Bad lasts, how many deadlifts Open 22.2 prescribes
 * — these are facts about the workouts, and any misread scheme, off-by-one in a
 * ladder, wrong `reversed` tier, or repeat applied at the wrong level changes
 * the number.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { compile } from '../src/timeline.ts';
import { volume, repsOf } from '../src/volume.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/corpus');
const vol = (f: string) => volume(compile(parse(readFileSync(join(dir, f), 'utf8')).workout));
const secs = (f: string) => compile(parse(readFileSync(join(dir, f), 'utf8')).workout).estimatedSeconds;

/** [file, movement, expected reps] — totals published with each workout. */
const REP_TOTALS: [string, string, number][] = [
  // 21+15+9 = 45 of each
  ['04-fran.wdl', 'Thruster', 45],
  ['04-fran.wdl', 'Pull-Up', 45],
  ['61-jt.wdl', 'Handstand Push-Up', 45],
  // 50+40+30+20+10 = 150
  ['08-annie.wdl', 'Double-Under', 150],
  ['08-annie.wdl', 'Sit-Up', 150],
  // 10+9+…+1 = 55 of each of three lifts
  ['15-linda.wdl', 'Deadlift', 55],
  ['15-linda.wdl', 'Bench Press', 55],
  ['15-linda.wdl', 'Clean', 55],
  // 100 of each of four movements
  ['41-angie.wdl', 'Pull-Up', 100],
  ['41-angie.wdl', 'Air Squat', 100],
  // 5 rounds x (20+30+40+50) = 700 total
  ['09-barbara.wdl', 'Air Squat', 250],
  ['09-barbara.wdl', 'Pull-Up', 100],
  // 5 rounds x 12/9/6
  ['12-dt.wdl', 'Deadlift', 60],
  ['12-dt.wdl', 'Hang Power Clean', 45],
  ['12-dt.wdl', 'Push Jerk', 30],
  // partitioned, but the totals are fixed
  ['14-murph.wdl', 'Pull-Up', 100],
  ['14-murph.wdl', 'Push-Up', 200],
  ['14-murph.wdl', 'Air Squat', 300],
  // 7 rounds x 7 reps x 7 movements
  ['117-the-seven.wdl', 'Burpee', 49],
  // 50 of each of ten movements
  ['13-filthy-fifty.wdl', 'Burpee', 50],
  ['13-filthy-fifty.wdl', 'Box Jump', 50],
  // 30+25+20+15+10+5 = 105 of each
  ['70-stephen.wdl', 'GHD Sit-Up', 105],
  // single-movement benchmarks
  ['06-grace.wdl', 'Clean & Jerk', 30],
  ['44-isabel.wdl', 'Snatch', 30],
  ['46-karen.wdl', 'Wall Ball', 150],
  ['60-haley.wdl', 'Snatch', 100],
  ['115-randy.wdl', 'Power Snatch', 75],
  // 3 rounds x 21 / x 12
  ['07-helen.wdl', 'KB Swing', 63],
  ['07-helen.wdl', 'Pull-Up', 36],
  // 5 rounds x 30
  ['50-eva.wdl', 'KB Swing', 150],
  // 1+2+…+10+9+…+1 = 100 of each
  ['111-open-22-2.wdl', 'Deadlift', 100],
  ['111-open-22-2.wdl', 'Bar-Facing Burpee', 100],
  // ascending 1..10 = 55; the reversed pair must also be 55
  ['80-jj.wdl', 'Squat Clean', 55],
  ['80-jj.wdl', 'Parallette Handstand Push-Up', 55],
  ['112-the-ladder.wdl', 'Burpee', 55],
  ['112-the-ladder.wdl', 'Sit-Up', 55],
  // 10..1 across four movements
  ['56-nutts.wdl', 'Deadlift', 55],
];

describe('external truth: rep totals', () => {
  for (const [file, movement, expected] of REP_TOTALS) {
    it(`${file.replace(/^\d+-|\.wdl$/g, '')} — ${movement} x${expected}`, () => {
      eq(repsOf(vol(file), movement), expected);
    });
  }
});

describe('external truth: distance totals', () => {
  it('Helen runs 1200m', () => eq(vol('07-helen.wdl').byMovement['Run'].distanceM, 1200));
  it('Michael runs 2400m', () => eq(vol('62-michael.wdl').byMovement['Run'].distanceM, 2400));
  it('Nancy runs 2000m', () => eq(vol('47-nancy.wdl').byMovement['Run'].distanceM, 2000));
  it('Eva runs 4000m', () => eq(vol('50-eva.wdl').byMovement['Run'].distanceM, 4000));
  it('Murph runs 2 miles', () => {
    eq(Math.round(vol('14-murph.wdl').byMovement['Run'].distanceM), Math.round(2 * 1609.344));
  });
  it('a Hyrox race is 8km of running', () => {
    eq(vol('39-hyrox-open.wdl').byMovement['Run'].distanceM, 8000);
  });
  it('the rowing pyramid totals 4000m', () => {
    // 250+500+750+1000+750+500+250
    eq(vol('36-rowing-pyramid.wdl').byMovement['Row'].distanceM, 4000);
  });
  it('the descending row ladder totals 1500m', () => {
    eq(vol('161-descending-row-ladder.wdl').byMovement['Row'].distanceM, 1500);
  });
});

describe('external truth: durations', () => {
  it('Fight Gone Bad is 17 minutes', () => eq(secs('18-fight-gone-bad.wdl'), 17 * 60));
  it('Tabata This is 24 minutes', () => eq(secs('19-tabata-this.wdl'), 24 * 60));
  it('Cindy is 20 minutes', () => eq(secs('05-cindy.wdl'), 20 * 60));
  it('Chelsea is 30 minutes', () => eq(secs('10-chelsea.wdl'), 30 * 60));
  it('the Cooper test is 12 minutes', () => eq(secs('95-cooper-test.wdl'), 12 * 60));
  it('a pyramid interval session totals 1..5..1 minutes of work plus rest', () => {
    // 10 warmup + (1+2+3+4+5+4+3+2+1 = 25 work) + 9 rests x 2min + 10 cooldown
    eq(secs('114-pyramid-intervals.wdl'), (10 + 25 + 18 + 10) * 60);
  });
});

describe('external truth: what has no fixed total', () => {
  it('an AMRAP is unbounded', () => ok(vol('05-cindy.wdl').unbounded));
  it('a death-by ladder is unbounded', () => ok(vol('20-death-by-burpees.wdl').unbounded));
  it('a max-effort set is unbounded', () => ok(vol('52-lynne.wdl').unbounded));
  it('a rep range is unbounded', () => ok(vol('91-bodybuilding-hypertrophy.wdl').unbounded));
  it('a fixed for-time workout is not', () => {
    ok(!vol('04-fran.wdl').unbounded);
    ok(!vol('14-murph.wdl').unbounded);
    ok(!vol('39-hyrox-open.wdl').unbounded);
  });
});
