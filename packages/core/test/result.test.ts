/**
 * Results: the second record type, and the first thing in this project that
 * knows what an athlete actually did.
 *
 * The questions worth asking of it are not the questions asked of a workout. A
 * workout is checked by round-tripping and by what it means; a result is checked
 * by whether it still says the same thing after the workout file has moved on,
 * and by whether the analysis layer can finally be asked about load.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { compile } from '../src/timeline.ts';
import { exposures } from '../src/muscles.ts';
import { parseGoals, checkSeries } from '../src/goals.ts';
import {
  parseResult, formatResult, instantiate, checkResult, resultSeries, declaredScore,
} from '../src/result.ts';
import { loadKilograms, parseDuration } from '../src/units.ts';

const FRAN = `result: crossfit:fran
date: 2026-08-21
athlete: chris
score: 8:42
splits: 2:50, 3:01, 2:51
notes: grip gave out in round 3

loads:
  - Thruster @ 65lb

snapshot:
  # Fran
  @id crossfit:fran

  for time:
    21-15-9:
      - Thrusters @ 95lb
      - Pull-Ups
`;

const squat = (date: string, kg: string) => parseResult(
  `result: back-squat-5x5\ndate: ${date}\nloads:\n  - Back Squat @ ${kg}\n`
  + 'snapshot:\n  # Back squat\n  @id back-squat-5x5\n  5 sets:\n    - 5 Back Squat\n    rest 3min\n');

describe('result: reading the record', () => {
  it('reads every field, and the head names what it is a result of', () => {
    const r = parseResult(FRAN);
    eq(r.errors, []);
    eq(r.workout, 'crossfit:fran');
    eq(r.date, '2026-08-21');
    eq(r.athlete, 'chris');
    eq(r.score, '8:42');
    eq(r.splits, ['2:50', '3:01', '2:51']);
    eq(r.notes, ['grip gave out in round 3']);
    eq(r.loads, [{ movement: 'Thruster', value: '65lb', line: 9 }]);
  });

  it('holds the snapshot verbatim, blank lines and all', () => {
    // The whole reason for a snapshot is that it is the file as it was. Read
    // through the line tree and re-rendered it would be a copy of what the
    // formatter thinks today, which is the reference §3.2.1 rejected.
    const r = parseResult(FRAN);
    eq(r.snapshot, '# Fran\n@id crossfit:fran\n\nfor time:\n  21-15-9:\n    - Thrusters @ 95lb\n    - Pull-Ups');
    eq(parse(r.snapshot!).errors, []);
  });

  it('reads fields under a bare `result:` as well as beside it', () => {
    // Not a courtesy: `result:` with no id ends in a colon, so phase 1 opens a
    // container and everything after it is its child. One shape would have made
    // the id optional in the type and unwritable in practice.
    const nested = parseResult('result:\n  date: 2026-08-21\n  athlete: chris\n  snapshot:\n    - 1mi Run\n');
    eq(nested.errors, []);
    eq(nested.workout, undefined);
    eq(nested.date, '2026-08-21');
    eq(nested.athlete, 'chris');
    eq(nested.snapshot, '- 1mi Run');
  });

  it('reports a field nobody taught it, and a date it cannot read', () => {
    eq(parseResult('result: x\nweather: rain\n').errors.length, 1);
    const bad = parseResult('result: x\ndate: friday\n').errors;
    eq(bad.length, 1);
    ok(bad[0].message.includes('YYYY-MM-DD'));
  });

  it('refuses a record that says nothing about what it is a result of', () => {
    const r = parseResult('date: 2026-08-21\nathlete: chris\n');
    eq(r.errors.length, 1);
    ok(r.errors[0].message.includes('workout id'));
  });

  it('round-trips through its own formatter', () => {
    const once = parseResult(FRAN);
    const text = formatResult(once);
    const twice = parseResult(text);
    eq(twice.errors, []);
    eq({ ...twice }, { ...once });
    eq(formatResult(twice), text, 'and settles');
  });
});

describe('result: the instantiation', () => {
  it('writes the athlete’s load over the one the file prescribes', () => {
    // The class says 95lb; this athlete lifted 65lb. The record of what was done
    // is the one that is true of them, so it is applied last and wins.
    const r = parseResult(FRAN);
    const { instance } = checkResult(r);
    const step = exposures(compile(instance!)).list[0];
    eq(step.movement, 'Thrusters');
    eq(step.load, loadKilograms({ kind: 'absolute', value: 65, unit: 'lb' }));
  });

  it('matches a load to a step through the registry, plural and all', () => {
    // `Thruster @ 65lb` has to find a step written `21 Thrusters`, which is the
    // same match a `variants:` entry makes and the same code making it.
    const r = parseResult(FRAN);
    const applied = instantiate(parse(r.snapshot!).workout, r);
    eq(applied.diagnostics, []);
  });

  it('reports a load for a movement the workout does not contain', () => {
    const r = parseResult('result: x\ndate: 2026-08-21\nloads:\n  - Deadlift @ 100kg\n'
      + 'snapshot:\n  - 1mi Run\n');
    const d = instantiate(parse(r.snapshot!).workout, r).diagnostics;
    eq(d.length, 1);
    eq(d[0].code, 'result-load-unmatched');
    eq(d[0].severity, 'warning');
  });

  it('reports a load value it cannot read, and leaves the step alone', () => {
    const r = parseResult('result: x\ndate: 2026-08-21\nloads:\n  - Run @ briskly\n'
      + 'snapshot:\n  - 1mi Run\n');
    const d = instantiate(parse(r.snapshot!).workout, r).diagnostics;
    eq(d.map((x) => x.code), ['result-load-unread']);
    eq(d[0].severity, 'note');
  });

  it('applies the division before the load, so the load wins', () => {
    const r = parseResult('result: x\ndate: 2026-08-21\ndivision: women\n'
      + 'loads:\n  - Thruster @ 30kg\n'
      + 'snapshot:\n  - 10 Thruster (women 65lb / men 95lb)\n');
    const { instance } = checkResult(r);
    eq(exposures(compile(instance!)).list[0].load, 30);
  });
});

describe('result: checking one against its snapshot', () => {
  it('says nothing about a record that agrees with itself', () => {
    eq(checkResult(parseResult(FRAN)).diagnostics, []);
  });

  it('reports an id that disagrees with the snapshot it carries', () => {
    const r = parseResult('result: gym:other\ndate: 2026-08-21\n'
      + 'snapshot:\n  @id gym:friday\n  - 1mi Run\n');
    const codes = checkResult(r).diagnostics.map((d) => d.code);
    ok(codes.includes('result-id-mismatch'));
  });

  it('reports a division the workout does not offer', () => {
    const r = parseResult('result: x\ndate: 2026-08-21\ndivision: mens\n'
      + 'snapshot:\n  - 10 Thruster (women 65lb / men 95lb)\n');
    const d = checkResult(r).diagnostics.find((x) => x.code === 'unknown-division');
    eq(d?.severity, 'error');
  });

  it('reports a score of the wrong shape for what the workout declares', () => {
    const timed = (score: string) => checkResult(parseResult(
      `result: x\ndate: 2026-08-21\nscore: ${score}\nsnapshot:\n  for time:\n    - 1mi Run\n`,
    )).diagnostics.map((d) => d.code);
    eq(timed('8:42'), []);
    eq(timed('1:04:19'), [], 'a session past the hour is still a time');
    eq(timed('eleven'), ['result-score-shape']);
  });

  it('takes either reading of a capped for-time, since both are true', () => {
    // spec §9.5: capped, the score becomes the reps completed. Both spellings
    // are the truth about the day, so neither is reported.
    const src = (score: string) => `result: x\ndate: 2026-08-21\nscore: ${score}\n`
      + 'snapshot:\n  for time:\n    - 100 Burpee\n  score: {primary: time, on cap: reps}\n';
    eq(checkResult(parseResult(src('9:30'))).diagnostics, []);
    eq(checkResult(parseResult(src('84'))).diagnostics, []);
  });

  it('says a record with no snapshot cannot be checked, rather than passing it', () => {
    const codes = checkResult(parseResult('result: crossfit:fran\ndate: 2026-08-21\n'))
      .diagnostics.map((d) => d.code);
    eq(codes, ['result-no-snapshot']);
  });

  it('says a record with no date cannot be placed in a series', () => {
    const codes = checkResult(parseResult('result: x\nsnapshot:\n  - 1mi Run\n'))
      .diagnostics.map((d) => d.code);
    ok(codes.includes('result-no-date'));
  });

  it('reads the score a single top-level block implies', () => {
    eq(declaredScore(parse('for time:\n  - 1mi Run\n').workout), 'time');
    eq(declaredScore(parse('# x\nscore: rounds\nAMRAP 5min:\n  - 5 Pull-Up\n').workout), 'rounds');
    eq(declaredScore(parse('- 1mi Run\n').workout), undefined);
  });
});

describe('result: a series of executions', () => {
  const goals = parseGoals('progress:\n  muscles: quads\n  at least: +2.5%\n  measure: load\n');

  it('orders by date as text, and never builds a Date', () => {
    // An ISO date sorts correctly as a string, which is how this sidesteps the
    // timezone bug that cost a day in `generate`: nothing here reads a clock.
    const series = resultSeries([squat('2026-08-24', '110kg'), squat('2026-08-10', '100kg'), squat('2026-08-17', '105kg')]);
    eq(series.map((s) => s.name.slice(0, 10)), ['2026-08-10', '2026-08-17', '2026-08-24']);
  });

  it('ramps the load across executions of one class', () => {
    // The whole point of the record. `5 Back Squat` is the same file every week
    // and means to be; the number that has to go up is one only a result knows.
    const ok3 = checkSeries(resultSeries([squat('2026-08-10', '100kg'), squat('2026-08-17', '105kg')]), goals);
    eq(ok3.findings, []);
    const short = checkSeries(resultSeries([squat('2026-08-10', '100kg'), squat('2026-08-17', '101kg')]), goals);
    eq(short.findings.length, 1);
    ok(short.findings[0].message.includes('100 →'));
    ok(short.findings[0].message.includes('kg'));
  });

  it('compares a load written in pounds against one written in kilos', () => {
    // 230lb is 104.33kg, which clears a 2.5% ramp on 100kg; 220lb is 99.79kg,
    // which is a *drop*. Neither answer is available without converting, and
    // reading the bare numbers would have called 220 an increase on 100.
    eq(checkSeries(resultSeries([squat('2026-08-10', '100kg'), squat('2026-08-17', '230lb')]), goals).findings, []);
    const down = checkSeries(resultSeries([squat('2026-08-10', '100kg'), squat('2026-08-17', '220lb')]), goals);
    eq(down.findings.length, 1);
    ok(down.findings[0].message.includes('99.79 kg'));
  });

  it('says it saw no load rather than passing a ramp it could not measure', () => {
    // Two zeroes satisfy `now >= prev * 1.025`, so the honest answer is that the
    // rule saw nothing — reported as met is the worst answer available.
    const bare = (date: string) => parseResult(
      `result: back-squat-5x5\ndate: ${date}\nsnapshot:\n  # Back squat\n  5 sets:\n    - 5 Back Squat\n`);
    const r = checkSeries(resultSeries([bare('2026-08-10'), bare('2026-08-17')]), goals);
    eq(r.findings.length, 1);
    ok(r.findings[0].message.includes('no kg recorded'));
  });

  it('groups by slot, defaulting to the workout the result names', () => {
    eq(resultSeries([squat('2026-08-10', '100kg')])[0].slot, 'back-squat-5x5');
    const named = parseResult('result: x\ndate: 2026-08-10\nslot: pull\nsnapshot:\n  - 1mi Run\n');
    eq(resultSeries([named])[0].slot, 'pull');
  });

  it('leaves out a record with no snapshot, since there is nothing to compile', () => {
    eq(resultSeries([parseResult('result: x\ndate: 2026-08-10\n')]), []);
  });
});

describe('result: a load in kilograms', () => {
  it('converts what it can and refuses what it cannot', () => {
    eq(loadKilograms({ kind: 'absolute', value: 100, unit: 'kg' }), 100);
    eq(loadKilograms({ kind: 'absolute', value: 95, unit: 'lb' }), 43.09);
    eq(loadKilograms({ kind: 'absolute', value: 24, unit: 'kg', implements: 2 }), 48, 'both hands');
    eq(loadKilograms({ kind: 'absolute', value: 105 }), undefined, 'an unlabelled rx split has no unit');
    eq(loadKilograms({ kind: 'percent', value: 85, of: '1RM' }), undefined, 'needs a profile');
    eq(loadKilograms({ kind: 'multiple', value: 1.5, of: 'BW' }), undefined);
    eq(loadKilograms({ kind: 'reference', name: 'heavy-single' }), undefined);
  });

  it('reads a session past the hour, which is what a result made necessary', () => {
    eq(parseDuration('1:04:19'), { kind: 'duration', seconds: 3859 });
    eq(parseDuration('8:42'), { kind: 'duration', seconds: 522 });
  });
});

describe('result: the examples', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '../../../examples/results');
  const all = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? all(join(dir, e.name))
      : e.name.endsWith('.wdlr') ? [join(dir, e.name)] : []));

  it('every example reads, and says nothing against its own snapshot', () => {
    // A file with no test drifts, and the drift is invisible because nothing
    // was looking. These are the only real records this project has.
    const files = all(root);
    ok(files.length >= 5, `found ${files.length} example results`);
    for (const file of files) {
      const r = parseResult(readFileSync(file, 'utf8'));
      eq(r.errors, [], file);
      eq(checkResult(r).diagnostics, [], file);
    }
  });

  it('ramps the load across the squat block, and reports where it falls short', () => {
    // The example the goals file was written for: 100 → 105 clears 2.5%,
    // 105 → 107.5 is 2.38% and does not.
    const goals = parseGoals(readFileSync(join(here, '../../../examples/goals/ramp-the-squat.wdlg'), 'utf8'));
    eq(goals.errors, []);
    const block = all(join(root, 'squat-block')).map((f) => parseResult(readFileSync(f, 'utf8')));
    const { findings } = checkSeries(resultSeries(block), goals);
    eq(findings.length, 2, 'quads and glutes, both short on the last step');
    for (const f of findings) ok(f.message.includes('105 → '), f.message);
  });
});

describe('result: one spelling for the id', () => {
  it('names the right line rather than accepting a second spelling', () => {
    // roadmap §3.2 sketched `workout:` under a `result:` header, so it is the
    // guess somebody will make; two spellings for one field is what queue item 1
    // spent a day removing elsewhere.
    const r = parseResult('result:\n  workout: crossfit:fran\n  snapshot:\n    - 1mi Run\n');
    eq(r.errors.length, 1);
    ok(r.errors[0].message.includes('`result:`'));
    eq(r.workout, undefined);
  });
});
