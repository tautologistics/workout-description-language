/**
 * Regenerate the interpretation snapshot. Run deliberately, then read the diff:
 *   node test/golden/generate.ts
 *
 * The snapshot is a compact digest of how every corpus file is *understood* —
 * structure, totals, pacing, duration. Hand-written assertions in truth.test.ts
 * cover the well-known workouts against outside fact; this covers the rest, so
 * a change in interpretation anywhere shows up as a reviewable diff rather than
 * silently passing a round-trip.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../src/parse.ts';
import { compile, type TimelineItem } from '../../src/timeline.ts';
import { volume } from '../../src/volume.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const CORPUS = join(here, '../../../../examples/corpus');

/** A one-line shape of the compiled structure, e.g. `repeatx5[step,step,rest]`. */
function shape(i: TimelineItem): string {
  if (i.kind === 'step') return 'step';
  if (i.kind === 'rest') return 'rest';
  const n = i.rounds !== undefined ? `x${i.rounds}` : i.untilFailure ? 'x?' : '';
  const w = i.window !== undefined ? `@${i.window}s` : '';
  return `${i.type}${n}${w}[${i.items.map(shape).join(',')}]` +
    (i.interrupt ? `+every${i.interrupt.every}s[${i.interrupt.items.map(shape).join(',')}]` : '');
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
    pacing,
    unbounded: v.unbounded,
    totals: { reps: v.totals.reps, distanceM: r(v.totals.distanceM),
              calories: v.totals.calories, seconds: v.totals.seconds },
    movements: Object.fromEntries(Object.entries(v.byMovement)
      .map(([k, m]) => [k, [m.reps, r(m.distanceM), m.calories, m.seconds]])
      .filter(([, a]) => (a as number[]).some(Boolean))),
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
