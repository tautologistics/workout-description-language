/**
 * Goals: the separate artifact a workout is checked against.
 *
 * The premise under test is that intent lives outside the workout file. Nothing
 * here parses a `.wdl`; the goals file is its own grammar over the same
 * indentation reader, and `check` is the only thing that sees both.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { compile } from '../src/timeline.ts';
import { parseGoals, check, checkSeries } from '../src/goals.ts';

const t = (src: string) => compile(parse(src).workout);
const here = dirname(fileURLToPath(import.meta.url));
const example = (name: string) => readFileSync(join(here, '../../../examples/goals', name), 'utf8');

describe('goals: reading the rules', () => {
  it('reads rules at the top level or under a goals header, the same way', () => {
    const bare = parseGoals('no repeat:\n  gap: 2\n');
    const titled = parseGoals('goals: Tuesday\n\n  no repeat:\n    gap: 2\n');
    eq(titled.title, 'Tuesday');
    eq(bare.rules.length, 1);
    eq(titled.rules.map((r) => ({ ...r, line: 0 })), bare.rules.map((r) => ({ ...r, line: 0 })));
  });

  it('expands a region to its muscles but keeps it one group', () => {
    const g = parseGoals('cover:\n  regions: lower\n  at least: 2 movements\n');
    const rule = g.rules[0] as any;
    eq(rule.targets.length, 1, 'one group, not one per muscle');
    eq(rule.targets[0].name, 'lower');
    ok(rule.targets[0].muscles.includes('quads') && rule.targets[0].muscles.includes('calves'));
  });

  it('makes each named muscle its own group', () => {
    const rule = parseGoals('cover:\n  muscles: lats, chest\n  at least: 10 reps\n').rules[0] as any;
    eq(rule.targets.map((g: any) => g.name), ['lats', 'chest']);
  });

  it('reports what it could not read instead of guessing', () => {
    const g = parseGoals('cover:\n  muscles: elbow\n  at least: 2 movements\n');
    eq(g.rules.length, 0);
    ok(g.errors.some((e) => e.message.includes('elbow')), 'names the muscle it does not know');
    eq(parseGoals('shuffle:\n  muscles: lats\n').errors[0].message, 'unknown rule "shuffle"');
    ok(parseGoals('cover:\n  muscles: lats\n').errors[0].message.includes('at least'),
      'a bound is not optional');
  });

  it('takes the two example files without complaint', () => {
    for (const f of readdirSync(join(here, '../../../examples/goals'))) {
      const g = parseGoals(example(f));
      eq(g.errors, [], f);
      ok(g.rules.length > 0, `${f} has rules`);
    }
  });
});

describe('goals: no repeat', () => {
  const findings = (src: string, rule = 'no repeat:\n  level: primary\n') =>
    check(t(src), parseGoals(rule)).findings.map((f) => f.message);

  it('catches the same muscle in consecutive steps', () => {
    const f = findings('sequence:\n  - 10 Air Squat\n  - 10 Front Squat');
    eq(f.length, 1);
    ok(f[0].includes('quads'), f[0]);
  });

  it('catches the repeat that only exists because the round comes round again', () => {
    eq(findings('sequence:\n  - 10 Push-Up\n  - 10 Handstand Push-Up').length, 1);
    eq(findings('5 rounds:\n  - 10 Push-Up\n  - 10 Handstand Push-Up').length, 2);
  });

  it('honours an exemption, without which the rule is unsatisfiable', () => {
    // Nearly everything demands grip and trunk.
    const bare = findings('sequence:\n  - 10 Deadlift\n  - 10 Kettlebell Swing',
      'no repeat:\n  level: any\n');
    const exempt = findings('sequence:\n  - 10 Deadlift\n  - 10 Kettlebell Swing',
      'no repeat:\n  level: any\n  except: forearms, abs, obliques, erectors\n');
    ok(bare.length >= exempt.length, 'exempting can only reduce findings');
    ok(exempt.every((m) => !m.includes('forearms')), 'and it removes the exempted muscle');
  });

  it('widens to a gap of more than one', () => {
    const src = 'sequence:\n  - 10 Air Squat\n  - 10 Push-Up\n  - 10 Front Squat';
    eq(findings(src).length, 0, 'a push-up between them satisfies a gap of 1');
    eq(findings(src, 'no repeat:\n  gap: 2\n').length, 1, 'but not a gap of 2');
  });

  it('says nothing about a tally block, which has no order', () => {
    eq(findings('any order:\n  - 100 Air Squat\n  - 100 Front Squat').length, 0);
  });

  it('states a recurring fault once, with a count', () => {
    // A ten-tier ladder repeats its structure ten times. Reported ten times, one
    // structural fault buries the other nine faults in the file.
    const r = check(t('10..1:\n  - Air Squat\n  - Front Squat'), parseGoals('no repeat:\n'));
    eq(r.findings.length, 2, 'squat→squat and, round to round, squat→squat');
    eq(r.findings[0].count, 10);
  });
});

describe('goals: amounts', () => {
  it('separates a count of movements from a count of rounds', () => {
    const src = '5 rounds:\n  - 10 Air Squat';
    eq(check(t(src), parseGoals('limit:\n  muscles: quads\n  at most: 1 movements\n')).findings.length, 0);
    eq(check(t(src), parseGoals('limit:\n  muscles: quads\n  at most: 1 exposures\n')).findings.length, 1);
  });

  it('counts a group once however many of its muscles a step works', () => {
    // A pull-up works several muscles of the upper body. It is still one movement.
    const r = check(t('sequence:\n  - 10 Pull-Up'), parseGoals('cover:\n  regions: upper\n  at least: 2 movements\n'));
    ok(r.findings[0].message.startsWith('upper: 1 movements'), r.findings[0].message);
  });

  it('measures in the dimension the movement is measured in', () => {
    const r = check(t('sequence:\n  - 400m Run'), parseGoals('cover:\n  regions: lower\n  at least: 500 metres\n'));
    ok(r.findings[0].message.includes('400 metres'), r.findings[0].message);
  });

  it('reports a bound judged against an open-ended workout as a floor', () => {
    ok(check(t('AMRAP 20min:\n  - 10 Air Squat'), parseGoals('cover:\n  muscles: quads\n  at least: 100 reps\n')).unbounded);
  });
});

describe('goals: balance', () => {
  const spread = (src: string) =>
    check(t(src), parseGoals('balance:\n  between: upper, lower\n  within: 25%\n  measure: movements\n')).findings;

  it('passes an even split and fails a lopsided one', () => {
    eq(spread('sequence:\n  - 10 Pull-Up\n  - 10 Air Squat').length, 0);
    eq(spread('sequence:\n  - 10 Pull-Up\n  - 10 Bench Press\n  - 10 Push-Up\n  - 10 Air Squat').length, 1);
  });

  it('says which side is short, and by how much', () => {
    const [f] = spread('sequence:\n  - 10 Pull-Up\n  - 10 Bench Press\n  - 10 Push-Up\n  - 10 Air Squat');
    ok(f.message.includes('upper 3') && f.message.includes('lower 1'), f.message);
    ok(f.message.includes('67%'), f.message);
  });
});

describe('goals: progress across a block', () => {
  const series = (...counts: number[]) =>
    counts.map((n, i) => ({ name: `week ${i + 1}`, timeline: t(`sequence:\n  - ${n} Pull-Up`) }));
  const goals = parseGoals('progress:\n  muscles: lats\n  at least: +10%\n  measure: reps\n');

  it('passes a block that ramps and fails one that stalls', () => {
    eq(checkSeries(series(10, 12, 15), goals).findings.length, 0);
    eq(checkSeries(series(10, 10, 10), goals).findings.length, 2);
  });

  it('names the two workouts and the shortfall', () => {
    const [f] = checkSeries(series(10, 10), goals).findings;
    ok(f.message.includes('week 1 10 → week 2 10'), f.message);
    ok(f.message.includes('11'), `states the figure required: ${f.message}`);
  });

  it('takes an absolute step as well as a proportional one', () => {
    const abs = parseGoals('progress:\n  muscles: lats\n  at least: 5 reps\n');
    eq(checkSeries(series(10, 15), abs).findings.length, 0);
    eq(checkSeries(series(10, 14), abs).findings.length, 1);
  });

  it('still checks the single-session rules on every workout in the block', () => {
    const g = parseGoals('no repeat:\n  level: primary\n');
    const s = [{ name: 'a', timeline: t('sequence:\n  - 10 Air Squat\n  - 10 Front Squat') }];
    eq(checkSeries(s, g).perWorkout[0].report.findings.length, 1);
  });
});

describe('goals: against the corpus', () => {
  it('finds the stacked muscles in Filthy Fifty and not in Fran', () => {
    const g = parseGoals(example('rotate-muscles.wdlg'));
    const corpus = join(here, '../../../examples/corpus');
    const of = (f: string) => check(t(readFileSync(join(corpus, f), 'utf8')), g).findings;
    const repeats = (f: string) => of(f).filter((x) => x.rule === 'no repeat');
    eq(repeats('13-filthy-fifty.wdl').length, 3);
    eq(repeats('04-fran.wdl').length, 0, 'a thruster and a pull-up share no primary');
  });

  it('runs over every corpus workout without throwing', () => {
    const g = parseGoals(example('rotate-muscles.wdlg'));
    const corpus = join(here, '../../../examples/corpus');
    let checked = 0;
    for (const f of readdirSync(corpus).filter((x) => x.endsWith('.wdl'))) {
      check(t(readFileSync(join(corpus, f), 'utf8')), g);
      checked++;
    }
    ok(checked > 150, `checked ${checked} workouts`);
  });
});
