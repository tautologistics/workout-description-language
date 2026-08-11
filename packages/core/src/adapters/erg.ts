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
