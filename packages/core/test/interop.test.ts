/**
 * Cross-format oracle.
 *
 * A `.zwo` file states every segment's duration explicitly, so the workout's
 * total can be summed straight off the XML by a computation that shares no code
 * with the parser, the AST, or the timeline compiler. Agreement between the two
 * is evidence the interpretation is right, not merely self-consistent — and the
 * files were written by other people for another tool, so nothing about them
 * was shaped to suit this codebase.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq, ok } from './lib.ts';
import { importZwo, zwoDurationSeconds } from '../src/adapters/zwo.ts';
import { parse } from '../src/parse.ts';
import { format } from '../src/format.ts';
import { compile } from '../src/timeline.ts';
import { validate } from '../src/validate.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/interop/zwo');
const files = readdirSync(dir).filter((f) => f.endsWith('.zwo')).sort();

describe('zwo import: duration oracle', () => {
  for (const f of files) {
    it(f.replace(/\.zwo$/, ''), () => {
      const xml = readFileSync(join(dir, f), 'utf8');
      eq(compile(importZwo(xml)).estimatedSeconds, zwoDurationSeconds(xml));
    });
  }
});

describe('zwo import: full pipeline', () => {
  it('survives a trip out to WDL text and back', () => {
    // XML -> AST -> canonical WDL -> parse -> compile must still total the same.
    for (const f of files) {
      const xml = readFileSync(join(dir, f), 'utf8');
      const reparsed = parse(format(importZwo(xml)));
      eq(reparsed.errors.map((e) => e.message), [], f);
      eq(compile(reparsed.workout).estimatedSeconds, zwoDurationSeconds(xml), f);
    }
  });

  it('produces workouts that validate clean', () => {
    for (const f of files) {
      const w = parse(format(importZwo(readFileSync(join(dir, f), 'utf8')))).workout;
      eq(validate(w).filter((d) => d.severity === 'error').map((d) => d.message), [], f);
    }
  });

  it('carries power targets through as percentages of FTP', () => {
    const w = importZwo(readFileSync(join(dir, '15x1x2.zwo'), 'utf8'));
    const steps = w.body.filter((n) => n.node === 'step') as any[];
    ok(steps.length > 10, 'imported the segments');
    eq(steps[1].targets[0], { kind: 'power', text: '125% FTP' });
    ok(steps[0].notes[0].startsWith('ramp '), 'a warmup becomes a ramp');
  });

  it('classifies every imported step as timed', () => {
    const t = compile(importZwo(readFileSync(join(dir, files[0]), 'utf8')));
    const walk = (i: any): string[] =>
      i.kind === 'step' ? [i.pacing] : i.kind === 'group' ? i.items.flatMap(walk) : [];
    ok(walk(t.root).every((p) => p === 'timed'), 'endurance segments are clock-paced');
  });
});

// ---------------------------------------------------------------------------

/**
 * Sheiko #29 — a percentage-based powerlifting block, and the strength-side
 * oracle the suite was missing. Sheiko's own notation states every set, so the
 * number of lifts is arithmetic over the source text, computed without touching
 * the parser. Sheiko counts only work at or above 50% on the competition lifts,
 * which is a published convention rather than one of ours.
 */
import { parseSheiko } from '../../../examples/interop/sheiko/generate.ts';
import { volume, atOrAbove } from '../src/volume.ts';

const sheikoDir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/interop/sheiko');
const sheiko = JSON.parse(readFileSync(join(sheikoDir, 'sheiko-29.json'), 'utf8')) as {
  program: string;
  competitionLifts: string[];
  days: { id: string; exercises: { movement: string; sets: string }[] }[];
};

/** Number of lifts straight from Sheiko notation — no WDL involved. */
function liftsFromNotation(day: typeof sheiko.days[number], competitionOnly: boolean): number {
  let n = 0;
  for (const ex of day.exercises) {
    const isComp = sheiko.competitionLifts.some((c) => ex.movement.endsWith(c));
    for (const s of parseSheiko(ex.sets)) {
      const pct = s.load.endsWith('%') ? Number(s.load.slice(0, -1)) : null;
      if (competitionOnly && (!isComp || pct === null || pct < 50)) continue;
      n += s.reps * s.sets;
    }
  }
  return n;
}

function repsFromWdl(id: string, competitionOnly: boolean): number {
  // Sheiko's rule has two halves: a competition lift *and* a percentage load at
  // or above 50%. Movement name alone is not enough — "Dumbbell Bench Press"
  // contains "Bench Press" but is accessory work prescribed in pounds.
  const t = compile(parse(readFileSync(join(sheikoDir, `${id}.wdl`), 'utf8')).workout);
  const v = volume(t, competitionOnly ? atOrAbove(50) : undefined);
  return Object.entries(v.byMovement)
    .filter(([m]) => !competitionOnly || sheiko.competitionLifts.some((c) => m.endsWith(c)))
    .reduce((sum, [, m]) => sum + m.reps, 0);
}

describe('sheiko: number of lifts', () => {
  for (const day of sheiko.days) {
    it(`${day.id} — competition lifts`, () => {
      eq(repsFromWdl(day.id, true), liftsFromNotation(day, true));
    });
  }

  it('every set is accounted for, accessories included', () => {
    for (const day of sheiko.days) {
      eq(repsFromWdl(day.id, false), liftsFromNotation(day, false), day.id);
    }
  });

  it('the block lands in Sheiko\'s published volume range', () => {
    // Sheiko #29 is documented at roughly 200-400 competition lifts per week.
    const perWeek = [1, 2, 3, 4].map((w) =>
      sheiko.days.filter((d) => d.id.startsWith(`w${w}`))
        .reduce((n, d) => n + liftsFromNotation(d, true), 0));
    for (const n of perWeek) ok(n >= 200 && n <= 400, `week total ${n} outside 200-400`);
    // and the parser must agree with that count, week by week
    const parsed = [1, 2, 3, 4].map((w) =>
      sheiko.days.filter((d) => d.id.startsWith(`w${w}`))
        .reduce((n, d) => n + repsFromWdl(d.id, true), 0));
    eq(parsed, perWeek);
  });
});

describe('sheiko: percentage waves', () => {
  it('reads every load as a percentage of 1RM', () => {
    const w = parse(readFileSync(join(sheikoDir, 'w1d1.wdl'), 'utf8')).workout;
    const steps = (w.body[0] as any).children.filter((c: any) => c.node === 'step');
    const pcts = steps.map((s: any) => s.targets[0]?.load)
      .filter((l: any) => l?.kind === 'percent');
    ok(pcts.length > 8, 'the wave survived');
    ok(pcts.every((l: any) => l.of === '1RM'), 'every percentage names its reference');
  });

  it('validates clean — no unknown references, no missing maxes', () => {
    for (const day of sheiko.days) {
      const w = parse(readFileSync(join(sheikoDir, `${day.id}.wdl`), 'utf8')).workout;
      eq(validate(w).filter((d) => d.severity === 'error').map((d) => d.message), [], day.id);
    }
  });

  it('round-trips the compact sets form', () => {
    const src = 'strength:\n  - 3 Bench Press @ 80% 1RM x5';
    eq(format(parse(src).workout).trim(), src);
    eq(volume(compile(parse(src).workout)).totals.reps, 15);
  });
});

// ---------------------------------------------------------------------------

import { importErg, ergDurationSeconds } from '../src/adapters/erg.ts';
import { importFit, readFit, fitStepCounts } from '../src/adapters/fit.ts';

const ergDir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/interop/erg');
const ergFiles = readdirSync(ergDir).filter((f) => /\.(erg|mrc)$/i.test(f)).sort();

describe('erg/mrc import', () => {
  it('total duration equals the final breakpoint in the file', () => {
    // A course is a list of (minute, target) pairs, so the workout's length is
    // literally the last timestamp — no interpretation needed to read it.
    for (const f of ergFiles) {
      const text = readFileSync(join(ergDir, f), 'utf8');
      eq(compile(importErg(text)).estimatedSeconds, ergDurationSeconds(text), f);
    }
  });

  it('survives a trip out to WDL text and back', () => {
    for (const f of ergFiles) {
      const text = readFileSync(join(ergDir, f), 'utf8');
      const again = parse(format(importErg(text)));
      eq(again.errors.map((e) => e.message), [], f);
      eq(compile(again.workout).estimatedSeconds, ergDurationSeconds(text), f);
    }
  });

  it('reads .mrc as percentages and .erg as watts', () => {
    for (const f of ergFiles) {
      const w = importErg(readFileSync(join(ergDir, f), 'utf8'));
      const wanted = /\.mrc$/i.test(f) ? '% FTP' : 'W';
      const targets = w.body.flatMap((n: any) => n.targets ?? []);
      if (targets.length) ok((targets[0] as any).text.includes(wanted), `${f}: ${(targets[0] as any).text}`);
    }
  });

  it('every imported step is clock-paced', () => {
    const t = compile(importErg(readFileSync(join(ergDir, ergFiles[0]), 'utf8')));
    const walk = (i: any): string[] =>
      i.kind === 'step' ? [i.pacing] : i.kind === 'group' ? i.items.flatMap(walk) : [];
    ok(walk(t.root).every((p) => p === 'timed'));
  });
});

const fitDir = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/interop/fit');
const fitFiles = readdirSync(fitDir).filter((f) => f.endsWith('.fit')).sort();
const fitBytes = (f: string) => new Uint8Array(readFileSync(join(fitDir, f)));

/** Leaf work steps after expanding repeats — derived from raw fields only. */
function fitExpandedSteps(buf: Uint8Array): number {
  const steps = readFit(buf).filter((m) => m.global === 27);
  const counts: number[] = [];          // leaf count contributed by each record
  for (const m of steps) {
    const type = m.fields[1] as number | null;
    if (type !== null && type >= 6 && type <= 13) {
      const from = (m.fields[2] as number) ?? 0;
      const times = (m.fields[4] as number) ?? 2;
      const inner = counts.slice(from).reduce((a, b) => a + b, 0);
      counts.length = from;
      counts.push(inner * times);
    } else {
      counts.push(1);
    }
  }
  return counts.reduce((a, b) => a + b, 0);
}

describe('fit import', () => {
  it('walks the binary record stream in order', () => {
    // message_index is written by the encoder and must come back contiguous;
    // any misread field width would desynchronise the stream and break it.
    for (const f of fitFiles) {
      const idx = readFit(fitBytes(f)).filter((m) => m.global === 27).map((m) => m.fields[254]);
      eq(idx, idx.map((_, i) => i), f);
    }
  });

  it('num_valid_steps equals the work steps, excluding repeat markers', () => {
    for (const f of fitFiles) {
      const { declared, present } = fitStepCounts(fitBytes(f));
      const repeats = readFit(fitBytes(f)).filter((m) => m.global === 27)
        .filter((m) => { const t = m.fields[1] as number | null; return t !== null && t >= 6 && t <= 13; }).length;
      eq(present - repeats, declared, f);
    }
  });

  it('expands repeats to the step count the raw fields imply', () => {
    for (const f of fitFiles) {
      const t = compile(importFit(fitBytes(f)));
      const walk = (i: any): number =>
        i.kind === 'step' ? 1
          : i.kind === 'group' ? i.items.reduce((n: number, c: any) => n + walk(c), 0) * (i.rounds ?? 1)
          : 0;
      eq(walk(t.root), fitExpandedSteps(fitBytes(f)), f);
    }
  });

  it('turns a repeat_until_steps_cmplt into a rounds block over the right steps', () => {
    const w = importFit(fitBytes('WorkoutRepeatSteps.fit'));
    const block = w.body.find((n) => n.node === 'block') as any;
    eq(block.count, 3);
    eq(block.children.map((c: any) => c.movement), ['B1_', 'B2_']);
    eq(block.children[0].quantity, { kind: 'distance', value: 500, unit: 'm' });
  });

  it('carries intensity roles through', () => {
    const w = importFit(fitBytes('WorkoutIndividualSteps.fit'));
    const notes = w.body.map((n: any) => n.notes?.[0]).filter(Boolean);
    ok(notes.includes('warmup') && notes.includes('cooldown'), notes.join(','));
  });

  it('survives a trip out to WDL text and back', () => {
    for (const f of fitFiles) {
      const again = parse(format(importFit(fitBytes(f))));
      eq(again.errors.map((e) => e.message), [], f);
      ok(again.workout.body.length > 0, f);
    }
  });
});
