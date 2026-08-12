/**
 * The muscle attribution layer.
 *
 * These checks are about the mechanism, not the physiology: that the vocabulary
 * is closed, that adjacency includes the wrap a repeat creates, that rounds are
 * counted, and that a movement nobody has heard of is reported rather than
 * silently dropped. Whether the Thruster really works the calves is a question
 * for the sources, and `support` is what answers it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { compile } from '../src/timeline.ts';
import { muscles, musclesFor, exposures, adjacent, muscleLoad } from '../src/muscles.ts';
import { canonicalRegistry } from '../src/registry.ts';

const t = (src: string) => compile(parse(src).workout);
const corpus = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/corpus');

describe('muscle vocabulary', () => {
  it('is closed: every muscle in the corpus is a declared one', () => {
    const known = muscles();
    const leaked = new Set<string>();
    for (const e of canonicalRegistry().entries) {
      for (const m of [...(e.muscles?.primary ?? []), ...(e.muscles?.secondary ?? [])]) {
        if (!known.has(m)) leaked.add(m);
      }
    }
    eq([...leaked], [], 'names not in registry/muscles.json');
  });

  it('gives every muscle a region', () => {
    for (const m of muscles().values()) {
      ok(['upper', 'core', 'lower'].includes(m.region), `${m.id} has region "${m.region}"`);
    }
  });

  it('does not let a catalogue overrule a curated primary', () => {
    // wger has the Back Extension working the lats and chest. It is wrong, and a
    // wrong primary is what sequencing rules read.
    const a = musclesFor('Back Extension')!;
    eq(a.primary, ['erectors', 'glutes', 'hamstrings']);
    ok(a.secondary.includes('chest'), 'the claim is demoted, not discarded');
  });

  it('reports nothing for a movement no source knows', () => {
    eq(musclesFor('Interpretive Dance'), undefined);
  });

  it('clamps minSupport to the number of sources that spoke', () => {
    // Nothing outside CrossFit has heard of a bar-facing burpee. Demanding two
    // opinions must not delete the movement for having only one to give.
    const one = musclesFor('Bar-Facing Burpee', { minSupport: 1 });
    const two = musclesFor('Bar-Facing Burpee', { minSupport: 2 });
    eq(two, one);
  });

  it('drops single-source claims when corroboration exists and is demanded', () => {
    // Garmin alone has the Thruster working the chest, calves and hamstrings.
    const all = musclesFor('Thruster')!;
    const agreed = musclesFor('Thruster', { minSupport: 2 })!;
    ok(all.secondary.includes('chest'), 'one source claims it');
    ok(!agreed.secondary.includes('chest'), 'no second source does');
    eq(agreed.primary, all.primary, 'the primaries are curated and stand either way');
  });
});

describe('exposures: what is worked, in order', () => {
  it('reads a couplet in written order', () => {
    const { list } = exposures(t('21-15-9:\n  - Thruster @ 95lb\n  - Pull-Up'));
    eq(list.map((e) => e.movement), ['Thruster', 'Pull-Up', 'Thruster', 'Pull-Up', 'Thruster', 'Pull-Up']);
    eq(list[1].primary, ['biceps', 'lats']);
  });

  it('names the movements it could not attribute', () => {
    const { list, unresolved } = exposures(t('sequence:\n  - 10 Interpretive Dance'));
    eq(unresolved, ['Interpretive Dance']);
    ok(list[0].unattributed, 'the step is still in the list, flagged');
    eq(list[0].primary, []);
  });

  it('marks a repeating group so its end is known to abut its start', () => {
    const { list } = exposures(t('5 rounds:\n  - 10 Push-Up\n  - 10 Air Squat'));
    ok(list.every((e) => e.cycle), 'both steps are inside the repeat');
    eq(list[0].cycle?.rounds, 5);
  });

  it('does not sequence a tally block, which has no order', () => {
    const { list } = exposures(t('any order:\n  - 100 Push-Up\n  - 100 Air Squat'));
    eq(list.length, 2);
    ok(list.every((e) => !e.cycle), 'nothing in a tally is adjacent to anything');
  });
});

describe('adjacency', () => {
  const primaryClash = (src: string) => {
    const { list } = exposures(t(src));
    return adjacent(list)
      .map(([a, b]) => [a.movement, b.movement, a.primary.filter((m) => b.primary.includes(m))] as const)
      .filter(([, , shared]) => shared.length);
  };

  it('finds the same muscle in consecutive steps', () => {
    const clash = primaryClash('sequence:\n  - 10 Air Squat\n  - 10 Front Squat\n  - 10 Push-Up');
    eq(clash.length, 1);
    eq(clash[0][0], 'Air Squat');
    eq(clash[0][1], 'Front Squat');
  });

  it('catches the clash a repeat creates between the last step and the first', () => {
    // Read as a flat list this passes: squat, push-up, squat, push-up. Read as
    // five rounds, the push-up is followed by another squat every time.
    const flat = primaryClash('sequence:\n  - 10 Air Squat\n  - 10 Push-Up\n  - 10 Handstand Push-Up');
    eq(flat.map((c) => [c[0], c[1]]), [['Push-Up', 'Handstand Push-Up']]);
    const looped = primaryClash('5 rounds:\n  - 10 Push-Up\n  - 10 Handstand Push-Up');
    eq(looped.map((c) => [c[0], c[1]]), [
      ['Push-Up', 'Handstand Push-Up'],
      ['Handstand Push-Up', 'Push-Up'],
    ]);
  });

  it('does not invent a wrap for a group that runs once', () => {
    const { list } = exposures(t('sequence:\n  - 10 Push-Up\n  - 10 Air Squat'));
    eq(adjacent(list).length, 1);
  });
});

describe('muscle load', () => {
  it('counts rounds', () => {
    const one = muscleLoad(t('sequence:\n  - 10 Air Squat'));
    const five = muscleLoad(t('5 rounds:\n  - 10 Air Squat'));
    eq(one.byMuscle.quads.primary.reps, 10);
    eq(five.byMuscle.quads.primary.reps, 50);
  });

  it('keeps primary and secondary work apart', () => {
    const load = muscleLoad(t('sequence:\n  - 30 Pull-Up'));
    eq(load.byMuscle.lats.primary.reps, 30);
    eq(load.byMuscle.lats.secondary.reps, 0);
    eq(load.byMuscle.forearms.primary.reps, 0);
    eq(load.byMuscle.forearms.secondary.reps, 30);
  });

  it('reports a total that cannot be known as a floor', () => {
    const load = muscleLoad(t('AMRAP 20min:\n  - 10 Air Squat'));
    ok(load.unbounded, 'an AMRAP has no fixed rep count');
    eq(load.byMuscle.quads.primary.reps, 10, 'one pass through the contents');
  });

  it('rolls up by region, counting each muscle in it', () => {
    const load = muscleLoad(t('sequence:\n  - 10 Air Squat'));
    const lower = Object.values(load.byMuscle).filter((m) => m.region === 'lower');
    ok(lower.length > 1, 'a squat works more than one muscle below the waist');
    eq(load.byRegion.lower.reps, 10 * lower.length);
  });

  it('measures a run in metres, not reps', () => {
    const load = muscleLoad(t('sequence:\n  - 400m Run'));
    eq(load.byMuscle.quads.primary.reps, 0);
    ok(load.byMuscle.quads.primary.distanceM === 400, 'distance is the dimension it is measured in');
  });
});

describe('the corpus is attributable', () => {
  it('resolves every movement in every corpus workout to muscles', () => {
    const missing = new Set<string>();
    for (const f of readdirSync(corpus).filter((x) => x.endsWith('.wdl'))) {
      const { unresolved } = exposures(t(readFileSync(join(corpus, f), 'utf8')));
      for (const m of unresolved) missing.add(m);
    }
    eq([...missing].sort(), [], 'movements with no muscle data');
  });
});
