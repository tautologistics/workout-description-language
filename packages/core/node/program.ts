/**
 * Opening what a program names.
 *
 * The grammar is in `src/program.ts` and runs anywhere. This is the part that
 * needs a filesystem, so it sits outside `src/` where the boundary is visible
 * in the directory listing rather than buried in an import.
 */
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { parse } from '../src/parse.ts';
import { compile } from '../src/timeline.ts';
import { parseProgram } from '../src/program.ts';
import { parseGoals, checkSeries, type Goals, type SeriesEntry } from '../src/goals.ts';

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
