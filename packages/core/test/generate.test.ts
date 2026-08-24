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
import { parseGoals, check, checkSeries } from '../src/goals.ts';
import { generate, generateProgram } from '../src/generate.ts';
import { parseProgram } from '../src/program.ts';
import { canonicalRegistry } from '../src/registry.ts';
import { fold } from '../src/fold.ts';
import type { MovementEntry } from '../src/fold.ts';

const here = dirname(fileURLToPath(import.meta.url));
const example = (p: string) => readFileSync(join(here, '../../../examples', p), 'utf8');
const tpl = (src: string) => parse(src).workout;
const rotate = () => parseGoals(example('goals/rotate-muscles.wdlg'));
/** The curated layer as written, before the merge folds it into the corpus. */
const curatedRecords = (): MovementEntry[] =>
  JSON.parse(readFileSync(join(here, '../../../registry/movements.json'), 'utf8')).movements;

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

describe('generate: across a block', () => {
  const rampGoals = () => parseGoals(example('goals/ramp-the-pull.wdlg'));
  const block = () => {
    const dir = join(here, '../../../examples/programs/ramp-block');
    const p = parseProgram(readFileSync(join(dir, 'ramp-block.wdlp'), 'utf8'));
    return p.cycles.flatMap((c) => c.entries.map((e) => ({
      name: `${c.label} · ${e.slot}`,
      slot: e.slot,
      workout: parse(readFileSync(join(dir, e.file), 'utf8')).workout,
    })));
  };

  it('gives one slot the same movements in every cycle', () => {
    // Generating week 1 and week 2 of the pull session independently gives them
    // different movements, and a `progress` rule on the lats then measures an
    // accident rather than a plan.
    const r = generateProgram(block(), rampGoals(), { seed: 2 });
    eq(r.solved, true);
    const perSlot = new Map<string, string[]>();
    for (const s of r.sessions) {
      const names: string[] = [];
      const walk = (nodes: any[]) => {
        for (const n of nodes) {
          if (n.node === 'step') names.push(n.movement);
          else if (n.children) walk(n.children);
        }
      };
      walk(s.workout.body);
      const seen = perSlot.get(s.slot!);
      if (!seen) perSlot.set(s.slot!, names);
      else eq(names, seen, `${s.slot} differs between cycles`);
    }
    eq([...perSlot.keys()].sort(), ['legs', 'pull']);
  });

  it('makes one decision per slot position, not one per session', () => {
    const sessions = block();
    const r = generateProgram(sessions, rampGoals(), { seed: 2 });
    // Six sessions, two holes each, but only two slots: four decisions.
    eq(r.groups.length, 4, `${sessions.length} sessions collapsed to ${r.groups.length} choices`);
  });

  it('satisfies the block rules, not only the session rules', () => {
    const r = generateProgram(block(), rampGoals(), { seed: 2 });
    eq(r.findings, [], 'progress and per-block cover');
    for (const w of r.perWorkout) eq(w.findings, [], w.name);
  });

  it('agrees with an independent check of the block it produced', () => {
    for (const seed of [1, 2, 3]) {
      const r = generateProgram(block(), rampGoals(), { seed });
      if (!r.solved) continue;
      const real = checkSeries(r.sessions.map((s) => ({
        name: s.name, slot: s.slot, timeline: compile(parse(format(s.workout)).workout),
      })), rampGoals());
      const key = (fs: { rule: string; message: string }[]) =>
        fs.map((f) => `${f.rule}|${f.message}`).sort().join('\n');
      eq(key(r.findings), key(real.findings), `block findings, seed ${seed}`);
      r.perWorkout.forEach((w, i) => eq(key(w.findings), key(real.perWorkout[i].report.findings), w.name));
    }
  });

  it('is the same code path as generating one workout', () => {
    // `generate` is `generateProgram` with a single session, so a regression in
    // one is a regression in both rather than a divergence nobody notices.
    const one = parse(example('templates/metcon.wdl')).workout;
    const viaProgram = generateProgram([{ name: 'x', workout: one }], rotate(), { seed: 5 });
    const direct = generate(one, rotate(), { seed: 5 });
    eq(direct.chosen.map((c) => c?.title), viaProgram.chosen.map((c) => c?.title));
  });
});

/**
 * The pool: what a `?` may be filled with, and what the palette shows with an
 * empty search box. Both read one flag — `core`, written by
 * `scripts/mark-core.mjs` — so these are properties of the registry rather than
 * of the search.
 *
 * The rule they pin is that the pool asks for a **judgement**. A record is in it
 * because a workout in our corpus writes it, because the curator wrote a record
 * for it, or because a vendor tracks a 1RM for it. Catalogues agreeing that a
 * movement exists is a different fact, and it used to be enough: `Quad Stretch`
 * was in the pool on three sources listing it. See the header of `mark-core.mjs`.
 */
describe('generate: the pool', () => {
  /** The signals that are somebody's judgement. Kept in step with `mark-core.mjs`. */
  const JUDGED = ['used-in-corpus', 'curated', 'garmin-benchmark'];
  const entries = () => canonicalRegistry().entries as (MovementEntry & {
    core?: boolean; commonality?: number; commonalityWhy?: string[]; sources?: string[];
    external?: { garminCategory?: string };
  })[];
  const pool = () => entries().filter((e) => e.core);

  it('is every record somebody judged, and only those', () => {
    const unjudged = pool().filter((e) => !(e.commonalityWhy ?? []).some((w) => JUDGED.includes(w)));
    eq(unjudged.map((e) => e.title), [], 'in the pool on catalogue evidence alone');
  });

  it('leaves out what catalogues merely agree exists', () => {
    const titles = new Set(pool().map((e) => e.title));
    // Named rather than counted, because these are the ones that made the rule
    // visible: a stretch, a warm-up drill, and a machine variant of a movement
    // already in the pool, each carried in by three catalogues listing it.
    for (const t of ['Quad Stretch', 'Ankle Circles', 'Smith Machine Close-Grip Bench Press']) {
      ok(!titles.has(t), `${t} is not in the pool`);
    }
    // And the rule has to bite, or the assertions above are about nothing.
    const attested = entries().filter((e) => !e.core && (e.commonality ?? 0) >= 4);
    ok(attested.length > 50, `${attested.length} records are attested but unjudged`);
  });

  it('holds every curated record that says something about the movement', () => {
    // Curation is +3 against a bar of 4, so a threshold dropped hand-written
    // records that no corpus workout happens to use. Fourteen of them.
    //
    // "Curated" has to mean the record makes a claim about the *movement*. The
    // alias pass writes records carrying nothing but `aliases`, and an alias is
    // a claim about a **name** — this spelling should resolve — which is no
    // reason to put a movement in front of a reader. Nine such records exist
    // and are deliberately out of the pool; they are still in the language,
    // still resolvable, still findable in the palette by typing.
    const SAYS_NOTHING = new Set(['id', 'title', 'aliases', 'sameAs']);
    const judged = new Set(curatedRecords()
      .filter((r) => Object.keys(r).some((k) => !SAYS_NOTHING.has(k)))
      .map((r) => fold(r.id)));
    const missing = entries().filter((e) =>
      (e.sources ?? []).includes('wdl-curated') && judged.has(fold(e.id)) && !e.core);
    eq(missing.map((e) => e.title), [], 'curated but out of the pool');
    const titles = new Set(pool().map((e) => e.title));
    for (const t of ['Bar-Facing Burpee', 'Hang Power Clean', 'Squat Snatch', 'Log Press']) {
      ok(titles.has(t), `${t} is in the pool`);
    }
  });

  it('is 128 movements', () => {
    // Pinned so it cannot drift in either direction unnoticed: silently growing
    // is how `Quad Stretch` arrived, and silently shrinking is how a rebuild
    // that forgot `mark-core` would read.
    //
    // 129 until the alias pass and `sameAs` landed beside this rule. One record
    // left — `Dumbbell Bicep Curl`, merged into `Dumbbell Curl` — which is the
    // whole intended effect. It briefly read 137, and that was this pin doing
    // its job: the alias pass writes curated records carrying nothing but
    // `aliases`, and `mark-core` read presence in the curated file as somebody
    // having judged the movement worth writing. Seven accessory movements the
    // pass happened to touch were promoted on a claim about a *name*. The
    // `curated` signal now asks that the record say something about the
    // movement; see the header of `scripts/mark-core.mjs`.
    eq(pool().length, 128);
  });

  it('is nothing a reader would have to warm up before', () => {
    const warmups = pool().filter((e) => e.external?.garminCategory === 'WARM_UP'
      || /\bstretch(es)?\b/i.test(e.title));
    eq(warmups.map((e) => e.title), [], 'warm-up and mobility work in the pool');
  });

  it('is entirely attributable, so nothing in it is unreachable', () => {
    // `generate` drops any candidate with no primary movers, so a record in the
    // pool without them is in a pool the generator cannot use.
    eq(pool().filter((e) => !e.muscles?.primary?.length).map((e) => e.title), []);
  });

  it('is what a bare `?` draws from', () => {
    const r = generate(tpl('sequence:\n  - 15 ?\n'), parseGoals(''));
    const ids = new Set(pool().map((e) => e.id));
    ok(r.holes[0].candidates.length > 100, `${r.holes[0].candidates.length} candidates`);
    ok(r.holes[0].candidates.every((e) => ids.has(e.id)), 'every candidate is in the pool');
  });
});
