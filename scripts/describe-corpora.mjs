#!/usr/bin/env node
/**
 * Restate what the merged corpora contain, into registry/SOURCES.json and the
 * table in registry/SOURCES.md.
 *
 *   node scripts/describe-corpora.mjs [--apply]
 *
 * The `mergedCorpora` block is the one part of SOURCES.json that describes our
 * *output* rather than someone else's input, so it is the one part that goes
 * stale on its own. It did: the line claimed 3335 movements, 3161 with muscle
 * data, 1510 with a Garmin mapping and 850 translated — the figures
 * build-movements.mjs prints *before* dedup, copied in by hand and never
 * revisited, against a file that has held 3120 records since dedup landed. The
 * same sentence had been copied a second time into the SOURCES.md table, and
 * both drifted together. A provenance file nobody regenerates is a provenance
 * file that lies, so this runs last in build-canonical.ts and the numbers are
 * no longer anyone's to remember.
 *
 * Counted from the finished files rather than from the merge, because the merge
 * is not the last step: dedup removes records and mark-core adds a field, and
 * both are what a reader is being told about.
 *
 * Translations are counted **excluding wger's `lang-2`, which is English**. 784
 * records carry a translations block but 163 of them carry only the English
 * name again, and "a name in another language" should not count those.
 *
 * Only the two table rows are rewritten in SOURCES.md, and a missing row is a
 * hard error rather than a silent no-op — a generator that quietly stops
 * writing is how the figures went stale in the first place.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const apply = process.argv.includes('--apply');

const movements = JSON.parse(readFileSync('registry/movements.canonical.json', 'utf8')).movements;
const workouts = JSON.parse(readFileSync('registry/workouts.canonical.json', 'utf8')).workouts;

const count = (f) => movements.filter(f).length;
const stat = {
  movements: movements.length,
  muscles: count((r) => r.muscles),
  garmin: count((r) => r.external?.garminExercise),
  translated: count((r) => Object.keys(r.translations ?? {}).some((k) => k !== 'lang-2')),
  core: count((r) => r.core),
  workouts: workouts.length,
};

// Sources in descending order of what each contributed, so the sentence says
// something about the merge rather than just listing five names.
const bySource = {};
for (const r of movements) for (const s of r.sources) bySource[s] = (bySource[s] ?? 0) + 1;
const names = Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([s]) => s);
const list = names.length > 1
  ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
  : names.join('');

const held = `${stat.muscles} with muscle data, ${stat.garmin} with a Garmin mapping, `
  + `${stat.translated} with a name in another language, ${stat.core} marked core`;

const described = {
  'registry/movements.canonical.json':
    `${stat.movements} movements from ${list}. `
    + `${stat.muscles} carry muscle data, ${stat.garmin} a Garmin mapping, `
    + `${stat.translated} a name in another language, ${stat.core} marked core.`,
  'registry/workouts.canonical.json':
    `${stat.workouts} workouts with source text, parsed AST and derived summary.`,
};

/** What each file is written to hold, and how to tell whether it already does. */
const targets = [];

{
  const path = 'registry/SOURCES.json';
  const before = readFileSync(path, 'utf8');
  const doc = JSON.parse(before);
  doc.mergedCorpora = described;
  // SOURCES.json is hand-edited everywhere else, and is stored with non-ASCII
  // escaped. Matching that keeps a regenerated file a one-line diff instead of
  // a whole-file reflow every time an em dash survives a rewrite.
  const after = JSON.stringify(doc, null, 2).replace(
    /[^\x00-\x7f]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  ) + '\n';
  targets.push({ path, before, after });
}

{
  const path = 'registry/SOURCES.md';
  const before = readFileSync(path, 'utf8');
  const rows = [
    ['movements.canonical.json', stat.movements, `Every movement we hold: ${held}`],
    ['workouts.canonical.json', stat.workouts, 'Every workout, with source text, parsed AST, and a derived summary'],
  ];
  let after = before;
  for (const [file, n, text] of rows) {
    const row = new RegExp(`^\\| \`${file.replace(/\./g, '\\.')}\` \\|.*$`, 'm');
    if (!row.test(after)) {
      console.error(`registry/SOURCES.md has no table row for \`${file}\`. Restore it or update this script.`);
      process.exit(1);
    }
    after = after.replace(row, `| \`${file}\` | ${n} | ${text} |`);
  }
  targets.push({ path, before, after });
}

for (const [k, v] of Object.entries(described)) console.log(`  ${k}\n    ${v}`);

const stale = targets.filter((t) => t.before !== t.after);
if (!stale.length) {
  console.log('registry/SOURCES.json and registry/SOURCES.md are already current.');
} else if (apply) {
  for (const t of stale) {
    writeFileSync(t.path, t.after);
    console.log(`wrote ${t.path}`);
  }
} else {
  console.log(`out of date: ${stale.map((t) => t.path).join(', ')}. Re-run with --apply to write.`);
}
