/** Timeline compilation — execution semantics, not syntax. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { compile, type TimelineGroup, type TimelineStep, type TimelineItem } from '../src/timeline.ts';
import { run } from '../src/run.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/corpus');
const tl = (f: string) => compile(parse(readFileSync(join(dir, f), 'utf8')).workout);
const g = (i: TimelineItem) => i as TimelineGroup;
/** Compile a workout written inline, for shapes the corpus does not carry. */
const tl2 = (src: string) => compile(parse(src).workout);
const s = (i: TimelineItem) => i as TimelineStep;

/** First group of a given type, at any depth. */
function findGroup(i: TimelineItem, type: string): TimelineGroup | undefined {
  if (i.kind !== 'group') return undefined;
  if (i.type === type) return i;
  for (const c of i.items) {
    const hit = findGroup(c, type);
    if (hit) return hit;
  }
  return undefined;
}

/** Every step in document order. */
function steps(i: TimelineItem, out: TimelineStep[] = []): TimelineStep[] {
  if (i.kind === 'step') out.push(i);
  else if (i.kind === 'group') {
    for (const c of i.items) steps(c, out);
    for (const c of i.interrupt?.items ?? []) steps(c, out);
  }
  return out;
}

describe('timeline: desugaring', () => {
  it('expands a rep scheme into explicit rounds', () => {
    const ladder = g(g(tl('04-fran.wdl').root.items[0]).items[0]);
    eq(ladder.items.length, 3);
    eq(steps(ladder).map((x) => x.quantity),
       [21, 21, 15, 15, 9, 9].map((value) => ({ kind: 'reps', value })));
  });

  it('pushes a block-level load down onto every step', () => {
    const all = steps(tl('12-dt.wdl').root);
    eq(all.length, 3);
    ok(all.every((x) => x.targets.length === 1), 'each step carries the inherited load');
    eq(all[0].targets[0], { kind: 'load', load: { kind: 'absolute', value: 155, unit: 'lb' } });
  });

  it('resolves +N each round when the round count is bounded', () => {
    const src = '3 rounds:\n  - 3 Burpee, +3 each round';
    const all = steps(compile(parse(src).workout).root);
    eq(all.map((x) => x.quantity), [3, 6, 9].map((value) => ({ kind: 'reps', value })));
  });

  it('retains the rule when the round count is unbounded', () => {
    const all = steps(tl('24-open-25-1.wdl').root);
    eq(all[0].perRound, { delta: 3, unit: 'reps' });
    eq(all[0].quantity, { kind: 'reps', value: 3 });
  });

  it('attaches an interrupt to its enclosing group', () => {
    const top = g(tl('17-kalsu.wdl').root.items[0]);
    eq(top.interrupt!.every, 60);
    eq(s(top.interrupt!.items[0]).movement, 'Burpees');
    eq(top.items.length, 1, 'the interrupt is not a sibling step');
  });

  it('turns a work block into a timed step', () => {
    // Singular: a `work 20s` step is a duration, and only a rep count pluralizes.
    const all = steps(tl('19-tabata-this.wdl').root).filter((x) => x.movement === 'Pull-Up');
    eq(all[0].pacing, 'timed');
    eq(all[0].seconds, 20);
  });
});

describe('timeline: pacing', () => {
  it('classifies duration steps as timed', () => {
    ok(steps(tl('18-fight-gone-bad.wdl').root).every((x) => x.pacing === 'timed'));
  });

  it('classifies rep and distance steps as athlete-paced', () => {
    ok(steps(tl('39-hyrox-open.wdl').root).every((x) => x.pacing === 'athlete'));
  });

  it('classifies steps inside a window as capped', () => {
    ok(steps(tl('24-open-25-1.wdl').root).every((x) => x.pacing === 'capped'));
    ok(steps(tl('25-open-25-2.wdl').root).every((x) => x.pacing === 'capped'));
  });

  it('treats a remainder step as timed', () => {
    const all = steps(tl('27-remainder.wdl').root);
    eq(all.map((x) => x.pacing), ['athlete', 'timed']);
  });
});

describe('timeline: duration', () => {
  it('stops a trailing rest firing after the final round', () => {
    // 3 rounds x (5x1min + 1min rest) is 18 minutes counted naively;
    // Fight Gone Bad is 17, because the last rest is not taken.
    eq(tl('18-fight-gone-bad.wdl').estimatedSeconds, 17 * 60);
  });

  it('keeps interval rest structural, so a Tabata block is exactly 4:00', () => {
    // 5 blocks x 4min + 4 x 1min rest between exercises.
    eq(tl('19-tabata-this.wdl').estimatedSeconds, 24 * 60);
  });

  it('sums nested endurance intervals', () => {
    // 10min warmup + 4 x (8 + 4) + 10min cooldown
    eq(tl('37-bike-intervals.wdl').estimatedSeconds, 68 * 60);
  });

  it('uses the window for an AMRAP', () => {
    eq(tl('05-cindy.wdl').estimatedSeconds, 20 * 60);
    eq(tl('24-open-25-1.wdl').estimatedSeconds, 15 * 60);
  });

  it('does not read a cap over athlete-paced work as a length', () => {
    // `for time, cap 12min:` says *at most* twelve minutes. An athlete who
    // finishes Open 25.2 in eight took eight, so the workout has no known
    // length — the twelve is a bound and is carried as one.
    eq(tl('25-open-25-2.wdl').estimatedSeconds, undefined);
    eq(tl('25-open-25-2.wdl').cap, 12 * 60);
    eq(tl('26-open-25-3.wdl').estimatedSeconds, undefined);
    eq(tl('26-open-25-3.wdl').cap, 20 * 60);
  });

  it('reads a cap as a length where the work runs until the clock stops', () => {
    // Tiff is a run and then a bare `AMRAP:`, which takes whatever is left of
    // the cap (spec §5.6) — so the block ends *at* twenty-five minutes rather
    // than merely by then, and that is a duration.
    eq(tl('77-tiff.wdl').estimatedSeconds, 25 * 60);
    eq(tl('77-tiff.wdl').cap, 25 * 60);
  });

  it('lets a cap truncate work that is entirely on the clock', () => {
    // Nothing here is athlete-paced, so the length is known either way; the cap
    // is the shorter of the two and the wall clock stops there.
    eq(tl2('for time, cap 5min:\n  - 4min Row\n  - 4min Bike').estimatedSeconds, 5 * 60);
    eq(tl2('for time, cap 20min:\n  - 4min Row\n  - 4min Bike').estimatedSeconds, 8 * 60);
  });

  it('does not let a cap on one section speak for the workout', () => {
    // The same rule `run` applies to a window: a capped section between two
    // others caps that section and says nothing about the whole.
    const t = tl2('sequence:\n  - 10min Row\nfor time, cap 5min:\n  - 50 Burpees');
    eq(t.cap, undefined);
    eq(t.estimatedSeconds, undefined);
  });

  it('reports athlete-paced when nothing bounds the work', () => {
    eq(tl('04-fran.wdl').estimatedSeconds, undefined);
    eq(tl('39-hyrox-open.wdl').estimatedSeconds, undefined);
  });
});

describe('timeline: what cannot be a timeline', () => {
  it('warns that a tally block has no prescribed order', () => {
    const t = tl('14-murph.wdl');
    ok(t.warnings.some((w) => /no prescribed order/.test(w)), t.warnings.join('; '));
    const tally = findGroup(t.root, 'tally')!;
    ok(tally?.freeOrder, 'the group is marked free-order');
    eq(tally.items.length, 3, 'the three totals survive');
  });

  it('warns that an unbounded repeat has no known round count', () => {
    const t = tl('20-death-by-burpees.wdl');
    ok(t.warnings.some((w) => /not known until execution/.test(w)), t.warnings.join('; '));
    eq(t.estimatedSeconds, undefined);
  });

  it('carries overrun behaviour through to the runtime', () => {
    eq(g(tl('10-chelsea.wdl').root.items[0]).onOverrun, 'fail');
    eq(g(tl('28-e2mom-alternating.wdl').root.items[0]).onOverrun, 'carry');
  });

  it('preserves team size for shared-total arithmetic', () => {
    eq(g(tl('02-partner-amrap.wdl').root.items[0]).teamSize, 2);
  });
});

describe('timeline: whole corpus', () => {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.wdl')).sort()) {
    it(f, () => {
      const t = tl(f);
      ok(t.root.items.length > 0, 'compiled to nothing');
      for (const st of steps(t.root)) {
        ok(st.label.trim().length > 0, 'every step needs a display label');
        ok(['timed', 'athlete', 'capped'].includes(st.pacing), `bad pacing ${st.pacing}`);
      }
    });
  }
});

describe('run: what repeats, and what does not', () => {
  const laid = (src: string) => run(compile(parse(src).workout));
  const BUY_IN = 'For time:\n  - 1600m Run\n  AMRAP 20min:\n'
    + '    - 30 Air Squats\n    - 10 Box Jumps\n  - 30cal Row\n';

  it('does not put a buy-in and a buy-out on the AMRAP’s clock', () => {
    // Hoisting the window from anywhere reported this as a seven-cue loop on a
    // 20-minute clock: neither the number of cues that repeat, nor a clock the
    // run and the row are on.
    const r = laid(BUY_IN);
    eq(r.cues.length, 4);
    eq(r.loops, false, 'the workout does not loop; a section of it does');
    eq(r.window, undefined, 'no clock bounds the whole of it');
  });

  it('names the section that does come round again', () => {
    const r = laid(BUY_IN);
    eq(r.cycles.length, 1);
    eq([r.cycles[0].from, r.cycles[0].to], [1, 3], 'the middle two cues');
    eq(r.cycles[0].window, 1200);
  });

  it('still reads a workout that is entirely an AMRAP as one', () => {
    const r = laid('AMRAP 20min:\n  - 30 Air Squats\n  - 10 Box Jumps\n');
    eq(r.loops, true);
    eq(r.window, 1200);
    eq([r.cycles[0].from, r.cycles[0].to], [0, 2], 'covering every cue');
  });

  it('reports no cycle where nothing repeats', () => {
    eq(laid('for time:\n  - 21 Thrusters\n  - 21 Pull-Ups\n').cycles, []);
  });

  it('sees a bounded repeat as bounded, not as a cycle', () => {
    const r = laid('5 rounds:\n  - 10 Push-Ups\n');
    eq(r.cycles, [], 'five rounds is five rounds, not "until you stop"');
    eq(r.loops, false);
    eq(r.cues.length, 5);
  });
});
