#!/usr/bin/env node
/**
 * Merge every movement source into registry/movements.canonical.json.
 *
 * Merge order is wdl-curated > garmin > free-exercise-db > wger > everkinetic.
 * Earlier sources win on conflicting scalar fields; set-valued fields —
 * equipment, aliases, translations — are unioned. Muscles are not unioned: each
 * source's claim is recorded and the merged view is derived from all of them,
 * so every muscle in the corpus can be traced back to who said so. Every record
 * names the sources that contributed to it, so the merge stays reversible and
 * the licence question stays answerable.
 *
 * Records are keyed on the folded title, so two sources using one name land in
 * one record. Where that is wrong — one name, two different exercises — the
 * entry is rehoused by `NOT_WHAT_THE_NAME_MEANS` below.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { norm, deriveMuscles, unknownMuscles } from './lib/muscles.mjs';
import { today } from './lib/stamp.mjs';

const STOP = new Set(['and', 'or', 'the', 'a', 'of', 'to', 'with']);
const fold = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).join('');
const slug = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).join('-');

/**
 * Source entries whose name is not the movement that name means.
 *
 * Every merge rule in this project guards against *similar* names being folded
 * together. Nothing guarded against *identical* ones, because a title match was
 * treated as proof — and for a name generic enough that two traditions reached
 * for it, it is not. `Air Bike` is the case that found this: Garmin's
 * `INDOOR_BIKE/AIR_BIKE` is the fan bike, and free-exercise-db's `Air_Bike` and
 * everkinetic's `0284` are the *bicycle crunch* ("lie flat on the floor with
 * your lower back pressed to the ground"). All three fold to `airbike`, so they
 * landed in one record before `dedupe-movements.mjs` ever saw them, and the
 * result claimed `abs` and `quads` together while scoring `3-sources` — a
 * signal that reads as three catalogues agreeing when it is three catalogues
 * being merged by their spelling.
 *
 * `sameAs` cannot express this. It merges records, and this needs one *split*:
 * a statement that a particular source's entry is not the movement its name
 * already means. So it is keyed on the entry — `source:upstream-id`, the pair
 * `origin` records — rather than on a record, and it names the record the entry
 * actually belongs to. Keyed on the id and not the name on purpose: the name is
 * the thing that is wrong.
 *
 * It lives here rather than in `registry/movements.json` because it is not a
 * fact about a movement and has no record to hang off. It is a correction to a
 * source, and this script is where the sources are read.
 */
const NOT_WHAT_THE_NAME_MEANS = {
  'free-exercise-db:Air_Bike': 'Bicycle Crunch',
  'everkinetic:0284': 'Bicycle Crunch',
};
/** Which of the directives above matched an entry, and which records a source
 *  named under their own title. Both are checked once every source is read. */
const split = new Set();
const namedBySomeSource = new Set();

const records = new Map();
function add(key, title, source, f = {}) {
  if (!key || !title) return;
  // A split, if one is written for this entry: the record it belongs to
  // replaces the one its name folds to. `origin` still records the name the
  // source used, so the correction stays visible rather than tidied away.
  const belongsTo = f.__upstream == null ? undefined : NOT_WHAT_THE_NAME_MEANS[`${source}:${f.__upstream}`];
  if (belongsTo) {
    split.add(`${source}:${f.__upstream}`);
    key = fold(belongsTo);
    title = belongsTo;
  } else {
    namedBySomeSource.add(key);
  }
  let r = records.get(key);
  if (!r) {
    r = { id: slug(title) || key, title, aliases: new Set(),
          equipment: new Set(), pattern: new Set(), translations: {}, sources: [], external: {},
          // Which source contributed what: upstream ids, and the name each used.
          origin: {}, muscleClaims: {} };
    records.set(key, r);
  }
  if (!r.sources.includes(source)) r.sources.push(source);
  if (f.__upstream !== undefined || f.__name !== undefined) {
    r.origin[source] = { id: f.__upstream ?? null, name: f.__name ?? title };
    delete f.__upstream; delete f.__name;
  }
  // Each source's own muscle claim, kept separate rather than folded into a
  // shared set: the sources disagree, and the disagreement is the useful part.
  if (f.primary?.length || f.secondary?.length) {
    r.muscleClaims[source] = { primary: [...(f.primary ?? [])], secondary: [...(f.secondary ?? [])] };
  }
  delete f.primary; delete f.secondary;
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null) continue;
    if (r[k] instanceof Set) for (const x of v) r[k].add(x);
    else if (k === 'external' || k === 'translations') Object.assign(r[k], v);
    else if (r[k] === undefined) r[k] = v;
  }
}

// 1. curated core
//
// A record marked `source: free-exercise-db` is a snapshot of the import, so
// its classification (muscles, force, mechanic, equipment) is re-read from the
// reference file rather than trusted here. But a few fields are *not* part of
// that snapshot — nothing upstream carries them — so they are hand-kept like
// any other and applied below, after the record exists: `aliases` / `sameAs`,
// and (since 2026-08-31, queue item 13a-curation) the curated laterality
// fields, which the audit workbook can fill on any record regardless of its
// import origin. Skipping the whole record silently dropped them, which is the
// same shape of failure an unresolvable alias is: no error, just no effect.
const handKept = new Map();
for (const m of JSON.parse(readFileSync('registry/movements.json', 'utf8')).movements) {
  if (m.source === 'free-exercise-db') {
    const kept = {};
    if (m.aliases?.length) kept.aliases = m.aliases;
    if (m.sameAs?.length) kept.sameAs = m.sameAs;
    if (m.laterality?.length) kept.laterality = m.laterality;
    if (m.defaultLaterality) kept.defaultLaterality = m.defaultLaterality;
    if (m.lateralityAxis) kept.lateralityAxis = m.lateralityAxis;
    if (Object.keys(kept).length) handKept.set(fold(m.title), kept);
    continue;
  }
  add(fold(m.title), m.title, 'wdl-curated', {
    aliases: m.aliases ?? [], primary: norm(m.muscles?.primary), secondary: norm(m.muscles?.secondary),
    pattern: m.pattern ?? [],
    // Curated records list several; the imported ones carry a single string.
    equipment: Array.isArray(m.equipment) ? m.equipment : m.equipment ? [m.equipment] : [],
    implements: m.implements, load: m.load, measures: m.measures,
    laterality: m.laterality, defaultLaterality: m.defaultLaterality,
    lateralityAxis: m.lateralityAxis,
    // A build directive, not a fact about the movement: dedupe-movements.mjs
    // reads it, absorbs what it names, and deletes it. Carried through here
    // because it is written on the curated record and the merge is what acts
    // on it.
    sameAs: m.sameAs,
  });
}
// 2. Garmin — authoritative muscles plus the interop identifiers
for (const e of JSON.parse(readFileSync('registry/garmin-exercises.json', 'utf8')).exercises) {
  add(fold(e.name), e.name, 'garmin', {
    primary: norm(e.primaryMuscles), secondary: norm(e.secondaryMuscles),
    external: { garminCategory: e.category, garminExercise: e.exercise },
    __upstream: `${e.category}/${e.exercise}`, __name: e.name,
  });
}
// 3. free-exercise-db — public domain
for (const e of JSON.parse(readFileSync('docs/references/free-exercise-db.json', 'utf8'))) {
  add(fold(e.name), e.name, 'free-exercise-db', {
    primary: norm(e.primaryMuscles), secondary: norm(e.secondaryMuscles),
    equipment: e.equipment && e.equipment !== 'body only' ? [e.equipment] : [],
    force: e.force, mechanic: e.mechanic, __upstream: e.id, __name: e.name,
  });
}
// 4. wger — the only source with translations
if (existsSync('docs/references/wger.json')) {
  for (const e of JSON.parse(readFileSync('docs/references/wger.json', 'utf8')).results) {
    const tr = e.translations ?? [];
    const en = tr.find((t) => t.language === 2 && t.name)?.name;
    if (!en) continue;
    const names = {};
    for (const t of tr) if (t.name && t.language) names[`lang-${t.language}`] = t.name;
    add(fold(en), en, 'wger', {
      primary: norm((e.muscles ?? []).map((m) => m.name_en || m.name)),
      secondary: norm((e.muscles_secondary ?? []).map((m) => m.name_en || m.name)),
      equipment: (e.equipment ?? []).map((q) => q.name).filter(Boolean),
      translations: names, __upstream: e.uuid ?? e.id, __name: en,
      variationGroup: e.variation_group ?? undefined,
    });
  }
}
// 5. everkinetic
if (existsSync('docs/references/everkinetic.json')) {
  for (const e of JSON.parse(readFileSync('docs/references/everkinetic.json', 'utf8'))) {
    const t = e.title ?? e.name;
    if (!t) continue;
    add(fold(t), t, 'everkinetic', {
      primary: norm(e.primary), secondary: norm(e.secondary), equipment: e.equipment ?? [],
      __upstream: e.id, __name: t,
    });
  }
}

// The hand-kept fields of records seeded from free-exercise-db, applied now
// that every source has been read and the records they name exist.
for (const [key, kept] of handKept) {
  const r = records.get(key);
  if (!r) {
    console.error(`registry/movements.json carries hand-kept fields for "${key}", which no source produced.`);
    process.exit(1);
  }
  for (const a of kept.aliases ?? []) r.aliases.add(a);
  if (kept.sameAs?.length) r.sameAs = [...new Set([...(r.sameAs ?? []), ...kept.sameAs])];
  if (kept.laterality?.length) r.laterality = kept.laterality;
  if (kept.defaultLaterality) r.defaultLaterality = kept.defaultLaterality;
  if (kept.lateralityAxis) r.lateralityAxis = kept.lateralityAxis;
}

// A split that matches no entry does nothing at all, and the only symptom is
// the false merge still sitting there. A split into a title no source uses is
// worse than nothing: it invents a record out of the entry it was meant to
// rehouse, which is the original defect with a new name on it. Loud, for the
// same reason an unresolved `sameAs` is.
const dead = Object.entries(NOT_WHAT_THE_NAME_MEANS).filter(([entry]) => !split.has(entry));
const invented = Object.entries(NOT_WHAT_THE_NAME_MEANS).filter(([, into]) => !namedBySomeSource.has(fold(into)));
if (dead.length || invented.length) {
  console.error('scripts/build-movements.mjs splits entries the sources do not hold:');
  for (const [entry, into] of dead) console.error(`  ${entry} -> ${into}: no source produced that entry`);
  for (const [entry, into] of invented) console.error(`  ${entry} -> ${into}: no source names that record`);
  process.exit(1);
}

if (unknownMuscles.size) {
  console.error('Unknown muscle names. Add them to registry/muscles.json as synonyms of an existing');
  console.error('muscle, or as a new muscle if they are genuinely one we do not track yet:');
  for (const [k, n] of [...unknownMuscles].sort((a, b) => b[1] - a[1])) console.error(`  ${String(n).padStart(5)}  ${k}`);
  process.exit(1);
}

const out = [...records.values()].sort((a, b) => a.id.localeCompare(b.id)).map((r) => {
  const rec = { id: r.id, title: r.title };
  const aliases = [...r.aliases].filter((a) => fold(a) !== fold(r.title));
  if (aliases.length) rec.aliases = aliases.sort();
  const derived = deriveMuscles(r.muscleClaims);
  if (derived) rec.muscles = derived;
  for (const k of ['pattern', 'equipment']) if (r[k].size) rec[k] = [...r[k]].sort();
  for (const k of ['implements', 'load', 'measures', 'laterality', 'defaultLaterality', 'lateralityAxis', 'force', 'mechanic'])
    if (r[k] !== undefined) rec[k] = r[k];
  // Written out so the next step in the pipeline can read it, and deleted
  // there. No record in the finished corpus carries it.
  if (r.sameAs?.length) rec.sameAs = r.sameAs;
  if (Object.keys(r.translations).length) rec.translations = r.translations;
  if (r.variationGroup !== undefined) rec.variationGroup = r.variationGroup;
  if (Object.keys(r.external).length) rec.external = r.external;
  rec.sources = r.sources;
  rec.origin = r.origin;
  // Kept always, not just on disagreement. `muscles` is derived from these, so
  // dropping them would leave the merged view unattributable — and it is the
  // per-source counts that let a caller ask for muscles two sources agree on
  // rather than everything anyone ever claimed.
  if (Object.keys(r.muscleClaims).length) rec.muscleClaims = r.muscleClaims;
  return rec;
});

writeFileSync('registry/movements.canonical.json', JSON.stringify({
  $comment: 'Canonical merged movement corpus. Every record names the sources that contributed to it, so provenance survives the merge and the licence question stays answerable. Rebuild with scripts/build-canonical.ts.',
  licenceWarning: 'Mixed provenance. wger and everkinetic are CC-BY-SA 4.0, Garmin’s catalogue carries no stated licence, free-exercise-db is public domain. See SOURCES.md before redistributing.',
  generated: today(), count: out.length, movements: out,
}, null, 0) + '\n');

const by = {};
for (const r of out) by[r.sources.slice().sort().join(' + ')] = (by[r.sources.slice().sort().join(' + ')] ?? 0) + 1;
console.log(`${out.length} movements`);
console.log(`  with muscle data:      ${out.filter((r) => r.muscles).length}`);
console.log(`  with a Garmin mapping: ${out.filter((r) => r.external?.garminCategory).length}`);
console.log(`  with translations:     ${out.filter((r) => r.translations).length}`);
console.log(`  in more than one source: ${out.filter((r) => r.sources.length > 1).length}`);
const disagree = out.filter((r) => {
  const c = Object.values(r.muscleClaims ?? {});
  return c.length > 1 && new Set(c.map((x) => JSON.stringify([[...x.primary].sort(), [...x.secondary].sort()]))).size > 1;
});
console.log(`  where sources disagree on muscles: ${disagree.length}`);
console.log('\nby source combination:');
for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${String(v).padStart(5)}  ${k}`);
