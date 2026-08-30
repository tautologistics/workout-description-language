import { describe, it, eq, ok } from './lib.ts';
import { fold, depluralize, pluralize, Registry } from '../src/fold.ts';
import { defaultRegistry, canonicalRegistry } from '../src/registry.ts';

describe('fold', () => {
  it('collapses case, separators, and punctuation', () => {
    for (const s of ['DB Thrusters', 'db-thrusters', 'D.B. Thrusters', 'db_thrusters', '  DB   Thrusters  ']) {
      eq(fold(s), 'dbthrusters', s);
    }
  });

  it('makes & and "and" agree', () => {
    eq(fold('Clean & Jerk'), 'cleanjerk');
    eq(fold('Clean and Jerk'), 'cleanjerk');
  });

  it('dissolves the concatenation problem by discarding separators', () => {
    for (const s of ['Pull-Ups', 'Pull Ups', 'pullups', 'PULL-UPS']) eq(fold(s), 'pullups', s);
    for (const s of ["Farmer's Carry", 'Farmers Carry', 'farmers-carry']) eq(fold(s), 'farmerscarry', s);
    for (const s of ['Handstand Push-Up', 'handstand pushup', 'HandstandPushUp']) eq(fold(s), 'handstandpushup', s);
  });

  it('drops stopwords', () => {
    eq(fold('Chest-to-Bar Pull-Ups'), 'chestbarpullups');
    eq(fold('Chest to Bar Pull Ups'), 'chestbarpullups');
  });

  it('strips diacritics', () => {
    eq(fold('Kniebeugé'), 'kniebeuge');
  });

  it('depluralizes only where it is safe', () => {
    eq(depluralize('burpees'), 'burpee');
    eq(depluralize('press'), 'press', 'a word ending in ss is left alone');
    eq(depluralize('pushpress'), 'pushpress');
    eq(depluralize('dips'), 'dip');
    eq(depluralize('boxes'), 'box');
  });
});

describe('registry', () => {
  const reg = defaultRegistry();

  it('satisfies fold(id) === fold(title) for every entry', () => {
    eq(reg.validate(), []);
  });

  /**
   * The curated file is not the registry analysis reads. `muscles.ts`,
   * `volume.ts` and every goal rule go through `canonicalRegistry()`, and
   * nothing validated it — an alias two records claimed resolved to whichever
   * of them owned the matching id, silently, with no test able to notice.
   *
   * Twelve were found the first time this ran. Every one was the same shape: a
   * curated alias naming a movement the merged corpus holds as a record of its
   * own, because the registry had no way for a curator to say "these two are
   * one record". `sameAs` is that way now, and eight of the twelve were one
   * movement and are merged; two were not, and the alias asserting otherwise
   * was withdrawn. The verdicts are per pair in docs/context/topics/known-debts.md.
   *
   * Both survivors were `Bike`, and one of them closed on 2026-08-23. `Air
   * Bike` was a false merge before it was a collision — Garmin's fan bike and
   * free-exercise-db's *bicycle crunch* under one spelling — and once
   * `build-movements.mjs` split the crunch out, what was left was Garmin's fan
   * bike claiming exactly what `Bike` claims, which is what the curated alias
   * said all along. It is merged.
   *
   * `Assault Bike` is the survivor, and it is the modality finding: `Bike` is a
   * curated lump over the erg, the fan bike and the road, and absorbing one
   * machine into it spreads that machine's muscles across all of them. Merging
   * it put Garmin's chest claim on six cycling workouts, a 40km ride among
   * them. The alias is correct English and stays; the collision is the price of
   * a lump the registry cannot express, and is pinned rather than argued away.
   *
   * Pinned exactly rather than bounded, so a merge that lands fails here as
   * stale instead of leaving a loose ceiling nobody tightens.
   */
  it('leaves validate() nothing to report on the canonical corpus', () => {
    // This asserted the two `Bike` pairs by name until the ranking landed.
    // `validate()` now reports only what no rule can decide, and a name held as
    // one record's id and another's alias is decided by `lookup` — so the two
    // survivors moved to the contended-names test below, which pins who wins
    // rather than merely that a contest exists. Empty here is the stronger
    // claim it looks like: no name is claimed twice *within* either tier.
    eq(canonicalRegistry().validate(), []);
  });

  /**
   * The shape no rule could have fixed, and the reason `sameAs` had to exist.
   *
   * `Dumbbell Bicep Curl` and `Dumbbell Curl` both held `dumbbellbicepscurl`
   * as an *alias* and neither as its name, so there was nothing to rank: every
   * other collision resolved — wrongly, but uniquely — to whichever record
   * owned the matching id, while this one reached the `ambiguous` branch and
   * the step dropped out of muscle attribution entirely. Only a curator saying
   * the two records are one movement closes it.
   */
  it('resolves a spelling that was only ever an alias on both records', () => {
    const r = canonicalRegistry().resolve('Dumbbell Biceps Curl');
    ok(r.status === 'ok' && r.entry.id === 'dumbbell-curl', JSON.stringify(r));
  });

  /**
   * The mirror of the case above, and the reason a *split* had to exist beside
   * `sameAs`.
   *
   * `Air Bike` was one record holding two exercises. Garmin's
   * `INDOOR_BIKE/AIR_BIKE` is the fan bike; free-exercise-db's `Air_Bike` and
   * everkinetic's `0284` are the bicycle crunch, and all three fold to the same
   * key, so they merged inside `build-movements.mjs` before any dedup rule
   * could look at them. The result claimed `abs` and `quads` at once and scored
   * `3-sources` for it — three catalogues agreeing, read off a shared spelling.
   *
   * Every guard in the pipeline stops *similar* names merging. Nothing stopped
   * identical ones, because a title match was treated as proof. `sameAs` cannot
   * undo it either: it merges records, and this needed one split. The
   * correction is a table in `build-movements.mjs` keyed on `source:upstream-id`
   * — the entry, not the record, because the name is the thing that is wrong.
   *
   * Pinned from both ends: the crunch keeps the two catalogues it gained, and
   * the name keeps meaning the machine.
   */
  it('splits a name two traditions gave to different exercises', () => {
    const canon = canonicalRegistry();
    const crunch = canon.resolve('Bicycle Crunch');
    ok(crunch.status === 'ok' && crunch.entry.id === 'bicycle-crunch', JSON.stringify(crunch));
    // Two before the split, four after: free-exercise-db and everkinetic filed
    // it under `Air Bike` and now count towards the exercise they described.
    eq(crunch.status === 'ok' ? crunch.entry.muscles?.sources : 0, 4);

    const bike = canon.resolve('Air Bike');
    ok(bike.status === 'ok' && bike.entry.id === 'bike', JSON.stringify(bike));
    const muscles = bike.status === 'ok' ? bike.entry.muscles : undefined;
    ok(muscles?.primary?.includes('quads'), JSON.stringify(muscles));
    ok(!muscles?.primary?.includes('abs') && !muscles?.secondary?.includes('abs'),
       `Air Bike is a machine, not an abdominal exercise: ${JSON.stringify(muscles)}`);
  });

  it('resolves canonical ids and titles', () => {
    const r = reg.resolve('Thruster');
    ok(r.status === 'ok' && r.entry.id === 'thruster', JSON.stringify(r));
  });

  it('resolves abbreviations through token expansion', () => {
    for (const [input, id] of [['DB Snatch', 'dumbbell-snatch'], ['HSPU', 'handstand-push-up'],
                               ['T2B', 'toes-to-bar'], ['SDHP', 'sumo-deadlift-high-pull'],
                               ['C2B', 'chest-to-bar-pull-up']] as const) {
      const r = reg.resolve(input);
      ok(r.status === 'ok' && r.entry.id === id, `${input} -> ${JSON.stringify(r)}`);
    }
  });

  it('resolves plurals and concatenations', () => {
    for (const input of ['Pull-Ups', 'pullups', 'Pull Up', 'PULLUP']) {
      const r = reg.resolve(input);
      ok(r.status === 'ok' && r.entry.id === 'pull-up', `${input} -> ${JSON.stringify(r)}`);
    }
  });

  it('resolves & and and to the same movement', () => {
    for (const input of ['Clean & Jerk', 'Clean and Jerk', 'C&J']) {
      const r = reg.resolve(input);
      ok(r.status === 'ok' && r.entry.id === 'clean-and-jerk', `${input} -> ${JSON.stringify(r)}`);
    }
  });

  it('matches token sets so word order needs no alias', () => {
    const r = reg.resolve('Squat, Front');
    ok(r.status === 'ok' && r.entry.id === 'front-squat', JSON.stringify(r));
    eq(r.status === 'ok' ? r.via : '', 'tokens');
  });

  // Two records answering to one name is ordinary in a merged corpus, and none
  // of the pairs below is a duplicate — known-debts.md carries the verdict on
  // each. What would be a defect is a *new* collision
  // arriving unnoticed, or one of these quietly changing its mind about who
  // wins. `resolve` ranks an explicit alias above a record's own id, so a
  // curator's claim on a contested spelling beats an imported record that
  // merely happens to be named after it; the right-hand column is that answer.
  //
  // `node scripts/check-aliases.mjs` prints this table with the reasoning.
  it('has only the known alias collisions in the canonical corpus', () => {
    const canon = canonicalRegistry();
    // Fourteen when the ranking landed, two once the curation half did, one
    // since `Air Bike` was split. The ranking decided *who answers*; it could
    // not say whether two records are one movement, and eight pairs were —
    // merged by `sameAs` — while two more were not and the alias claiming
    // otherwise was withdrawn.
    //
    // `Air Bike` was neither: it was one record holding two exercises, Garmin's
    // fan bike merged with free-exercise-db's and everkinetic's *bicycle
    // crunch* on the spelling they share. `sameAs` could not reach it because
    // `sameAs` merges and this needed a split; the split is a table in
    // `build-movements.mjs` keyed on the source entry, and once the crunch left,
    // the fan bike claimed exactly what `Bike` claims and was merged into it.
    //
    // `Assault Bike` survives, and it is the modality finding: `Bike` is a
    // curated lump over the erg, the fan bike and the road, so absorbing one
    // machine into it spreads that machine's muscles across all of them.
    // Merging it put Garmin's chest claim on six cycling workouts, a 40km ride
    // among them — which is exactly what merging `Air Bike` did *not* do, and
    // the difference is the whole reason one closed and the other did not. The
    // alias is correct English and stays; the collision is the price of a lump
    // the registry cannot express, and is pinned rather than argued away.
    //
    // Pinned exactly rather than bounded, so a merge that lands fails here as
    // stale instead of leaving a loose ceiling nobody tightens.
    const KNOWN: Record<string, string> = {
      assaultbike: 'bike',
    };

    const holders = new Map<string, Set<string>>();
    for (const e of canon.entries) {
      for (const name of [e.id, e.title, ...(e.aliases ?? [])]) {
        const k = fold(name);
        if (!k) continue;
        if (!holders.has(k)) holders.set(k, new Set());
        holders.get(k)!.add(e.id);
      }
    }
    const contended = [...holders].filter(([, ids]) => ids.size > 1).map(([k]) => k).sort();
    eq(contended, Object.keys(KNOWN).sort(), 'names claimed by more than one record');

    const answers = Object.fromEntries(contended.map((k) => {
      const r = canon.resolve(k);
      return [k, r.status === 'ok' ? r.entry.id : r.status];
    }));
    eq(answers, KNOWN, 'who wins each contested name');

    // The defect this ranking fixes was never that a name was contested. It was
    // that the two registries answered differently and nothing said so: `Squat`
    // was Air Squat to `validate`, which reads the curated file, and a barbell
    // Squat to the muscle analysis, which reads this one. Where the curator has
    // answered, the corpus may decline to answer but may not contradict.
    for (const name of contended) {
      const a = defaultRegistry().resolve(name);
      if (a.status !== 'ok') continue;
      const b = canon.resolve(name);
      ok(b.status === 'ambiguous' || (b.status === 'ok' && b.entry.id === a.entry.id),
         `${name}: curated says ${a.entry.id}, canonical says ${JSON.stringify(b)}`);
    }
  });

  it('reports ambiguity rather than guessing', () => {
    const amb = new Registry([
      { id: 'row', title: 'Row', aliases: ['erg'] },
      { id: 'ski-erg', title: 'SkiErg', aliases: ['erg'] },
    ]);
    const r = amb.resolve('Erg');
    eq(r.status, 'ambiguous');
    eq(r.status === 'ambiguous' ? r.candidates.map((c) => c.id) : [], ['row', 'ski-erg']);
  });

  it('leaves an unknown movement unregistered rather than failing', () => {
    const r = reg.resolve('Sandbag Bear Hug Carry');
    eq(r.status, 'unregistered');
  });

  it('records paired implements where the load arithmetic depends on it', () => {
    const r = reg.resolve('Farmers Carry');
    ok(r.status === 'ok' && r.entry.implements === 2 && r.entry.load === 'per-implement', JSON.stringify(r));
  });

  it('records equipment readouts so 15cal Thruster can be questioned', () => {
    const row = reg.resolve('Row');
    ok(row.status === 'ok' && row.entry.measures?.includes('calories'));
    const thruster = reg.resolve('Thruster');
    ok(thruster.status === 'ok' && thruster.entry.measures === undefined, 'a barbell has no calorie meter');
  });

  it('covers every movement used in the corpus', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const { parse } = await import('../src/parse.ts');
    const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/corpus');
    const names = new Set<string>();
    const walk = (n: any) => {
      if (n.node === 'step') names.add(n.movement);
      else if (n.node === 'block') n.children.forEach(walk);
      else if (n.node === 'interrupt') n.body.forEach(walk);
    };
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.wdl'))) {
      parse(readFileSync(join(dir, f), 'utf8')).workout.body.forEach(walk);
    }
    const missing = [...names].filter(Boolean).filter((n) => reg.resolve(n).status !== 'ok');
    eq(missing, []);
  });
});

describe('pluralize: how a name reads for more than one', () => {
  const cases: [string, string][] = [
    ['Thruster', 'Thrusters'],
    ['Pull-Up', 'Pull-Ups'],
    ['Burpee Box Jump-Over', 'Burpee Box Jump-Overs'],   // a trailing particle still takes an s
    ['Bench Press', 'Bench Presses'],
    ['Snatch', 'Snatches'],
    ['Cable Fly', 'Cable Flies'],
    ['Clean & Jerk', 'Clean & Jerks'],
    ['Chest-to-Bar Pull-Up', 'Chest-to-Bar Pull-Ups'],   // the compound is only a modifier
    // The head noun is not always last.
    ['Lateral Burpee over Dumbbell', 'Lateral Burpees over Dumbbell'],
    ['Atlas Stone to Shoulder', 'Atlas Stones to Shoulder'],
    // ...but a preposition right after the first word makes that word a leading
    // modifier, not the head: pluralize the trailing noun instead.
    ['Bent Over Barbell Row', 'Bent Over Barbell Rows'],
    ['Bent Over Row', 'Bent Over Rows'],
    // A prepositional compound is a name in its own right.
    ['Knees-to-Elbow', 'Knees-to-Elbow'],
    ['Toes-to-Bar', 'Toes-to-Bar'],
    ['Ground-to-Overhead', 'Ground-to-Overhead'],
    // A hole is a constraint, not a noun.
    ['? squat', '? squat'],
  ];

  for (const [singular, plural] of cases) {
    it(`${singular} → ${plural}`, () => eq(pluralize(singular), plural));
  }

  it('is idempotent', () => {
    for (const [, plural] of cases) eq(pluralize(plural), plural);
  });

  it('never changes which movement a name resolves to', () => {
    // This is the load-bearing property. Pluralizing is how a name *reads*;
    // if it changed what the name *is*, canonical text would silently point at
    // a different record and every muscle total would move with it.
    const reg = defaultRegistry();
    const canon = canonicalRegistry();
    const id = (r: ReturnType<typeof reg.resolve>) => (r.status === 'ok' ? r.entry.id : r.status);
    // Unregistered on one side and resolved on the other is not a violation:
    // the seed carries `Barbell Step Ups` without its singular, so pluralizing
    // there finds a movement rather than pointing at a different one.
    let checked = 0;
    const split: string[] = [];
    for (const entry of canon.entries) {
      for (const r of [reg, canon]) {
        const a = r.resolve(entry.title), b = r.resolve(pluralize(entry.title));
        if (a.status === 'ok' && b.status === 'ok' && a.entry.id !== b.entry.id) {
          split.push(`${entry.title}: ${a.entry.id} vs ${b.entry.id}`);
        }
      }
      checked++;
    }
    ok(checked > 3000, `${checked} movements`);
    // Any survivor is a singular and a plural still held as two records. Three
    // remain in the long tail — Hindu Push-up, Rack Pull, Squat with Bands —
    // none of which any workout uses. The number is pinned so it cannot quietly
    // grow, and the corpus itself is checked separately and is clean.
    ok(split.length <= 3, `${split.length} movements split by pluralizing:\n  ${split.join('\n  ')}`);
  });
});
