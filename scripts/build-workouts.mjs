#!/usr/bin/env node
/**
 * Rebuild registry/workouts.canonical.json from the corpus.
 *
 * Every workout is kept three ways: the source text exactly as written, the
 * parsed tree, and a derived summary. The text is the record — if the parser
 * changes its mind about something, the summary moves and the text does not,
 * which is what makes the difference visible in a diff.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '../packages/core/src/parse.ts';
import { validate } from '../packages/core/src/validate.ts';
import { compile } from '../packages/core/src/timeline.ts';
import { volume } from '../packages/core/src/volume.ts';

const DIRS = ['examples/corpus', 'examples/interop/sheiko'].filter(existsSync);

const workouts = [];
for (const dir of DIRS) {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.wdl')).sort()) {
    const file = join(dir, f);
    const text = readFileSync(file, 'utf8');
    const parsed = parse(text);
    const w = parsed.workout;
    let summary = null, timeline = null;
    try {
      timeline = compile(w);
      const v = volume(timeline);
      summary = {
        estimatedSeconds: timeline.estimatedSeconds ?? null,
        unbounded: v.unbounded,
        totalReps: v.totals.reps,
        totalDistanceM: v.totals.distanceM,
        totalCalories: v.totals.calories,
        movements: Object.keys(v.byMovement).sort(),
        warnings: timeline.warnings ?? [],
      };
    } catch (e) {
      summary = { error: String(e.message ?? e) };
    }
    workouts.push({
      id: f.replace(/\.wdl$/, ''),
      title: w.title ?? null,
      source: 'wdl-corpus',
      file,
      text,
      ast: w,
      summary,
      diagnostics: {
        parseErrors: parsed.errors ?? [],
        validation: validate(w).map((d) => ({ severity: d.severity, code: d.code, message: d.message, line: d.line })),
      },
    });
  }
}

writeFileSync('registry/workouts.canonical.json', JSON.stringify({
  $comment: 'Every workout in the corpus, kept as source text, parsed tree and derived summary. Rebuild with scripts/build-canonical.ts.',
  licenceWarning: 'Benchmark workouts are third-party in origin — CrossFit, Hyrox and powerlifting programming published by their owners. The prescriptions are facts; the names are not ours. See SOURCES.md.',
  generated: new Date().toISOString().slice(0, 10), count: workouts.length, workouts,
}, null, 0) + '\n');

const bad = workouts.filter((w) => w.diagnostics.parseErrors.length || w.summary?.error);
console.log(`${workouts.length} workouts`);
console.log(`  unbounded:       ${workouts.filter((w) => w.summary?.unbounded).length}`);
console.log(`  with a title:    ${workouts.filter((w) => w.title).length}`);
console.log(`  failing to parse or compile: ${bad.length}`);
for (const w of bad) console.log(`    ${w.file}: ${w.summary?.error ?? w.diagnostics.parseErrors[0]?.message}`);
