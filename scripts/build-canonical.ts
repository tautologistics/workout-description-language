#!/usr/bin/env node
/**
 * Rebuild the merged corpora in registry/.
 *
 *   node scripts/build-canonical.ts
 *
 * Merging is deliberately reversible: every record names the sources that
 * contributed to it, so provenance survives and the licence question stays
 * answerable later rather than being dissolved into an untraceable blob.
 *
 * Merge order is wdl-curated > garmin > free-exercise-db > everkinetic.
 * Earlier sources win on conflicting scalar fields; set-valued fields —
 * equipment, aliases, translations — are unioned. Muscles are derived from the
 * per-source claims rather than unioned, so every one traces back to a source.
 *
 * This is the whole pipeline, and it must stay that way: every step rewrites
 * movements.canonical.json from the step before, so a script left out of this
 * list silently loses whatever it added the last time it was run by hand.
 *
 * The exception is the last step, which writes no movements: it restates what
 * the finished corpora hold, back into registry/SOURCES.json and SOURCES.md.
 * Those counts used to be maintained by hand and had drifted by two hundred
 * records, so they are now derived here or not at all.
 */
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
console.log('Rebuilding registry/movements.canonical.json and registry/workouts.canonical.json');
console.log('Inputs are listed in registry/SOURCES.json; refresh them first with refresh-sources.ts.');
execFileSync('node', [join(root, 'scripts/build-movements.mjs')], { cwd: root, stdio: 'inherit' });
execFileSync('node', [join(root, 'scripts/link-families.mjs'), '--apply'], { cwd: root, stdio: 'inherit' });
execFileSync('node', [join(root, 'scripts/dedupe-movements.mjs'), '--apply'], { cwd: root, stdio: 'inherit' });
// Families are linked before dedup so sibling pairs are vetoed, then relinked
// afterwards because merging changes which ids survive.
execFileSync('node', [join(root, 'scripts/link-families.mjs'), '--apply'], { cwd: root, stdio: 'inherit' });
// Last, because commonality is scored from what the earlier steps produced:
// which records absorbed duplicates, and which head a family.
execFileSync('node', [join(root, 'scripts/mark-core.mjs'), '--apply'], { cwd: root, stdio: 'inherit' });
execFileSync('node', [join(root, 'scripts/build-workouts.mjs')], { cwd: root, stdio: 'inherit' });
// Last of all, because it describes what every step above produced.
execFileSync('node', [join(root, 'scripts/describe-corpora.mjs'), '--apply'], { cwd: root, stdio: 'inherit' });
