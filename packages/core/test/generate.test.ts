/**
 * Generation: filling the holes in a template so the result satisfies the goals.
 *
 * The property that matters most is the last one here. The generator scores
 * candidates over a patched exposure list rather than by compiling each one, so
 * its verdict is only worth anything if it matches what `check` says about the
 * workout it actually produced. Everything else is a detail; that is the load
 * the whole design rests on.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { format } from '../src/format.ts';
import { compile } from '../src/timeline.ts';
import { parseGoals, check } from '../src/goals.ts';
import { generate } from '../src/generate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const example = (p: string) => readFileSync(join(here, '../../../examples', p), 'utf8');
const tpl = (src: string) => parse(src).workout;
const rotate = () => parseGoals(example('goals/rotate-muscles.wdlg'));

describe('generate: reading a template', () => {
  it('finds the holes and leaves everything else alone', () => {
    const r = generate(tpl('5 rounds:\n  - 12 ? squat\n  - 10 Pull-Up\n'), parseGoals(''));
    eq(r.holes.length, 1);
    eq(r.holes[0].constraint, ['squat']);
    ok(format(r.workout).includes('10 Pull-Up'), 'the written movement is untouched');
    ok(!format(r.workout).includes('?'), 'the hole is filled');
  });

  it('reads a constraint as a muscle, a region, or a movement pattern', () => {
    const holes = (c: string) => generate(tpl(`sequence:\n  - 10 ? ${c}`), parseGoals('')).holes[0];
    ok(holes('lats').candidates.every((e) => e.muscles?.primary?.includes('lats')), 'muscle');
    ok(holes('lower').candidates.every((e) => e.muscles?.primary?.some((m) =>
      ['glutes', 'quads', 'hamstrings', 'calves', 'adductors', 'abductors'].includes(m))), 'region');
    // `pull` is not a pattern; `vertical-pull` and `horizontal-pull` are, and
    // someone writing `? pull` means both.
    ok(holes('pull').candidates.every((e) => e.pattern?.some((p) => p.includes('pull'))), 'pattern');
    ok(holes('pull').candidates.length > 1);
  });

  it('will not put a movement where its measurement makes no sense', () => {
    const distance = generate(tpl('sequence:\n  - 400m ?'), parseGoals('')).holes[0];
    ok(distance.candidates.every((e) => e.measures?.includes('distance')),
      'a step in metres needs a movement that reports metres');
    const reps = generate(tpl('sequence:\n  - 10 ?'), parseGoals('')).holes[0];
    ok(reps.candidates.every((e) => !e.pattern?.includes('locomotion')),
      'nobody does ten reps of a run');
  });

  it('reports a constraint nothing in the pool satisfies', () => {
    const r = generate(tpl('sequence:\n  - 10 ? neck squat'), parseGoals(''));
    eq(r.impossible.length, 1);
    eq(r.solved, false);
    ok(format(r.workout).includes('?'), 'the hole stays visible rather than being quietly dropped');
  });
});

describe('generate: equipment', () => {
  it('restricts the pool to what is to hand', () => {
    const r = generate(tpl('sequence:\n  - 10 ? squat'), parseGoals(''), { equipment: ['dumbbell'] });
    ok(r.holes[0].candidates.length > 0);
    for (const e of r.holes[0].candidates) {
      const kit = (e.equipment ?? []).join(' ').toLowerCase();
      ok(/dumbbell|bodyweight|body|none/.test(kit), `${e.title} needs ${kit}`);
    }
  });

  it('treats undeclared equipment as undeclared, not as bodyweight', () => {
    // Reading absent as bodyweight put a sandbag carry in a workout generated
    // for a dumbbell and a pull-up bar.
    const pool = [
      { id: 'mystery', title: 'Mystery Lift', muscles: { primary: ['quads'] }, pattern: ['squat'] },
      { id: 'air-squat', title: 'Air Squat', muscles: { primary: ['quads'] }, pattern: ['squat'], equipment: ['bodyweight'] },
    ];
    const r = generate(tpl('sequence:\n  - 10 ? squat'), parseGoals(''), { pool, equipment: ['dumbbell'] });
    eq(r.holes[0].candidates.map((e) => e.id), ['air-squat']);
  });
});

describe('generate: satisfying the goals', () => {
  it('produces a workout with no findings when one exists', () => {
    const r = generate(tpl(example('templates/metcon.wdl')), rotate(), { seed: 1 });
    eq(r.solved, true);
    eq(r.findings, []);
  });

  it('avoids the adjacency the rules forbid', () => {
    // Two squats in a row is the one thing this template makes easy to get wrong.
    const g = parseGoals('no repeat:\n  level: primary\n');
    const r = generate(tpl('sequence:\n  - 10 ? squat\n  - 10 ? squat'), g, { seed: 1 });
    if (r.solved) eq(r.findings, [], 'if it found an answer, the answer is clean');
    else ok(r.unfilled.length > 0, 'and if it could not, it says so rather than pretending');
  });

  it('gives different answers for different seeds', () => {
    const names = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      const r = generate(tpl(example('templates/metcon.wdl')), rotate(), { seed });
      names.add(r.chosen.map((c) => c?.title).join('/'));
    }
    ok(names.size > 1, `eight seeds gave ${names.size} distinct workouts`);
  });

  it('is reproducible for one seed', () => {
    const of = () => generate(tpl(example('templates/metcon.wdl')), rotate(), { seed: 4 })
      .chosen.map((c) => c?.title);
    eq(of(), of());
  });

  it('returns a complete best effort rather than an empty one', () => {
    // Pruning finds a clean answer fast but can cut away every branch. Handing
    // back an unfilled template and calling it a success is the failure mode.
    const g = parseGoals('no repeat:\n  level: any\n');
    const r = generate(tpl(example('templates/metcon.wdl')), g, { seed: 1 });
    eq(r.solved, true, 'every hole filled');
    ok(r.findings.length > 0, 'and the rules it could not satisfy are reported');
  });

  it('never claims success while leaving a hole open', () => {
    const g = rotate();
    for (const equipment of [undefined, ['barbell'], ['bodyweight'], ['kettlebell']]) {
      for (let seed = 1; seed <= 5; seed++) {
        const r = generate(tpl(example('templates/metcon.wdl')), g, { seed, equipment });
        if (!r.solved) eq(r.findings, [], 'findings are meaningless against a workout with holes in it');
      }
    }
  });
});

describe('generate: the score means what check means', () => {
  it('agrees with an independent check of the workout it produced', () => {
    // The generator scores over a patched exposure list rather than compiling
    // each candidate. If that shortcut ever disagreed with the real checker,
    // every result it has ever given would be worthless.
    const g = rotate();
    const template = example('templates/metcon.wdl');
    let compared = 0;
    for (const equipment of [undefined, ['barbell', 'box'], ['dumbbell', 'pull-up bar'], ['bodyweight']]) {
      for (let seed = 1; seed <= 8; seed++) {
        const r = generate(tpl(template), g, { seed, equipment });
        if (!r.solved) continue;
        const real = check(compile(parse(format(r.workout)).workout), g);
        const key = (fs: typeof real.findings) =>
          fs.map((f) => `${f.rule}|${f.message}|${f.count}`).sort().join('\n');
        eq(key(r.findings), key(real.findings), `seed ${seed}, equipment ${equipment ?? 'any'}`);
        compared++;
      }
    }
    ok(compared > 20, `compared ${compared} generated workouts`);
  });
});
