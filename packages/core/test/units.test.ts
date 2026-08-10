import { describe, it, eq } from './lib.ts';
import { parseDuration, parseQuantity, parseTarget, formatDuration, formatTarget } from '../src/units.ts';

describe('units', () => {
  it('parses compound durations', () => {
    eq(parseDuration('90s')!, { kind: 'duration', seconds: 90 });
    eq(parseDuration('12min')!, { kind: 'duration', seconds: 720 });
    eq(parseDuration('1min30s')!, { kind: 'duration', seconds: 90 });
    eq(parseDuration('1h')!, { kind: 'duration', seconds: 3600 });
    eq(parseDuration('1:45')!, { kind: 'duration', seconds: 105 });
  });

  it('treats bare m and bare numbers as minutes in duration positions', () => {
    eq(parseDuration('12m', true)!, { kind: 'duration', seconds: 720 });
    eq(parseDuration('3 m', true)!, { kind: 'duration', seconds: 180 });
    eq(parseDuration('10', true)!, { kind: 'duration', seconds: 600 });
    eq(parseDuration('10', false), null, 'bare number is not a duration without context');
  });

  it('round-trips durations through canonical form', () => {
    for (const s of ['45s', '12min', '1min30s', '1h']) {
      eq(formatDuration(parseDuration(s)!), s);
    }
  });

  it('decomposes durations into the largest exact units (spec §3)', () => {
    eq(formatDuration(parseDuration('90s')!), '1min30s');
    eq(formatDuration(parseDuration('1:45')!), '1min45s');
    eq(formatDuration(parseDuration('120s')!), '2min');
    eq(formatDuration(parseDuration('45s')!), '45s');
  });

  it('distinguishes metres from minutes by position', () => {
    eq(parseQuantity('400m Run').quantity, { kind: 'distance', value: 400, unit: 'm' });
    eq(parseQuantity('400 meters Run').quantity, { kind: 'distance', value: 400, unit: 'm' });
    eq(parseQuantity('1mi Run').quantity, { kind: 'distance', value: 1, unit: 'mi' });
    eq(parseQuantity('1 mile Run').quantity, { kind: 'distance', value: 1, unit: 'mi' });
  });

  it('parses every completion condition', () => {
    eq(parseQuantity('10 Thruster').quantity, { kind: 'reps', value: 10 });
    eq(parseQuantity('15cal Row').quantity, { kind: 'calories', value: 15 });
    eq(parseQuantity('15 calories Row').quantity, { kind: 'calories', value: 15 });
    eq(parseQuantity('90s Plank').quantity, { kind: 'duration', seconds: 90 });
    eq(parseQuantity('max Pull-Up').quantity, { kind: 'max' });
    eq(parseQuantity('5+ Back Squat').quantity, { kind: 'floor', value: 5 });
    eq(parseQuantity('Bike easy').quantity, { kind: 'open' });
  });

  it('keeps the movement name intact', () => {
    eq(parseQuantity('30 Clean & Jerk').rest, 'Clean & Jerk');
    eq(parseQuantity('50 Chest-to-Bar Pull-Up').rest, 'Chest-to-Bar Pull-Up');
  });

  it('separates paired loads from single loads', () => {
    eq(parseTarget('2x24kg'), { kind: 'load', load: { kind: 'absolute', value: 24, unit: 'kg', implements: 2 } });
    eq(parseTarget('24kg'), { kind: 'load', load: { kind: 'absolute', value: 24, unit: 'kg' } });
    eq(formatTarget(parseTarget('2x24kg')), '2x24kg');
  });

  it('accepts load shorthand', () => {
    for (const s of ['95lb', '95 lbs', '95#']) {
      eq(parseTarget(s), { kind: 'load', load: { kind: 'absolute', value: 95, unit: 'lb' } }, s);
    }
  });

  it('parses relative and derived loads', () => {
    eq(parseTarget('75%'), { kind: 'load', load: { kind: 'percent', value: 75 } });
    eq(parseTarget('85% TM'), { kind: 'load', load: { kind: 'percent', value: 85, of: 'TM' } });
    eq(parseTarget('1.5x BW'), { kind: 'load', load: { kind: 'multiple', value: 1.5, of: 'BW' } });
    eq(parseTarget('85% of heavy-single'), { kind: 'load', load: { kind: 'percent', value: 85, of: 'heavy-single' } });
  });

  it('classifies intensity targets', () => {
    eq(parseTarget('5k pace').kind, 'pace');
    eq(parseTarget('4:30/km').kind, 'pace');
    eq(parseTarget('95% FTP').kind, 'load');
    eq(parseTarget('Z2').kind, 'heartRate');
    eq(parseTarget('RPE 8').kind, 'effort');
    eq(parseTarget('24in').kind, 'height');
  });
});

describe('units: found by the expanded corpus', () => {
  it('parses pood, the unit CrossFit still uses for kettlebells', () => {
    eq(parseTarget('2pood'), { kind: 'load', load: { kind: 'absolute', value: 2, unit: 'pood' } });
    eq(parseTarget('1.5pood'), { kind: 'load', load: { kind: 'absolute', value: 1.5, unit: 'pood' } });
  });

  it('parses a rep range', () => {
    eq(parseQuantity('8-12 Dumbbell Curl').quantity, { kind: 'range', min: 8, max: 12 });
    eq(parseQuantity('8-12 Dumbbell Curl').rest, 'Dumbbell Curl');
  });

  it('does not read a descending scheme as a range', () => {
    // `21-15-9` is a block header, not a step quantity; and a range must ascend.
    eq(parseQuantity('15-9 Thruster').quantity.kind, 'open');
  });
});
