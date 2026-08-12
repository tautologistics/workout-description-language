/**
 * A program: an ordered block of training, and the goals it is built against.
 *
 * A workout file is one session, because a whiteboard holds one session. A
 * program is the thing you look at beforehand — which sessions, in what order,
 * and what the block as a whole is supposed to achieve. It names its workouts
 * rather than containing them, so each stays a file you can format, check and
 * send to a watch on its own.
 *
 *     program: Winter build
 *     goals: ramp-the-pull.wdlg
 *
 *     week 1:
 *       - pull: w1-pull.wdl
 *       - legs: w1-legs.wdl
 *
 *     week 2:
 *       - pull: w2-pull.wdl
 *       - legs: w2-legs.wdl
 *
 * The slot names are the point. `progress` compares a session to the last
 * session in the same slot and to nothing else. Without them, "ramp the pulling
 * volume" compares this week's pull session against this week's leg session,
 * notices the pulling has collapsed, and reports a failure that is really just
 * the observation that leg day is not pull day.
 *
 * Cycles are ordered by where they appear. `week 1`, `block A`, `Monday` — the
 * label is yours and nothing reads it but you.
 */

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { readLines } from './lines.ts';
import { parse } from './parse.ts';
import { compile } from './timeline.ts';
import { parseGoals, checkSeries, type Goals, type SeriesEntry } from './goals.ts';

export interface ProgramEntry {
  /** The recurring session this is an instance of. Defaults to its position in the cycle. */
  slot: string;
  /** Path as written, before resolution. */
  file: string;
  line: number;
}

export interface Cycle {
  label: string;
  entries: ProgramEntry[];
  line: number;
}

export interface Program {
  title?: string;
  /** Path to the goals file, as written. */
  goals?: string;
  cycles: Cycle[];
  errors: { line: number; message: string }[];
}

/** Reading a program is a line grammar, like a workout and like a goals file. */
export function parseProgram(source: string): Program {
  const program: Program = { cycles: [], errors: [] };
  const fail = (line: number, message: string) => program.errors.push({ line, message });

  for (const node of readLines(source)) {
    if (!node.text) continue;
    const colon = node.text.indexOf(':');
    if (colon === -1) { fail(node.line, `expected "<label>:", got "${node.text}"`); continue; }
    const head = node.text.slice(0, colon).trim();
    const rest = node.text.slice(colon + 1).trim();

    if (/^program$/i.test(head)) { program.title = rest || undefined; continue; }
    if (/^goals$/i.test(head)) {
      if (!rest) fail(node.line, 'goals: needs a path');
      else program.goals = rest;
      continue;
    }

    // Anything else heads a cycle. Its children are the sessions in it.
    const entries: ProgramEntry[] = [];
    for (const child of node.children) {
      const text = child.text.replace(/^-\s*/, '').trim();
      if (!text) continue;
      const at = text.indexOf(':');
      const [slot, file] = at === -1
        ? [String(entries.length + 1), text]
        : [text.slice(0, at).trim(), text.slice(at + 1).trim()];
      if (!file) { fail(child.line, `no workout file for "${slot}"`); continue; }
      entries.push({ slot, file, line: child.line });
    }
    if (!entries.length) fail(node.line, `"${head}" has no sessions in it`);
    else program.cycles.push({ label: head, entries, line: node.line });
  }

  if (!program.cycles.length && !program.errors.length) fail(1, 'no cycles: a program needs at least one');
  return program;
}

export interface LoadedSession extends SeriesEntry {
  cycle: string;
  file: string;
}

export interface LoadedProgram {
  program: Program;
  goals: Goals;
  sessions: LoadedSession[];
  /** Files that could not be read, or goals that would not parse. */
  errors: { line: number; message: string }[];
}

/**
 * Read a program and everything it names.
 *
 * Paths are resolved against the program file's own directory, so a program can
 * be moved with its workouts and keep working.
 */
export function loadProgram(path: string): LoadedProgram {
  const dir = dirname(path);
  const at = (p: string) => (isAbsolute(p) ? p : join(dir, p));
  const program = parseProgram(readFileSync(path, 'utf8'));
  const errors = [...program.errors];

  let goals: Goals = { rules: [], errors: [] };
  if (program.goals) {
    try {
      goals = parseGoals(readFileSync(at(program.goals), 'utf8'));
      for (const e of goals.errors) errors.push({ line: e.line, message: `${program.goals}: ${e.message}` });
    } catch (e) {
      errors.push({ line: 0, message: `cannot read goals ${program.goals}: ${(e as Error).message}` });
    }
  }

  // Ordered by cycle, then by position within it — which is the order a
  // `progress` rule reads, once it has grouped by slot.
  const sessions: LoadedSession[] = [];
  for (const cycle of program.cycles) {
    for (const entry of cycle.entries) {
      let text: string;
      try {
        text = readFileSync(at(entry.file), 'utf8');
      } catch (e) {
        errors.push({ line: entry.line, message: `cannot read ${entry.file}: ${(e as Error).message}` });
        continue;
      }
      const parsed = parse(text);
      for (const e of parsed.errors) errors.push({ line: entry.line, message: `${entry.file}:${e.line}: ${e.message}` });
      sessions.push({
        name: `${cycle.label} · ${parsed.workout.title || entry.file}`,
        timeline: compile(parsed.workout),
        slot: entry.slot,
        cycle: cycle.label,
        file: entry.file,
      });
    }
  }

  return { program, goals, sessions, errors };
}

/** Check every session against the goals, and the block against its `progress` rules. */
export function checkProgram(loaded: LoadedProgram) {
  return checkSeries(loaded.sessions, loaded.goals);
}
