#!/usr/bin/env node
/**
 * Rebuild registry/workouts.canonical.json from the corpus.
 *
 * Every workout is kept three ways: the source text exactly as written, the
 * parsed tree, and a derived summary. The text is the record — if the parser
 * changes its mind about something, the summary moves and the text does not,
 * which is what makes the difference visible in a diff.
 *
 * The derivation is exported as `buildWorkoutsDoc()` so a test can re-run it in
 * process and compare against the committed file — the same shape as the
 * `interpretations.json` and `vocabulary.json` regenerators, which have a test
 * that fails when they drift. Run as a script it also writes the file and
 * prints a summary; that CLI behaviour is unchanged.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { today } from './lib/stamp.mjs';
import '../packages/core/node.ts';
import { parse } from '../packages/core/src/parse.ts';
import { validate } from '../packages/core/src/validate.ts';
import { compile } from '../packages/core/src/timeline.ts';
import { volume } from '../packages/core/src/volume.ts';

// Anchored to the repo root rather than to the working directory, so the
// derivation reads the same corpus whether it is run as a script (cwd = root)
// or imported from the test runner (cwd = packages/core).
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'registry/workouts.canonical.json');
const CORPUS_DIRS = ['examples/corpus', 'examples/interop/sheiko'];

/**
 * The corpus, parsed and derived, exactly as it is written to
 * registry/workouts.canonical.json — including the `generated` stamp, which a
 * caller comparing two builds must drop.
 */
export function buildWorkoutsDoc() {
  const dirs = CORPUS_DIRS.filter((d) => existsSync(join(root, d)));
  const workouts = [];
  for (const dir of dirs) {
    for (const f of readdirSync(join(root, dir)).filter((x) => x.endsWith('.wdl')).sort()) {
      // `file` stays repo-root-relative, the way it is committed; reads go
      // through the absolute path.
      const file = `${dir}/${f}`;
      const text = readFileSync(join(root, file), 'utf8');
      const parsed = parse(text);
      const w = parsed.workout;
      let summary = null, timeline = null;
      try {
        timeline = compile(w);
        const v = volume(timeline);
        summary = {
          estimatedSeconds: timeline.estimatedSeconds ?? null,
          // A cap is what the workout may take, not what it takes; a capped
          // for-time workout has the second and not the first.
          capSeconds: timeline.cap ?? null,
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
  return {
    $comment: 'Every workout in the corpus, kept as source text, parsed tree and derived summary. Rebuild with scripts/build-canonical.ts.',
    licenceWarning: 'Benchmark workouts are third-party in origin — CrossFit, Hyrox and powerlifting programming published by their owners. The prescriptions are facts; the names are not ours. See SOURCES.md.',
    generated: today(), count: workouts.length, workouts,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const doc = buildWorkoutsDoc();
  writeFileSync(OUT, JSON.stringify(doc, null, 0) + '\n');
  const workouts = doc.workouts;
  const bad = workouts.filter((w) => w.diagnostics.parseErrors.length || w.summary?.error);
  console.log(`${workouts.length} workouts`);
  console.log(`  unbounded:       ${workouts.filter((w) => w.summary?.unbounded).length}`);
  console.log(`  with a title:    ${workouts.filter((w) => w.title).length}`);
  console.log(`  failing to parse or compile: ${bad.length}`);
  for (const w of bad) console.log(`    ${w.file}: ${w.summary?.error ?? w.diagnostics.parseErrors[0]?.message}`);
}
