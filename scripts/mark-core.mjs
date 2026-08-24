#!/usr/bin/env node
/**
 * Mark the movements that are actually common, and score everything else.
 *
 *   node scripts/mark-core.mjs [--apply]
 *
 * Chasing duplicates through 3120 records is diminishing returns: the long tail
 * is machine variants and rehab work that nobody writes into a workout, and if
 * two of those stay separate it costs nothing. What matters is that the common
 * movements each have exactly one canonical record.
 *
 * Commonality is inferred from evidence rather than opinion:
 *
 *   +3  referenced by a workout in our corpus  — the strongest signal there is
 *   +3  hand-curated                            — we already judged it worth writing
 *   +2  a lift Garmin tracks a 1RM for          — a vendor's view of what matters
 *   +2  per source beyond the first             — independent catalogues agreeing
 *   +1  is the base of a variation family       — the thing others are variants of
 *   +1  absorbed a duplicate during dedup       — several catalogues named it
 *
 * The score is kept on every record so the cut can be argued with later.
 *
 * `commonality` and `core` are two different questions, and until 2026-08-23
 * they were one: four or more put a record in the core. The score answers *how
 * well attested is this record*, which is what dedup needs. `core` is the pool
 * generation picks from and the palette shows with an empty search box, and it
 * asks *has anyone treated this as work*. Catalogue agreement cannot answer
 * that. Three sources listing `Quad Stretch` makes it well attested and no more
 * a thing to write into a round, and 4 is exactly what three sources are worth.
 *
 * So the pool asks for a **judgement**, and three of the six signals are one: a
 * workout in our corpus writes it, the curator wrote a record for it, or a
 * vendor tracks a 1RM for it. The other three — sources agreeing, heading a
 * family, absorbing duplicates — are facts about *catalogues and names*, and no
 * quantity of them adds up to a judgement. They still score, and the score
 * still decides which record survives dedup; what they no longer do is put a
 * movement in front of a reader by themselves.
 *
 * The threshold went with them, because it was making the inversion worse from
 * the other side: curation is +3 against a bar of 4, so a hand-written record
 * that no corpus workout happens to use never reached the pool. Fourteen did
 * not — `Bar-Facing Burpee`, `Hang Power Clean`, `Squat Snatch`, `Kettlebell
 * Snatch`, `Atlas Stone to Shoulder`, `Log Press`, `Bulgarian Split Squat` —
 * while `Smith Machine Close-Grip Bench Press` was in.
 *
 * What the old rule admitted is the argument for the new one: of the 77 records
 * it let in on catalogue evidence alone, **every one had no `pattern`** —
 * nothing saying it is a squat, a hinge, a pull. `? squat` could not reach any
 * of them. They were reachable only through a bare `?`, which is to say only by
 * being picked blind.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const apply = process.argv.includes('--apply');
const STOP = new Set(['and', 'or', 'the', 'a', 'of', 'to', 'with', 'for', 'on', 'in']);
const fold = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).join('');

const doc = JSON.parse(readFileSync('registry/movements.canonical.json', 'utf8'));
const movements = doc.movements;

const byFold = new Map();
for (const r of movements) {
  byFold.set(fold(r.title), r);
  for (const a of r.aliases ?? []) if (!byFold.has(fold(a))) byFold.set(fold(a), r);
}

// Movements our own workouts actually use.
const used = new Set();
for (const dir of ['examples/corpus', 'examples/interop/sheiko']) {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.wdl'))) {
    for (const line of readFileSync(`${dir}/${f}`, 'utf8').split('\n')) {
      const m = line.match(/^\s*-\s+\S+\s+(.+?)(?:\s*@|,|$)/);
      if (m) used.add(fold(m[1]));
    }
  }
}

const benchmarks = new Set(
  JSON.parse(readFileSync('registry/garmin-benchmarks.json', 'utf8')).benchmarks.map((b) => fold(b.key)));
const familyBase = new Set((doc.families ?? []).map((f) => f.id));

/**
 * The signals that are somebody's judgement rather than a catalogue's. These
 * decide the pool; the score does not. See the header.
 */
const JUDGED = new Set(['used-in-corpus', 'curated', 'garmin-benchmark']);

let core = 0;
for (const r of movements) {
  const why = [];
  let score = 0;
  const keys = [fold(r.title), ...(r.aliases ?? []).map(fold)];
  if (keys.some((k) => used.has(k))) { score += 3; why.push('used-in-corpus'); }
  if (r.sources.includes('wdl-curated')) { score += 3; why.push('curated'); }
  if (keys.some((k) => benchmarks.has(k)) || benchmarks.has(fold(r.external?.garminExercise ?? ''))) {
    score += 2; why.push('garmin-benchmark');
  }
  if (r.sources.length > 1) { score += 2 * (r.sources.length - 1); why.push(`${r.sources.length}-sources`); }
  if (familyBase.has(r.id)) { score += 1; why.push('family-base'); }
  if (r.mergedFrom?.length) { score += 1; why.push('absorbed-duplicates'); }

  r.commonality = score;
  if (why.length) r.commonalityWhy = why;
  if (why.some((w) => JUDGED.has(w))) { r.core = true; core++; } else delete r.core;
}

const dist = {};
for (const r of movements) dist[r.commonality] = (dist[r.commonality] ?? 0) + 1;
// Attested-but-unjudged is the number worth watching: records a threshold would
// have admitted and a judgement does not.
const attested = movements.filter((r) => !r.core && r.commonality >= 4).length;
console.log(`${movements.length} records`);
console.log(`  core (judged):         ${core}`);
console.log(`  attested, unjudged:    ${attested}`);
console.log(`  long tail:             ${movements.length - core - attested}`);
console.log('\nscore distribution:');
for (const [k, v] of Object.entries(dist).sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 10)) {
  console.log(`  ${String(k).padStart(3)}  ${'█'.repeat(Math.min(40, Math.ceil(v / 20)))} ${v}`);
}
console.log('\nhighest-scoring:');
for (const r of movements.slice().sort((a, b) => b.commonality - a.commonality).slice(0, 10)) {
  console.log(`  ${String(r.commonality).padStart(2)}  ${r.title.padEnd(32)} ${(r.commonalityWhy ?? []).join(', ')}`);
}

if (!apply) { console.log('\nReport only. Re-run with --apply to write.'); process.exit(0); }
writeFileSync('registry/movements.canonical.json', JSON.stringify(doc, null, 0) + '\n');
console.log('\nWrote commonality scores into registry/movements.canonical.json');
