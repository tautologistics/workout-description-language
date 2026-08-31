#!/usr/bin/env node
/**
 * Land hand-curated modifier corrections back into registry/movements.json.
 *
 *   node scripts/import-movement-curation.mjs <curated.csv> [--apply]
 *
 * Without --apply this only reports what it *would* change and exits —
 * the curation is meant to happen in chunks, verified before anything
 * writes, exactly like scripts/dedupe-movements.mjs's own --apply gate.
 *
 * ## Input shape
 *
 * A CSV export of the "Movements" sheet from the audit workbook
 * (scripts/../ — built ad hoc for this pass, not checked in), all 31
 * columns, in that script's exact column order. Two of those columns are
 * literally named "Laterality: both" — one in the CURRENT block, one in the
 * CURATE block — so this reads columns **by position**, not by header text.
 * (The CURATE block gained a "Laterality axis" column on 2026-08-31 — queue
 * item 13a-curation — so an export from an older workbook fails the header
 * check until the column is added; that is the intended fail-loud behaviour.)
 * The header row is still checked, name-for-name, before anything else runs:
 * a spreadsheet re-saved with a column moved, deleted, or renamed fails loud
 * here rather than writing a value into the wrong field.
 *
 * ## What a blank means
 *
 * Blank is "not reviewed", not "false". Every CURATE cell is read
 * independently: a filled cell asserts something about the registry and a
 * blank one changes nothing, whatever the neighbouring cells in the same
 * group say. Filling in only "Laterality: split" for a row leaves "both"
 * and "per-side" exactly as the registry already has them — it does not
 * imply the other two are false.
 *
 * ## Where a row's claims contradict each other
 *
 * A few combinations can't both be true — Load: total and Load: per-implement
 * both TRUE, all three laterality modes marked FALSE, a Default laterality
 * naming a mode the row didn't also mark TRUE. Those are reported and that
 * one field is left untouched; everything else in the row (and the file)
 * still applies. Nothing here guesses which side of a contradiction is
 * right — that's what the report is for, so it can go back to whoever
 * curated the row.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const csvPath = args.find((a) => !a.startsWith('--'));

if (!csvPath) {
  console.error('usage: node scripts/import-movement-curation.mjs <curated.csv> [--apply]');
  process.exit(1);
}

// --- column layout: must match the audit workbook exactly, position for position ---

const CURRENT_HEADERS = [
  'Has laterality data?', 'Laterality: both', 'Laterality: split', 'Laterality: per-side',
  'Default laterality',
  'Has measures data?', 'Measures: distance', 'Measures: calories',
  'Has load data?', 'Load: total', 'Load: per-implement', 'Implements (count)',
  'Force', 'Mechanic', 'Equipment',
];
const CURATE_HEADERS = [
  'Laterality: both', 'Laterality: split', 'Laterality: per-side', 'Default laterality',
  'Laterality axis',
  'Measures: distance', 'Measures: calories',
  'Load: total', 'Load: per-implement', 'Implements (count)',
  'Force', 'Mechanic', 'Equipment',
];
const EXPECTED_HEADER = ['id', 'title', 'aliases', ...CURRENT_HEADERS, ...CURATE_HEADERS];
const CURATE_START = 3 + CURRENT_HEADERS.length; // 0-indexed column of the first curate cell

const LAT_MODES = ['both', 'split', 'per-side'];
// The axis a `per-side` count runs across, so a tool can say `(each direction)`
// rather than a generic `(each side)` (spec §7 / `limbWord`). A single value, not
// a set — a movement has one axis. Blank leaves whatever the registry has.
const LAT_AXES = ['arm', 'leg', 'side', 'hand', 'direction'];
const MEASURE_MODES = ['distance', 'calories'];

// --- a small RFC4180-ish CSV parser: quoted fields, "" escaping, CRLF/LF ---

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r') {
      // ignore; a following \n ends the row
    } else if (c === '\n') {
      row.push(field); field = ''; rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const raw = readFileSync(csvPath, 'utf8').replace(/^﻿/, ''); // strip a BOM if Excel left one
const rows = parseCsv(raw);

// The group-header row ("IDENTITY", "CURRENT (as registered today)", ...) may
// or may not have made it into the export — find the real header by content,
// not by row number, so either export shape works.
const headerIdx = rows.findIndex((r) => r[0] === 'id' && r[1] === 'title' && r[2] === 'aliases');
if (headerIdx === -1) {
  console.error(`Could not find the header row (looked for id, title, aliases as the first three\n`
    + `columns) in the first ${Math.min(rows.length, 5)} rows of ${csvPath}. Export the "Movements"\n`
    + `sheet as-is, without reordering or deleting columns.`);
  process.exit(1);
}
const header = rows[headerIdx];
if (header.length !== EXPECTED_HEADER.length || EXPECTED_HEADER.some((h, i) => header[i] !== h)) {
  console.error(`${csvPath}'s header does not match the audit workbook's column layout.`);
  console.error('Column  Expected                       Found');
  const n = Math.max(header.length, EXPECTED_HEADER.length);
  for (let i = 0; i < n; i++) {
    const exp = EXPECTED_HEADER[i] ?? '(none)';
    const got = header[i] ?? '(none)';
    if (exp !== got) console.error(`  ${String(i + 1).padStart(3)}   ${exp.padEnd(30)} ${got}`);
  }
  console.error('\nA column was moved, renamed, deleted, or added — re-export the sheet unmodified.');
  process.exit(1);
}

const dataRows = rows.slice(headerIdx + 1).filter((r) => r.some((c) => (c ?? '').trim() !== ''));

// --- the registry itself ---

const REGISTRY_PATH = 'registry/movements.json';
const doc = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
const byId = new Map(doc.movements.map((m) => [m.id, m]));

const toBool = (cell) => {
  const t = (cell ?? '').trim();
  if (t === '') return undefined;   // not reviewed
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  return null;                      // malformed — neither blank nor TRUE/FALSE
};

const report = { changed: [], errors: [], unknownIds: [], blank: 0 };

for (const row of dataRows) {
  const id = (row[0] ?? '').trim();
  const title = (row[1] ?? '').trim();
  const curate = row.slice(CURATE_START, CURATE_START + CURATE_HEADERS.length);
  if (curate.every((c) => (c ?? '').trim() === '')) { report.blank++; continue; }

  if (!id) { report.errors.push(`(blank id, title "${title}"): curate cells filled but no id — skipped`); continue; }
  const entry = byId.get(id);
  if (!entry) { report.unknownIds.push(`${id} (${title})`); continue; }

  const [
    latBothC, latSplitC, latPerSideC, defaultLatC, latAxisC,
    measDistC, measCalC,
    loadTotalC, loadPerImplC, implementsC,
    forceC, mechanicC, equipmentC,
  ] = curate;

  const changes = [];
  const errs = [];
  const label = `${id} (${entry.title})`;

  // --- laterality: per-mode independent override ---
  const latBool = { both: toBool(latBothC), split: toBool(latSplitC), 'per-side': toBool(latPerSideC) };
  if (Object.values(latBool).some((v) => v === null)) {
    errs.push('a Laterality cell has text other than TRUE/FALSE — laterality left untouched');
  } else if (Object.values(latBool).some((v) => v !== undefined)) {
    const cur = new Set(entry.laterality ?? []);
    for (const mode of LAT_MODES) {
      if (latBool[mode] === true) cur.add(mode);
      else if (latBool[mode] === false) cur.delete(mode);
    }
    if (cur.size === 0) {
      errs.push('all three laterality modes marked FALSE — every movement is countable somehow, '
        + 'so this reads as a contradiction rather than "no modes". Leave the group blank instead, '
        + 'or mark the modes that actually apply.');
    } else {
      const next = LAT_MODES.filter((m) => cur.has(m));
      const before = entry.laterality ? [...entry.laterality] : undefined;
      if (JSON.stringify(before) !== JSON.stringify(next)) {
        changes.push({ field: 'laterality', from: before, to: next });
        entry.laterality = next;
      }
    }
  }

  // --- default laterality: must be one of this row's (possibly just-updated) modes ---
  const defaultLatRaw = (defaultLatC ?? '').trim();
  if (defaultLatRaw) {
    if (!LAT_MODES.includes(defaultLatRaw)) {
      errs.push(`Default laterality "${defaultLatRaw}" is not both/split/per-side — skipped`);
    } else if (!(entry.laterality ?? []).includes(defaultLatRaw)) {
      errs.push(`Default laterality "${defaultLatRaw}" is not one of this row's laterality modes `
        + `(${(entry.laterality ?? []).join(', ') || 'none'}) — skipped`);
    } else if (entry.defaultLaterality !== defaultLatRaw) {
      changes.push({ field: 'defaultLaterality', from: entry.defaultLaterality, to: defaultLatRaw });
      entry.defaultLaterality = defaultLatRaw;
    }
  }

  // --- laterality axis: a single value, re-validated against the known set ---
  const latAxisRaw = (latAxisC ?? '').trim();
  if (latAxisRaw) {
    if (!LAT_AXES.includes(latAxisRaw)) {
      errs.push(`Laterality axis "${latAxisRaw}" is not one of ${LAT_AXES.join('/')} — skipped`);
    } else if (!(entry.laterality ?? []).includes('per-side')) {
      errs.push(`Laterality axis "${latAxisRaw}" set on a movement whose laterality modes `
        + `(${(entry.laterality ?? []).join(', ') || 'none'}) do not include per-side — an axis only `
        + `means something for a per-side count. Skipped.`);
    } else if (entry.lateralityAxis !== latAxisRaw) {
      changes.push({ field: 'lateralityAxis', from: entry.lateralityAxis, to: latAxisRaw });
      entry.lateralityAxis = latAxisRaw;
    }
  }

  // --- measures: per-mode independent override; all-false is a real, common state ---
  const measBool = { distance: toBool(measDistC), calories: toBool(measCalC) };
  if (Object.values(measBool).some((v) => v === null)) {
    errs.push('a Measures cell has text other than TRUE/FALSE — measures left untouched');
  } else if (Object.values(measBool).some((v) => v !== undefined)) {
    const cur = new Set(entry.measures ?? []);
    for (const mode of MEASURE_MODES) {
      if (measBool[mode] === true) cur.add(mode);
      else if (measBool[mode] === false) cur.delete(mode);
    }
    const next = cur.size ? MEASURE_MODES.filter((m) => cur.has(m)) : undefined;
    const before = entry.measures ? [...entry.measures] : undefined;
    if (JSON.stringify(before) !== JSON.stringify(next)) {
      changes.push({ field: 'measures', from: before ?? '(none)', to: next ?? '(removed)' });
      if (next) entry.measures = next; else delete entry.measures;
    }
  }

  // --- load: a single TRUE decides it outright; FALSE needs its pair filled too ---
  const loadTotal = toBool(loadTotalC);
  const loadPerImpl = toBool(loadPerImplC);
  let loadNext; // undefined = no change to make
  if (loadTotal === null || loadPerImpl === null) {
    errs.push('a Load cell has text other than TRUE/FALSE — load left untouched');
  } else if (loadTotal === true && loadPerImpl === true) {
    errs.push('Load: total and Load: per-implement both marked TRUE — contradictory, left untouched');
  } else if (loadTotal === true || loadPerImpl === true) {
    loadNext = loadTotal === true ? 'total' : 'per-implement';
  } else if (loadTotal === false && loadPerImpl === false) {
    loadNext = 'REMOVE'; // explicitly reviewed: this movement takes no load at all
  } else if (loadTotal === false || loadPerImpl === false) {
    errs.push('one of Load: total / Load: per-implement marked FALSE with the other left blank — '
      + "ambiguous whether that means \"no load\" or the other type. Fill in both, or leave both blank.");
  }
  if (loadNext !== undefined) {
    const next = loadNext === 'REMOVE' ? undefined : loadNext;
    if (entry.load !== next) {
      changes.push({ field: 'load', from: entry.load ?? '(none)', to: next ?? '(removed)' });
      if (next) entry.load = next; else delete entry.load;
    }
  }

  // --- implements: a plain positive integer ---
  const implementsRaw = (implementsC ?? '').trim();
  if (implementsRaw) {
    const n = Number(implementsRaw);
    if (!Number.isInteger(n) || n < 1) {
      errs.push(`Implements "${implementsRaw}" is not a positive whole number — skipped`);
    } else if (entry.implements !== n) {
      changes.push({ field: 'implements', from: entry.implements ?? '(none)', to: n });
      entry.implements = n;
    }
  }

  // --- force / mechanic: direct overwrite, re-validated against the known enum ---
  const forceRaw = (forceC ?? '').trim();
  if (forceRaw) {
    if (!['push', 'pull', 'static'].includes(forceRaw)) {
      errs.push(`Force "${forceRaw}" is not push/pull/static — skipped`);
    } else if (entry.force !== forceRaw) {
      changes.push({ field: 'force', from: entry.force ?? '(none)', to: forceRaw });
      entry.force = forceRaw;
    }
  }
  const mechanicRaw = (mechanicC ?? '').trim();
  if (mechanicRaw) {
    if (!['compound', 'isolation'].includes(mechanicRaw)) {
      errs.push(`Mechanic "${mechanicRaw}" is not compound/isolation — skipped`);
    } else if (entry.mechanic !== mechanicRaw) {
      changes.push({ field: 'mechanic', from: entry.mechanic ?? '(none)', to: mechanicRaw });
      entry.mechanic = mechanicRaw;
    }
  }

  // --- equipment: free text, split back into a list ---
  const equipmentRaw = (equipmentC ?? '').trim();
  if (equipmentRaw) {
    const next = equipmentRaw.split(';').map((s) => s.trim()).filter(Boolean);
    const before = entry.equipment ? [...entry.equipment] : undefined;
    if (JSON.stringify(before) !== JSON.stringify(next)) {
      changes.push({ field: 'equipment', from: before ?? '(none)', to: next });
      entry.equipment = next;
    }
  }

  if (changes.length) report.changed.push({ label, changes });
  for (const e of errs) report.errors.push(`${label}: ${e}`);
}

// --- report ---

console.log(`${dataRows.length} data rows read from ${csvPath}, ${report.blank} untouched (fully blank curate cells).\n`);

if (report.unknownIds.length) {
  console.log(`Unknown id — not in ${REGISTRY_PATH}, skipped entirely:`);
  for (const u of report.unknownIds) console.log(`  ${u}`);
  console.log('');
}

if (report.changed.length) {
  console.log(`Rows with at least one change (${report.changed.length}):\n`);
  for (const { label, changes } of report.changed) {
    console.log(`${label}:`);
    for (const c of changes) {
      console.log(`  ${c.field}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
    }
  }
  console.log('');
}

if (report.errors.length) {
  console.log(`Contradictions and malformed cells — left untouched (${report.errors.length}):`);
  for (const e of report.errors) console.log(`  ${e}`);
  console.log('');
}

const fieldCount = report.changed.reduce((n, r) => n + r.changes.length, 0);
console.log(`${report.changed.length} rows changed, ${fieldCount} fields total, `
  + `${report.errors.length} left as-is due to a contradiction, ${report.unknownIds.length} unknown ids.`);

if (!apply) {
  console.log('\nReport only — nothing written. Re-run with --apply to write ' + REGISTRY_PATH + '.');
  process.exit(0);
}

if (!report.changed.length) {
  console.log('\nNothing to write.');
  process.exit(0);
}

writeFileSync(REGISTRY_PATH, JSON.stringify(doc, null, 1) + '\n');
console.log(`\nWrote ${REGISTRY_PATH}.`);
