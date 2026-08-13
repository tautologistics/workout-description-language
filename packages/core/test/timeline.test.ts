/** Timeline compilation — execution semantics, not syntax. */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { parse } from '../src/parse.ts';
import { compile, type TimelineGroup, type TimelineStep, type TimelineItem } from '../src/timeline.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/corpus');
const tl = (f: string) => compile(parse(readFileSync(join(dir, f), 'utf8')).workout);
const g = (i: TimelineItem) => i as TimelineGroup;
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

  it('bounds an athlete-paced workout by its cap', () => {
    eq(tl('25-open-25-2.wdl').estimatedSeconds, 12 * 60);
    eq(tl('26-open-25-3.wdl').estimatedSeconds, 20 * 60);
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
