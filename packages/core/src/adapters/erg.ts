/**
 * `.erg` / `.mrc` import (roadmap §4).
 *
 * The simplest format in the interop set and, for that reason, a clean oracle:
 * a course is a list of `(minute, target)` breakpoints, so the workout's total
 * duration is just the last timestamp — a number sitting in the file, readable
 * without any structural interpretation at all.
 *
 * `.erg` gives absolute watts; `.mrc` gives a percentage of FTP. The header
 * says which, via the `MINUTES WATTS` / `MINUTES PERCENT` column line.
 */

import type { Workout, Node, Step, Target } from '../ast.ts';

export interface ErgCourse {
  header: Record<string, string>;
  /** Breakpoints in file order: minutes from the start, and the target there. */
  points: { minutes: number; value: number }[];
  unit: 'watts' | 'percent';
  name?: string;
}

export function parseErg(text: string): ErgCourse {
  const header: Record<string, string> = {};
  const points: { minutes: number; value: number }[] = [];
  let unit: 'watts' | 'percent' = 'watts';
  let inData = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\[COURSE DATA\]/i.test(line)) { inData = true; continue; }
    if (/^\[END COURSE DATA\]/i.test(line)) { inData = false; continue; }
    if (/^\[/.test(line)) continue;

    if (!inData) {
      if (/^MINUTES\s+PERCENT/i.test(line)) { unit = 'percent'; continue; }
      if (/^MINUTES\s+WATTS/i.test(line)) { unit = 'watts'; continue; }
      const m = line.match(/^([A-Z][A-Z ]*?)\s*=\s*(.*)$/i);
      if (m) header[m[1].trim().toUpperCase()] = m[2].trim();
      continue;
    }
    const m = line.split(/[\s,]+/);
    if (m.length >= 2 && !Number.isNaN(Number(m[0]))) {
      points.push({ minutes: Number(m[0]), value: Number(m[1]) });
    }
  }
  return { header, points, unit, name: header['FILE NAME'] ?? header['DESCRIPTION'] };
}

/**
 * Total seconds read straight off the course: the last breakpoint's timestamp.
 * Shares no code with the parser or the timeline compiler — that is the point.
 */
export function ergDurationSeconds(text: string): number {
  const { points } = parseErg(text);
  return points.length ? Math.round(points[points.length - 1].minutes * 60) : 0;
}

/**
 * Consecutive breakpoints become segments. A pair at the same timestamp is a
 * step change and produces nothing; a pair spanning time with equal values is a
 * steady segment; unequal values are a ramp.
 */
export function importErg(text: string): Workout {
  const course = parseErg(text);
  const body: Node[] = [];

  const target = (v: number): Target[] =>
    course.unit === 'percent'
      ? [{ kind: 'power', text: `${Math.round(v)}% FTP` }]
      : [{ kind: 'power', text: `${Math.round(v)}W` }];

  // Round each breakpoint to absolute seconds once, then take differences, so
  // the segments telescope back to exactly the final timestamp. Rounding each
  // difference independently accumulates drift of a second or two across a
  // long workout — small, but it means the total no longer matches the file.
  const at = course.points.map((p) => Math.round(p.minutes * 60));

  for (let i = 0; i < course.points.length - 1; i++) {
    const a = course.points[i], b = course.points[i + 1];
    const seconds = at[i + 1] - at[i];
    if (seconds <= 0) continue;                        // an instantaneous step change

    const ramping = a.value !== b.value;
    const step: Step = {
      node: 'step', movement: 'Bike',
      quantity: { kind: 'duration', seconds },
      targets: ramping ? [] : target(a.value),
      notes: ramping
        ? [course.unit === 'percent'
            ? `ramp ${Math.round(a.value)}% -> ${Math.round(b.value)}% FTP`
            : `ramp ${Math.round(a.value)}W -> ${Math.round(b.value)}W`]
        : [],
      flags: [], comments: [], line: i + 1,
    };
    body.push(step);
  }

  const workout: Workout = { node: 'workout', directives: {}, body, comments: [] };
  if (course.header['DESCRIPTION']) workout.title = course.header['DESCRIPTION'];
  if (course.header['FTP']) workout.directives.ftp = course.header['FTP'];
  workout.directives.source = course.unit === 'percent' ? 'mrc' : 'erg';
  return workout;
}

// ---------------------------------------------------------------------------

import type { Timeline } from '../timeline.ts';
import { flatten } from './flatten.ts';
import type { ExportResult } from './zwo.ts';

/**
 * Export to `.erg` (absolute watts) or `.mrc` (percentage of FTP).
 *
 * The thinnest of the three: a course is only a power curve, so every step
 * becomes a pair of breakpoints and everything else is lost. Exporting `.erg`
 * needs an FTP to turn percentages into watts.
 */
export function exportErg(
  t: Timeline,
  opts: { mrc?: boolean; ftp?: number; name?: string } = {},
): ExportResult {
  const { steps, warnings } = flatten(t);
  const mrc = opts.mrc ?? false;
  const ftp = opts.ftp ?? 250;
  const rows: string[] = [];
  let unsupported = 0;
  let at = 0;

  const value = (s: { ftp?: number; watts?: number }, which: 'start' | 'end', rampTo?: number) => {
    const frac = which === 'end' && rampTo !== undefined ? rampTo : s.ftp;
    if (frac !== undefined) return mrc ? frac * 100 : frac * ftp;
    if (s.watts !== undefined) return mrc ? (s.watts / ftp) * 100 : s.watts;
    return mrc ? 50 : ftp * 0.5;
  };

  for (const s of steps) {
    if (s.seconds === undefined) { unsupported++; continue; }
    const end = at + s.seconds / 60;
    rows.push(`${at.toFixed(2)}\t${Math.round(value(s, 'start'))}`);
    rows.push(`${end.toFixed(2)}\t${Math.round(value(s, 'end', s.rampTo))}`);
    at = end;
  }
  if (unsupported) {
    warnings.push(`${unsupported} step(s) not exported: an ${mrc ? 'MRC' : 'ERG'} course is a power curve, so only timed work survives`);
  }
  if (!mrc && !opts.ftp) warnings.push('no FTP supplied — percentages resolved against a default of 250W');

  const out = [
    '[COURSE HEADER]', 'VERSION = 2', 'UNITS = ENGLISH',
    `DESCRIPTION = ${opts.name || t.root.label || 'Workout'}`,
    `FTP = ${ftp}`, mrc ? 'MINUTES PERCENT' : 'MINUTES WATTS',
    '[END COURSE HEADER]', '', '[COURSE DATA]', ...rows, '[END COURSE DATA]', '',
  ].join('\n');
  return { output: out, warnings };
}
