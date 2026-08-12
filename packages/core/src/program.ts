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
 *
 * Reading the file is the grammar; opening the workouts it names is not, and
 * lives in `packages/core/node/program.ts` where a filesystem exists.
 */

import { readLines } from './lines.ts';

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
