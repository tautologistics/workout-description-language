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
 * muscles, equipment, aliases — are unioned.
 */
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
console.log('Rebuilding registry/movements.canonical.json and registry/workouts.canonical.json');
console.log('Inputs are listed in registry/SOURCES.json; refresh them first with refresh-sources.ts.');
execFileSync('node', [join(root, 'scripts/build-movements.mjs')], { cwd: root, stdio: 'inherit' });
execFileSync('node', [join(root, 'scripts/build-workouts.mjs')], { cwd: root, stdio: 'inherit' });
