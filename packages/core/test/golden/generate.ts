/**
 * Regenerate the interpretation snapshot. Run deliberately, then read the diff:
 *   node test/golden/generate.ts
 *
 * The snapshot is a compact digest of how every corpus file is *understood* —
 * structure, totals, pacing, duration, and what it works. Hand-written
 * assertions in truth.test.ts cover the well-known workouts against outside
 * fact; this covers the rest, so a change in interpretation anywhere shows up
 * as a reviewable diff rather than silently passing a round-trip.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// The host, first: `parse` runs `spec/grammar-0.1.ohm` and `src/` opens no
// files, so a regenerator run on its own has to hand the grammar over.
import '../../node.ts';
import { parse } from '../../src/parse.ts';
import { compile, type TimelineItem } from '../../src/timeline.ts';
import { volume } from '../../src/volume.ts';
import { muscleLoad } from '../../src/muscles.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const CORPUS = join(here, '../../../../examples/corpus');

/** A one-line shape of the compiled structure, e.g. `repeatx5[step,step,rest]`. */
function shape(i: TimelineItem): string {
  if (i.kind === 'step') return 'step';
  if (i.kind === 'rest') return 'rest';
  const n = i.rounds !== undefined ? `x${i.rounds}` : i.untilFailure ? 'x?' : '';
  const w = i.window !== undefined ? `@${i.window}s` : '';
  const ib = i.interrupt
    ? (i.interrupt.untilFailure ? 'x?' : i.interrupt.count !== undefined ? `x${i.interrupt.count}`
        : i.interrupt.window !== undefined ? `@${i.interrupt.window}s` : '')
    : '';
  return `${i.type}${n}${w}[${i.items.map(shape).join(',')}]` +
    (i.interrupt ? `+every${i.interrupt.every}s${ib}[${i.interrupt.items.map(shape).join(',')}]` : '');
}

export function digest(src: string) {
  const { workout, errors } = parse(src);
  const t = compile(workout);
  const v = volume(t);
  const pacing: Record<string, number> = {};
  const count = (i: TimelineItem) => {
    if (i.kind === 'step') pacing[i.pacing] = (pacing[i.pacing] ?? 0) + 1;
    else if (i.kind === 'group') { i.items.forEach(count); (i.interrupt?.items ?? []).forEach(count); }
  };
  count(t.root);
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    errors: errors.map((e) => e.message),
    shape: shape(t.root),
    seconds: t.estimatedSeconds ?? null,
    // Recorded beside the length rather than instead of it: a cap is what the
    // workout may take, and the two are the same number only where the work
    // runs until the clock stops (spec §5.6).
    cap: t.cap ?? null,
    pacing,
    unbounded: v.unbounded,
    totals: { reps: v.totals.reps, distanceM: r(v.totals.distanceM),
              calories: v.totals.calories, seconds: v.totals.seconds },
    movements: Object.fromEntries(Object.entries(v.byMovement)
      .map(([k, m]) => [k, [m.reps, r(m.distanceM), m.calories, m.seconds]])
      .filter(([, a]) => (a as number[]).some(Boolean))),
    // What the workout works, which is the one thing here that a *registry*
    // change can move. Everything above is a property of the text; muscles are
    // a property of the record the text resolves into, so a merge that changes
    // which record a name points at moves this and nothing else. Leaving it out
    // made "the goldens regenerated clean" true and meaningless after a merge —
    // see docs/context/topics/lessons-learned.md.
    //
    // Per muscle: exposures, then the same four amounts as `movements` twice —
    // once for the steps it drives, once for the steps it assists. The two are
    // kept apart because a merge can move a muscle between them without moving
    // a number, and combining them behind a weighting would hide that.
    muscles: Object.fromEntries(Object.entries(muscleLoad(t).byMuscle)
      .map(([k, m]) => [k, [m.exposures,
        m.primary.reps, r(m.primary.distanceM), m.primary.calories, m.primary.seconds,
        m.secondary.reps, r(m.secondary.distanceM), m.secondary.calories, m.secondary.seconds]])),
    warnings: t.warnings.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out: Record<string, unknown> = {};
  for (const f of readdirSync(CORPUS).filter((x) => x.endsWith('.wdl')).sort()) {
    out[f] = digest(readFileSync(join(CORPUS, f), 'utf8'));
  }
  writeFileSync(join(here, 'interpretations.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(`snapshot written for ${Object.keys(out).length} files`);
}
