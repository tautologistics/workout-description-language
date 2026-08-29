/**
 * The builder's "what can this block header take next" affordance is derived
 * from `spec/grammar-0.1.ohm`, and this file is what keeps the derivation
 * honest: the moment the grammar grows a `blockModifier_*` case with no
 * annotation, or an annotation names a rule the grammar dropped, or an
 * annotation's "already present" probe uses a word the rule cannot match, one
 * of these fails. That is the difference between this and the hand-maintained
 * modifier table `docs/context/topics/deliberately-not-done.md` rejects.
 */
import { describe, it, eq, ok } from './lib.ts';
import { wdl } from '../src/grammar/parser.ts';
import {
  blockModifierOptions, blockKindCompletions, affordanceCoverage,
} from '../src/block-affordances.ts';

const g = wdl().grammar;

describe('block affordances — grammar coverage', () => {
  it('every blockModifier_* case is annotated, and no annotation is stale', () => {
    const { unannotatedModifiers, staleKeys } = affordanceCoverage(g);
    eq(unannotatedModifiers, [], 'grammar has blockModifier cases with no entry in block-affordances.ts');
    eq(staleKeys, [], 'block-affordances.ts names rules the grammar no longer has');
  });

  it('every "already present" probe uses words its grammar rule actually matches', () => {
    eq(affordanceCoverage(g).badProbes, []);
  });

  it('every kind completion offers the quantity its grammar rule requires', () => {
    eq(affordanceCoverage(g).kindsWithoutDuration, []);
  });

  it('the modifier set matches the grammar, case for case', () => {
    const fromGrammar = Object.keys(g.rules)
      .filter((r) => /^blockModifier_[a-z]/i.test(r))
      .filter((r) => !['blockModifier_kind', 'blockModifier_unknown'].includes(r))
      .sort();
    const offered = blockModifierOptions(g).map((o) => o.rule).sort();
    eq(offered, fromGrammar);
  });
});

describe('block affordances — modifier options', () => {
  const byRule = Object.fromEntries(blockModifierOptions(g).map((o) => [o.rule, o]));

  it('each default is a grammatically valid comma modifier on its own', () => {
    for (const o of blockModifierOptions(g)) {
      const m = g.match(`AMRAP 12min, ${o.insert}`, 'blockHeader');
      ok(m.succeeded(), `"AMRAP 12min, ${o.insert}" should parse — ${o.rule}`);
    }
  });

  it('cap / for time / label / wearing / overrun are recognised as already present', () => {
    ok(byRule.blockModifier_cap.present!('for time, cap 12min'));
    ok(!byRule.blockModifier_cap.present!('AMRAP 12min'));
    ok(byRule.blockModifier_forTime.present!('5 rounds for time'));
    ok(byRule.blockModifier_label.present!('3 rounds, as the-ladder'));
    ok(byRule.blockModifier_wearing.present!('for time, wearing a vest'));
    ok(byRule.blockModifier_overrun.present!('AMRAP 12min, cut on overrun'));
  });

  it('the flag option lists the grammar’s block flags', () => {
    const flag = byRule.blockModifier_flag;
    for (const word of ['building', 'unbroken', 'synchronized', 'shared']) {
      ok(flag.label.includes(word), `flag label should mention ${word}`);
    }
  });
});

describe('block affordances — kind completions', () => {
  const byRule = Object.fromEntries(blockKindCompletions(g).map((c) => [c.rule, c]));

  it('AMRAP, EMOM, every and work name themselves and nothing else', () => {
    ok(byRule.blockKind_amrap.head.test('AMRAP'));
    ok(byRule.blockKind_emom.head.test('EMOM'));
    ok(byRule.blockKind_emom.head.test('E2MOM'));
    ok(byRule.blockKind_every.head.test('every'));
    ok(byRule.blockKind_work.head.test('work'));
    ok(!byRule.blockKind_amrap.head.test('amraps'), 'anchored, not a prefix match');
    ok(!byRule.blockKind_emom.head.test('every'), 'EMOM matcher must not catch every');
  });

  it('splicing a completion’s default after the kind word yields a header the grammar reads', () => {
    for (const [head, rule] of [['AMRAP', 'blockKind_amrap'], ['EMOM', 'blockKind_emom'],
      ['every', 'blockKind_every'], ['work', 'blockKind_work']] as const) {
      const c = byRule[rule];
      const m = g.match(`${head} ${c.insert}`, 'blockHeader');
      ok(m.succeeded(), `"${head} ${c.insert}" should parse — ${rule}`);
    }
  });
});
