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
   * was withdrawn. The verdicts are per pair in docs/context/known-debts.md.
   *
   * Both survivors are `Bike`, and they are one finding rather than two: `Bike`
   * is a *modality* — a curated lump over the erg, the fan bike and the road —
   * and absorbing one machine into it spreads that machine's muscles across all
   * of them. Merging `Assault Bike` put Garmin's chest claim on six cycling
   * workouts, a 40km ride among them. `Air Bike` is worse: that record is
   * itself a false merge of Garmin's fan bike with free-exercise-db's bicycle
   * crunch. Both aliases are correct English and stay; the collision is the
   * price of a lump the registry cannot express, and is pinned rather than
   * argued away.
   *
   * Pinned exactly rather than bounded, so a merge that lands fails here as
   * stale instead of leaving a loose ceiling nobody tightens.
   */
  it('has only the known alias collisions in the canonical corpus', () => {
    eq(canonicalRegistry().validate(), [
      'alias "airbike" maps to air-bike, bike',
      'alias "assaultbike" maps to assault-bike, bike',
    ]);
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
