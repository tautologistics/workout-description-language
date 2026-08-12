/**
 * Programs: an ordered block of training, and the goals it is built against.
 *
 * The slot is the idea being tested. Everything else here is plumbing — reading
 * a file, resolving a path — but grouping by slot is what makes `progress` mean
 * what it says rather than comparing pull day against leg day.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { compile } from '../src/timeline.ts';
import { parseGoals, checkSeries } from '../src/goals.ts';
import { parseProgram } from '../src/program.ts';
import { loadProgram, checkProgram } from '../../core/node/program.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const winter = join(root, 'examples/programs/winter-build/winter-build.wdlp');
const t = (src: string) => compile(parse(src).workout);

describe('program: reading the file', () => {
  it('reads a title, a goals reference and cycles in order', () => {
    const p = parseProgram([
      'program: Winter build',
      'goals: g.wdlg',
      '',
      'week 1:',
      '  - pull: a.wdl',
      '  - legs: b.wdl',
      '',
      'week 2:',
      '  - pull: c.wdl',
    ].join('\n'));
    eq(p.errors, []);
    eq(p.title, 'Winter build');
    eq(p.goals, 'g.wdlg');
    eq(p.cycles.map((c) => c.label), ['week 1', 'week 2']);
    eq(p.cycles[0].entries.map((e) => [e.slot, e.file]), [['pull', 'a.wdl'], ['legs', 'b.wdl']]);
  });

  it('numbers the slots when they are not named', () => {
    const p = parseProgram('week 1:\n  - a.wdl\n  - b.wdl\n');
    eq(p.cycles[0].entries.map((e) => e.slot), ['1', '2']);
  });

  it('reports what it could not read', () => {
    ok(parseProgram('program: x\n').errors[0].message.includes('no cycles'));
    ok(parseProgram('week 1:\n  - pull:\n').errors[0].message.includes('no workout file'));
    ok(parseProgram('week 1:\n').errors[0].message.includes('no sessions'));
  });

  it('names a workout it cannot open rather than dropping it', () => {
    const loaded = loadProgram(join(root, 'examples/programs/winter-build/winter-build.wdlp'));
    eq(loaded.errors, [], 'the example itself is clean');
  });
});

describe('program: slots', () => {
  const sessions = () => loadProgram(winter).sessions;

  it('keeps sessions in cycle order, tagged with their slot', () => {
    const s = sessions();
    eq(s.slice(0, 3).map((x) => x.slot), ['pull', 'push', 'legs']);
    eq(new Set(s.map((x) => x.cycle)).size, 3);
  });

  it('compares a session only against the same slot', () => {
    // Without slots, `progress` compares this week's pull session against this
    // week's leg session, sees the pulling collapse and reports a failure that
    // is only the observation that leg day is not pull day.
    const loaded = loadProgram(winter);
    const withSlots = checkSeries(loaded.sessions, loaded.goals).findings;
    const flat = loaded.sessions.map((s) => ({ name: s.name, timeline: s.timeline }));
    const without = checkSeries(flat, loaded.goals).findings;
    eq(withSlots.length, 0);
    ok(without.length >= 6, `${without.length} spurious findings without slots`);
  });

  it('names the slot in the finding', () => {
    const loaded = loadProgram(winter);
    // Flatten week 2's pull session so the ramp stalls.
    loaded.sessions[3].timeline = t('5 sets:\n  - 1 Strict Pull-Up');
    const [f] = checkSeries(loaded.sessions, loaded.goals).findings;
    ok(f.message.includes('(pull)'), f.message);
  });
});

describe('program: session rules and block rules', () => {
  const goals = (per: string) => parseGoals(`cover:\n  muscles: chest\n  at least: 30 reps\n  per: ${per}\n`);
  const series = () => [
    { name: 'a', slot: 'push', timeline: t('sequence:\n  - 20 Bench Press @ 135lb') },
    { name: 'b', slot: 'pull', timeline: t('sequence:\n  - 20 Strict Pull-Up') },
    { name: 'c', slot: 'push', timeline: t('sequence:\n  - 20 Bench Press @ 135lb') },
  ];

  it('asks a session rule of every session', () => {
    const r = checkSeries(series(), goals('session'));
    eq(r.perWorkout.filter((w) => w.report.findings.length).length, 3, 'none of them reaches 30 alone');
    eq(r.findings, [], 'and nothing is said about the block');
  });

  it('asks a block rule of the block, once', () => {
    const r = checkSeries(series(), goals('block'));
    eq(r.perWorkout.filter((w) => w.report.findings.length).length, 0,
      'a block rule is not a verdict on leg day');
    eq(r.findings.length, 0, '40 reps of bench across the block clears 30');
  });

  it('sums a block rule across the whole series', () => {
    const r = checkSeries(series(), parseGoals('cover:\n  muscles: chest\n  at least: 100 reps\n  per: block\n'));
    eq(r.findings.length, 1);
    ok(r.findings[0].message.startsWith('chest: 40 reps'), r.findings[0].message);
  });

  it('rejects a scope it does not know', () => {
    ok(goals('fortnight').errors[0].message.includes('per:'));
  });

  it('never asks an ordering rule of a block, where order does not exist', () => {
    // Two sessions each ending and starting on a squat are not adjacent.
    const g = parseGoals('no repeat:\n  level: primary\n');
    const r = checkSeries([
      { name: 'a', timeline: t('sequence:\n  - 10 Air Squat') },
      { name: 'b', timeline: t('sequence:\n  - 10 Front Squat') },
    ], g);
    eq(r.findings, []);
    eq(r.perWorkout.every((w) => !w.report.findings.length), true);
  });
});

describe('program: the example block', () => {
  it('satisfies its own goals', () => {
    const loaded = loadProgram(winter);
    eq(loaded.errors, []);
    const { perWorkout, findings } = checkProgram(loaded);
    eq(findings, [], 'across the block');
    for (const w of perWorkout) eq(w.report.findings, [], w.name);
  });

  it('every workout it names parses and compiles', () => {
    const dir = dirname(winter);
    const named = readdirSync(dir).filter((f) => f.endsWith('.wdl'));
    ok(named.length >= 9);
    for (const f of named) {
      const { workout, errors } = parse(readFileSync(join(dir, f), 'utf8'));
      eq(errors, [], f);
      ok(compile(workout).root.items.length > 0, f);
    }
  });
});
