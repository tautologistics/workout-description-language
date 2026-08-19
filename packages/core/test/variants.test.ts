/**
 * Divisions — the one namespace an rx split and a `variants:` table share.
 *
 * Two properties, and they are separate on purpose. `divisions`/`resolve` are
 * the *meaning* half: who does this workout offer, and what does it say for
 * them. The round-trip block at the bottom is the *stability* half, and it
 * compares the reparsed step **field by field** rather than text to text —
 * text-fixpoint testing cannot see a formatter branch the grammar does not read,
 * which is what the `)s` defect cost on 2026-08-16.
 */
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { format } from '../src/format.ts';
import { compile } from '../src/timeline.ts';
import { divisions, resolve } from '../src/variants.ts';
import type { Step, Node } from '../src/ast.ts';

const w = (src: string) => parse(src).workout;
const steps = (nodes: Node[]): Step[] => nodes.flatMap((n) =>
  n.node === 'step' ? [n] : n.node === 'block' ? steps(n.children) : []);
const first = (src: string) => steps(w(src).body)[0];
const labels = (src: string): string[] => {
  const out: string[] = [];
  const walk = (n: any) => n.kind === 'group' ? n.items.forEach(walk) : out.push(n.label);
  walk(compile(w(src)).root);
  return out;
};

const SPLIT = 'for time:\n  - 30 Clean & Jerk (women 105lb / men 145lb)';
const TABLE = 'for time:\n  - 21 Thruster @ 95lb\nvariants:\n  scaled:\n    thruster: 65lb';

describe('divisions: one namespace, two spellings', () => {
  it('lists the divisions an rx split names', () => {
    eq(divisions(w(SPLIT)), ['women', 'men']);
  });

  it('lists the divisions a variants table names', () => {
    eq(divisions(w(TABLE)), ['scaled']);
  });

  it('lists both, authored first, without repeating one', () => {
    eq(divisions(w('for time:\n  - 30 Clean & Jerk (women 105lb / men 145lb)'
      + '\nvariants:\n  women:\n    clean-and-jerk: 95lb')), ['women', 'men']);
  });

  it('offers nothing for a workout that states nothing', () => {
    eq(divisions(w('for time:\n  - 21 Thruster @ 95lb')), []);
  });
});

describe('divisions: resolving one', () => {
  it('turns a split into an ordinary load and takes the split away', () => {
    const r = resolve(w(SPLIT), 'women');
    const s = steps(r.workout.body)[0];
    eq(s.targets, [{ kind: 'load', load: { kind: 'absolute', value: 105, unit: 'lb' } }]);
    eq(s.rx, undefined);
    eq(r.diagnostics, []);
  });

  it('reads an unlabelled split by magnitude, not by position', () => {
    const heavier = steps(resolve(w('for time:\n  - 30 Deadlift (105/145)'), 'men').workout.body)[0];
    eq((heavier.targets[0] as any).load.value, 145);
  });

  it('invents no unit where the author wrote none', () => {
    const s = steps(resolve(w('for time:\n  - 30 Deadlift (105/145)'), 'women').workout.body)[0];
    eq((s.targets[0] as any).load, { kind: 'absolute', value: 105 });
  });

  it('applies a movement-keyed load override', () => {
    const s = steps(resolve(w(TABLE), 'scaled').workout.body)[0];
    eq((s.targets[0] as any).load.value, 65);
  });

  it('matches a variant key to a step written in the plural', () => {
    // The Hyrox file's own shape: `wall-ball:` against a step written
    // `100 Wall Balls`. A bare fold missed it and left the men's load in place.
    const src = 'for time:\n  - 100 Wall Balls @ 9kg to 10ft\nvariants:\n  women:\n    wall-ball: 6kg to 9ft';
    const s = steps(resolve(w(src), 'women').workout.body)[0];
    eq(s.targets, [
      { kind: 'load', load: { kind: 'absolute', value: 6, unit: 'kg' } },
      { kind: 'height', value: 9, unit: 'ft' },
    ]);
  });

  it('swaps a movement a variant names', () => {
    const src = 'for time:\n  - 21 Pull-Up\nvariants:\n  scaled:\n    pull-up: Ring Row';
    eq(steps(resolve(w(src), 'scaled').workout.body)[0].movement, 'Ring Row');
  });

  it('leaves a step alone, and says so, when a value reads as neither', () => {
    const src = 'for time:\n  - 21 Thruster @ 95lb\nvariants:\n  scaled:\n    thruster: sideways';
    const r = resolve(w(src), 'scaled');
    eq((steps(r.workout.body)[0].targets[0] as any).load.value, 95);
    eq(r.diagnostics.map((d) => d.code), ['variant-value-unread']);
    eq(r.diagnostics[0].severity, 'note');
  });

  it('leaves a split alone for a division on another axis', () => {
    // Spec §10: division × sex are independent. A step split by sex says
    // nothing about `scaled`, so `scaled` must not consume it.
    const src = SPLIT + '\nvariants:\n  scaled:\n    clean-and-jerk: 65lb';
    const s = steps(resolve(w(src), 'scaled').workout.body)[0];
    ok(s.rx, 'the sex split survives resolving a tier');
    eq((s.targets[0] as any).load.value, 65);
  });

  it('lets an authored entry win over a split on the same step', () => {
    const src = SPLIT + '\nvariants:\n  women:\n    clean-and-jerk: 95lb';
    const s = steps(resolve(w(src), 'women').workout.body)[0];
    eq(s.targets.length, 1);
    eq((s.targets[0] as any).load.value, 95);
  });

  it('errors rather than quietly handing back the workout unchanged', () => {
    const r = resolve(w(SPLIT), 'womens');
    eq(r.diagnostics.map((d) => [d.severity, d.code]), [['error', 'unknown-division']]);
    ok(r.diagnostics[0].message.includes('`women`'), 'names what is on offer');
    eq(r.workout, w(SPLIT));
  });

  it('spends the variants table it resolved', () => {
    eq(resolve(w(TABLE), 'scaled').workout.variants, undefined);
  });
});

describe('divisions: what a step reads as with none chosen', () => {
  it('puts both magnitudes in the cue, labelled, as the file states them', () => {
    eq(labels(SPLIT), ['30 Clean & Jerks (women 105lb / men 145lb)']);
  });

  it('says the same thing the canonical line says', () => {
    // One rendering, two surfaces. These drifted apart for as long as the cue
    // simply had no branch for a split — the load was on the page and not on
    // the board.
    ok(format(w(SPLIT)).includes('(women 105lb / men 145lb)'));
    ok(labels(SPLIT)[0].includes('(women 105lb / men 145lb)'));
  });

  it('reads an ordinary load once a division is chosen', () => {
    const resolved = resolve(w(SPLIT), 'men').workout;
    const out: string[] = [];
    const walk = (n: any) => n.kind === 'group' ? n.items.forEach(walk) : out.push(n.label);
    walk(compile(resolved).root);
    eq(out, ['30 Clean & Jerks @ 145lb']);
  });
});

describe('divisions: the written form survives', () => {
  // Formatting is not resolving. A file stating two divisions still states two
  // after `fmt`, and the comparison is on the *fields* — a formatter branch the
  // grammar cannot read back is invisible to a text comparison.
  const forms = [
    '30 Clean & Jerk (women 105lb / men 145lb)',
    '30 Clean & Jerk (105/145)',
    '21 Deadlift (60/100kg)',
    '30 Clean & Jerk (women 105lb / men 145lb) @ RPE 8',
    '10 Deadlift (105/145), unbroken',
    '10 Deadlift each arm (105/145)',
  ];
  for (const line of forms) {
    it(`reparses field for field: ${line}`, () => {
      const before = first(`for time:\n  - ${line}`);
      const after = first(format(w(`for time:\n  - ${line}`)));
      eq(after.rx, before.rx, 'rx');
      eq(after.targets, before.targets, 'targets');
      eq(after.quantity, before.quantity, 'quantity');
      eq(after.flags, before.flags, 'flags');
      eq(after.laterality, before.laterality, 'laterality');
      eq(after.unknown, before.unknown, 'unknown');
    });
  }
});
