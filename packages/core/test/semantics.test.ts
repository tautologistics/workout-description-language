/**
 * Correctness, not stability. Round-tripping proves the parser and formatter
 * agree with each other; it does not prove either is right. These assertions
 * pin the AST to what the workout actually means.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import type { Block, Step, Rest, Interrupt } from '../src/ast.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/corpus');
const load = (f: string) => parse(readFileSync(join(dir, f), 'utf8')).workout;
const b = (n: unknown) => n as Block;
const s = (n: unknown) => n as Step;

describe('structure', () => {
  it('Fran is a ladder of two movements inside a for-time block', () => {
    const top = b(load('04-fran.wdl').body[0]);
    eq(top.score?.primary, 'time');
    ok(top.score?.implied, 'for time is implied by the header');
    const ladder = b(top.children[0]);
    eq(ladder.type, 'ladder');
    eq(ladder.scheme, [21, 15, 9]);
    eq(ladder.children.map((c) => s(c).movement), ['Thruster', 'Pull-Up']);
  });

  it('Annie descends 50 to 10', () => {
    const ladder = b(b(load('08-annie.wdl').body[0]).children[0]);
    eq(ladder.scheme, [50, 40, 30, 20, 10]);
  });

  it('DT states its load once on the header and inherits it', () => {
    const top = b(load('12-dt.wdl').body[0]);
    eq(top.type, 'repeat');
    eq(top.count, 5);
    eq(top.inherited.length, 1);
    eq(top.inherited[0], { kind: 'load', load: { kind: 'absolute', value: 155, unit: 'lb' } });
    ok(top.children.every((c) => s(c).targets.length === 0), 'no step repeats the load');
  });

  it('Kalsu is an interrupt overlay, not a sequence', () => {
    const top = b(load('17-kalsu.wdl').body[0]);
    eq(s(top.children[0]).quantity, { kind: 'reps', value: 100 });
    const int = top.children[1] as Interrupt;
    eq(int.node, 'interrupt');
    eq(int.every, { kind: 'duration', seconds: 60 });
    eq(s(int.body[0]).movement, 'Burpee');
  });

  it('Murph partitions freely and carries a vest', () => {
    const top = b(load('14-murph.wdl').body[0]);
    eq(top.equipment, ['20lb Vest']);
    const tally = top.children.find((c) => c.node === 'block' && c.type === 'tally') as Block;
    ok(tally, 'has a tally block');
    eq(tally.children.map((c) => s(c).quantity), [
      { kind: 'reps', value: 100 }, { kind: 'reps', value: 200 }, { kind: 'reps', value: 300 },
    ]);
  });

  it('Death by Burpees is unbounded and ascends by one', () => {
    const top = b(load('20-death-by-burpees.wdl').body[0]);
    eq(top.type, 'clock');
    ok(top.untilFailure, 'runs until failure');
    eq(s(top.children[0]).perRound, { delta: 1, unit: 'reps' });
    eq(load('20-death-by-burpees.wdl').score?.primary, 'rounds');
  });

  it('Open 25.1 ascends two of its three movements', () => {
    const top = b(load('24-open-25-1.wdl').body[0]);
    eq(top.type, 'amrap');
    eq(top.children.map((c) => s(c).perRound?.delta ?? null), [3, 3, null]);
  });

  it('the remainder step is a max, not an open step', () => {
    const top = b(load('27-remainder.wdl').body[0]);
    eq(top.type, 'clock');
    eq(top.every, { kind: 'duration', seconds: 180 });
    eq(top.count, 5);
    eq(s(top.children[1]).quantity, { kind: 'max' });
  });

  it('Chelsea ends the workout on overrun', () => {
    const top = b(load('10-chelsea.wdl').body[0]);
    eq(top.onOverrun, 'fail');
    eq(top.duration, { kind: 'duration', seconds: 1800 });
  });

  it('the swim send-off is the same container as an EMOM', () => {
    const swim = b(load('38-swim-send-off.wdl').body[0]);
    const emom = b(load('10-chelsea.wdl').body[0]);
    eq(swim.type, emom.type);
    eq(swim.every, { kind: 'duration', seconds: 105 });
    eq(swim.count, 10);
  });
});

describe('prescriptions', () => {
  it('Linda loads relative to bodyweight', () => {
    const ladder = b(b(load('15-linda.wdl').body[0]).children[0]);
    eq(ladder.children.map((c) => s(c).targets[0]), [
      { kind: 'load', load: { kind: 'multiple', value: 1.5, of: 'BW' } },
      { kind: 'load', load: { kind: 'multiple', value: 1, of: 'BW' } },
      { kind: 'load', load: { kind: 'multiple', value: 0.75, of: 'BW' } },
    ]);
  });

  it('5/3/1 ends on a floor-then-open set', () => {
    const sec = b(load('30-5-3-1-week-1.wdl').body[0]);
    eq(sec.type, 'section');
    eq(sec.children.map((c) => s(c).quantity.kind), ['reps', 'reps', 'floor']);
    eq(s(sec.children[2]).targets[0], { kind: 'load', load: { kind: 'percent', value: 85, of: 'TM' } });
  });

  it('a later block references an earlier one by label', () => {
    const w = load('32-cross-block-reference.wdl');
    eq(b(w.body[0]).label, 'heavy-single');
    eq(s(b(w.body[1]).children[0]).targets[0],
       { kind: 'load', load: { kind: 'percent', value: 85, of: 'heavy-single' } });
  });

  it('the rowing pyramid is a distance scheme with dynamic rest', () => {
    const ladder = b(load('36-rowing-pyramid.wdl').body[0]);
    eq(ladder.type, 'ladder');
    eq(ladder.scheme, [250, 500, 750, 1000, 750, 500, 250]);
    eq(ladder.schemeUnit, 'm');
    eq((ladder.children[1] as Rest).dynamic, 'equal-to-work');
  });

  it('Hyrox carries two implements, not one', () => {
    const carry = b(load('39-hyrox-open.wdl').body[0]).children
      .map(s).find((x) => x.movement === 'Farmers Carry')!;
    eq(carry.targets[0], { kind: 'load', load: { kind: 'absolute', value: 24, unit: 'kg', implements: 2 } });
    eq(carry.quantity, { kind: 'distance', value: 200, unit: 'm' });
  });

  it('Hyrox divisions are variants, not separate workouts', () => {
    const v = load('39-hyrox-open.wdl').variants!;
    eq(Object.keys(v), ['women']);
    eq(v.women['sled-push'], '102kg');
    eq(v.women['wall-ball'], '6kg to 9ft');
  });
});

describe('laterality and teams', () => {
  it('Mary splits pistols across legs', () => {
    const top = b(load('11-mary.wdl').body[0]);
    eq(s(top.children[1]).laterality, 'split');
    eq(s(top.children[1]).quantity, { kind: 'reps', value: 10 });
  });

  it('Open 24.1 selects a side rather than a counting mode', () => {
    const ladder = b(b(load('21-open-24-1.wdl').body[0]).children[0]);
    const snatches = ladder.children.map(s).filter((x) => x.movement === 'DB Snatch');
    eq(snatches.map((x) => x.side), ['first', 'second']);
    ok(snatches.every((x) => x.laterality === undefined), 'a side selector needs no counting mode');
  });

  it('a partner workout shares totals and marks synchronized reps', () => {
    const team = b(load('02-partner-amrap.wdl').body[0]);
    eq(team.type, 'team');
    eq(team.count, 2);
    eq(b(team.children[0]).children.map((c) => s(c).team), ['synchronized', 'shared', 'shared']);
  });
});

describe('scoring', () => {
  it('Barbara scores every round separately', () => {
    eq(load('09-barbara.wdl').score?.perRound, true);
  });

  it('Fight Gone Bad measures calories on a duration-completed step', () => {
    const row = b(load('18-fight-gone-bad.wdl').body[0]).children
      .map(s).find((x) => x.movement === 'Row')!;
    eq(row.quantity, { kind: 'duration', seconds: 60 });
    eq(row.measures, 'calories');
    eq(load('18-fight-gone-bad.wdl').score?.primary, 'reps');
  });

  it('Tabata This aggregates per block and sums across blocks', () => {
    const w = load('19-tabata-this.wdl');
    const seq = b(w.body[0]);
    const rounds = seq.children.filter((c) => c.node === 'block' && c.type === 'repeat') as Block[];
    eq(rounds.length, 5);
    ok(rounds.every((r) => r.score?.aggregate === 'min' && r.score?.perRound), 'each block takes its lowest round');
    eq(w.score?.aggregate, 'sum');
  });

  it('CrossFit Total takes the best of each set of attempts', () => {
    const w = load('33-crossfit-total.wdl');
    const attempts = b(w.body[0]).children as Block[];
    eq(attempts.map((a) => a.type), ['attempts', 'attempts', 'attempts']);
    eq(attempts.map((a) => a.count), [3, 3, 3]);
    ok(attempts.every((a) => a.score?.primary === 'best'), 'each lift scores its best attempt');
    eq(w.score?.aggregate, 'sum');
  });

  it('Open 25.3 records a tiebreak at every wall-walk set', () => {
    const w = load('26-open-25-3.wdl');
    const marked = b(w.body[0]).children.map(s).filter((x) => x.flags.includes('tiebreak'));
    eq(marked.length, 5);
    eq(w.score?.tiebreak, 'checkpoints');
    // `on cap: reps` is the default and no longer written out — stating the
    // default was the only reason the score needed a nested object at all.
    eq(w.score?.onCap, undefined);
  });

  it('a cap is recorded separately from the score', () => {
    eq(b(load('25-open-25-2.wdl').body[0]).cap, { kind: 'duration', seconds: 720 });
  });
});
