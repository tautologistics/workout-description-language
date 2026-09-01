#!/usr/bin/env node
/**
 * Emit the movement-curation sheet — the CSV that a hand pass over the
 * modifier data is done in, and that scripts/import-movement-curation.mjs
 * reads back.
 *
 *   node scripts/export-movement-curation.mjs [outfile]
 *
 * With no argument the CSV goes to stdout; with a path it is written there
 * and a one-line summary goes to stderr. `make curation:sheet` writes
 * `curation-sheet.csv` at the repo root (git-ignored — it is a working
 * artifact, not a source file).
 *
 * ## Column layout — must stay in lockstep with import-movement-curation.mjs
 *
 * 32 columns in three blocks:
 *
 *   IDENTITY (3)   id, title, aliases
 *   CURRENT  (16)  what registry/movements.json holds today — reference only,
 *                  the importer never reads these back
 *   CURATE   (13)  blank cells to fill in; a filled cell is an assertion, a
 *                  blank one changes nothing
 *
 * Two columns are literally named "Laterality: both" (one per block), so the
 * importer keys off position, not header text — keep the order exact. The
 * CURRENT block carries "Laterality axis" right after "Default laterality"
 * (added 2026-08-31, mirroring the CURATE column from queue item
 * 13a-curation) so a curator can see the current axis beside the blank they
 * are filling.
 *
 * A leading group-header row ("IDENTITY", "CURRENT …", "CURATE …") is written
 * for the human; the importer finds the real header by content and tolerates
 * that row being present or absent.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const REGISTRY_PATH = 'registry/movements.json';

// --- column layout: must match scripts/import-movement-curation.mjs exactly ---

const CURRENT_HEADERS = [
  'Has laterality data?', 'Laterality: both', 'Laterality: split', 'Laterality: per-side',
  'Default laterality', 'Laterality axis',
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
const HEADER = ['id', 'title', 'aliases', ...CURRENT_HEADERS, ...CURATE_HEADERS];

// --- CSV emit: RFC4180, CRLF, quote only when a field needs it ---

const csvCell = (v) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cells) => cells.map(csvCell).join(',');

// --- the CURRENT block for one registry entry ---

const bool = (b) => (b ? 'TRUE' : 'FALSE');
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function currentCells(m) {
  const lat = list(m.laterality);
  const meas = list(m.measures);
  return [
    bool(lat.length), bool(lat.includes('both')), bool(lat.includes('split')), bool(lat.includes('per-side')),
    m.defaultLaterality ?? '', m.lateralityAxis ?? '',
    bool(meas.length), bool(meas.includes('distance')), bool(meas.includes('calories')),
    bool(m.load), bool(m.load === 'total'), bool(m.load === 'per-implement'), m.implements ?? '',
    m.force ?? '', m.mechanic ?? '', list(m.equipment).join('; '),
  ];
}

// --- build ---

const doc = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
const movements = doc.movements ?? [];

const groupRow = [];
groupRow[0] = 'IDENTITY';
groupRow[3] = 'CURRENT (as registered today — reference only)';
groupRow[3 + CURRENT_HEADERS.length] = 'CURATE (fill in; blank = not reviewed)';

const lines = [
  csvRow(Array.from({ length: HEADER.length }, (_, i) => groupRow[i] ?? '')),
  csvRow(HEADER),
  ...movements.map((m) => csvRow([
    m.id ?? '', m.title ?? '', list(m.aliases).join('; '),
    ...currentCells(m),
    ...CURATE_HEADERS.map(() => ''),
  ])),
];
const csv = lines.join('\r\n') + '\r\n';

const outfile = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (outfile) {
  writeFileSync(outfile, csv);
  process.stderr.write(`${movements.length} movements -> ${outfile} (${HEADER.length} columns)\n`);
} else {
  process.stdout.write(csv);
}
