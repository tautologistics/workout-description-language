/**
 * A result: one execution of a workout, written down.
 *
 * A workout file is a **class** — what the session *is*, the same for everyone
 * who does it, and the thing on the whiteboard. A result is an
 * **instantiation**: one person, one day, the weights they actually put on the
 * bar and what the clock said at the end. Settled 2026-08-19; the consequence
 * that matters here is that `progress` can finally be asked about load, because
 * a load a reader wants ramped week over week is a fact about a series of
 * *executions* and never about a series of files.
 *
 * Three things make this a second record type rather than more fields on a
 * workout:
 *
 * **The definition must not know.** A whiteboard says what to do. What you did
 * is written next to it, in a different hand, afterwards — and one workout has
 * as many results as it has been done.
 *
 * **A result outlives the file.** It carries a `snapshot:` of the workout text
 * as it was, so it survives the file being edited, deleted or unreachable, and
 * the snapshot doubles as the version record — which is why the format needs no
 * revision numbering (roadmap §3.2.1).
 *
 * **Identity is a pointer, not a hash.** `result: crossfit:fran` is any unique
 * string with an optional namespace, unique only within the repository holding
 * it, and **never derived from content** (spec §1, roadmap §3.2.1). A formatter
 * change rewrites every stored workout and nothing breaks, because nothing
 * durable ever referenced the text.
 *
 * The file is the same indentation-and-colon shape as a workout, a goals file
 * and a program, read by the same phase-1 line reader — a fourth record, not a
 * fourth notation.
 *
 *     result: crossfit:fran
 *     date: 2026-08-23
 *     athlete: chris
 *     division: women
 *     score: 8:42
 *     splits: 2:50, 3:01, 2:51
 *     notes: grip gave out in round 3
 *
 *     loads:
 *       - Thruster @ 95lb
 *
 *     snapshot:
 *       # Fran
 *       for time:
 *         21-15-9:
 *           - Thruster
 *           - Pull-Up
 */

import type { Workout, Node, Step, Target } from './ast.ts';
import type { Diagnostic } from './validate.ts';
import type { SeriesEntry } from './goals.ts';
import { readLines, type Line } from './lines.ts';
import { parse } from './parse.ts';
import { compile } from './timeline.ts';
import { parseDuration, parseTarget } from './units.ts';
import { resolve, movementLookup, sameMovement, withTargets, type ResolveOptions } from './variants.ts';

/** One movement and what it actually weighed, keyed the way a `variants:` entry is. */
export interface ResultLoad {
  movement: string;
  /** As written, after the `@`. Read by the same code a `variants:` value is. */
  value: string;
  line: number;
}

export interface Result {
  /**
   * The workout this is a result of, by id (spec §1). Optional, because a
   * workout you wrote this morning has no `@id` and you still did it — the
   * `snapshot` is what makes the record self-contained, and the id is what
   * makes it findable.
   */
  workout?: string;
  /** `YYYY-MM-DD`, or `YYYY-MM-DD HH:MM` where two sessions share a day. */
  date?: string;
  athlete?: string;
  /** Which division was read, in the sense `divisions()` means (spec §10.1). */
  division?: string;
  /**
   * The recurring session this was an instance of. `progress` compares like to
   * like and nothing else; without a slot, the workout id is the honest default
   * — two results of the same workout are the same session twice.
   */
  slot?: string;
  /** What was scored, as written. Checked against what the workout declares. */
  score?: string;
  /** Per-round or per-checkpoint times, as written. */
  splits: string[];
  loads: ResultLoad[];
  notes: string[];
  /**
   * The workout text as it was on the day, held **verbatim**.
   *
   * Verbatim is the whole point and it is why this is sliced out of the raw
   * source rather than read through the line tree and re-rendered: a snapshot
   * that has been through a formatter is a copy of what the formatter thinks
   * today, which is exactly the reference that was rejected in §3.2.1. Comments,
   * blank lines and the author's own indentation are part of what happened.
   */
  snapshot?: string;
  errors: { line: number; message: string }[];
}

const empty = (): Result => ({ splits: [], loads: [], notes: [], errors: [] });

const DATE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?$/;

/**
 * Reading a result is a line grammar, like a workout, a goals file and a program.
 *
 * Fields are read from the top level **and** from under a `result:` header, and
 * that is not a courtesy — it is forced. A `result:` naming no id ends in a
 * colon, so phase 1 opens a container and everything after it is its child
 * (spec §2). Accepting one shape would have made the id optional in the type and
 * unwritable in practice.
 */
export function parseResult(source: string): Result {
  const r = empty();
  const raw = source.split(/\r?\n/);
  const fail = (line: number, message: string) => r.errors.push({ line, message });

  const field = (node: Line) => {
    const colon = node.text.indexOf(':');
    if (colon === -1) { fail(node.line, `expected "<key>: <value>", got "${node.text}"`); return; }
    const key = node.text.slice(0, colon).trim().toLowerCase();
    const value = node.text.slice(colon + 1).trim();

    switch (key) {
      case 'result':
        if (value) r.workout = value;
        for (const child of node.children) field(child);
        return;
      // The one wrong guess anybody will make, because roadmap §3.2 sketched it
      // that way. Named rather than accepted: two spellings for the id is what
      // queue item 1 spent a day removing elsewhere, and `workout:` a field away
      // from `snapshot:` would be two names for the same workout.
      case 'workout':
        fail(node.line, 'the workout id goes on the `result:` line — `result: crossfit:fran`');
        return;
      case 'date':
        if (!DATE.test(value)) {
          fail(node.line, `date: expected YYYY-MM-DD, got "${value}"`);
        } else r.date = value;
        return;
      case 'athlete': r.athlete = value || undefined; return;
      case 'division': r.division = value || undefined; return;
      case 'slot': r.slot = value || undefined; return;
      case 'score': r.score = value || undefined; return;
      case 'splits':
        r.splits.push(...value.split(',').map((s) => s.trim()).filter(Boolean));
        return;
      case 'notes':
      case 'note':
        if (value) r.notes.push(value.replace(/^"|"$/g, ''));
        return;
      case 'loads':
      case 'load':
        for (const child of node.children) {
          const text = child.text.replace(/^-\s*/, '').trim();
          if (!text) continue;
          // `Back Squat @ 102.5kg`, in the step's own spelling. The `@` is where
          // this language already puts a load on a movement, and a result that
          // reads like the line it is a result of is one less thing to learn.
          const at = text.indexOf('@');
          if (at === -1) { fail(child.line, `loads: expected "<movement> @ <load>", got "${text}"`); continue; }
          const movement = text.slice(0, at).trim();
          const written = text.slice(at + 1).trim();
          if (!movement || !written) { fail(child.line, `loads: expected "<movement> @ <load>", got "${text}"`); continue; }
          r.loads.push({ movement, value: written, line: child.line });
        }
        return;
      case 'snapshot':
        r.snapshot = slice(raw, node.line, node.indent);
        if (r.snapshot === undefined) fail(node.line, 'snapshot: needs the workout text indented under it');
        return;
      default:
        fail(node.line, `unknown field "${key}"`);
    }
  };

  for (const node of readLines(source)) {
    if (!node.text) continue;
    field(node);
  }

  if (!r.workout && !r.snapshot && !r.errors.length) {
    fail(1, 'a result needs a workout id, a snapshot, or both — otherwise nothing says what it is a result of');
  }
  return r;
}

/**
 * The raw lines indented under a header, dedented, with nothing normalized.
 *
 * By line number and column rather than through the tree, because everything the
 * tree does to a line — dropping blanks, lifting comments onto their owner,
 * folding an unbalanced brace — is a change, and a snapshot that has been
 * changed is not a snapshot.
 */
function slice(raw: string[], headerLine: number, headerIndent: number): string | undefined {
  const body: string[] = [];
  for (let i = headerLine; i < raw.length; i++) {
    const text = raw[i];
    if (!text.trim()) { body.push(''); continue; }
    if (text.length - text.trimStart().length <= headerIndent) break;
    body.push(text);
  }
  while (body.length && !body[body.length - 1].trim()) body.pop();
  if (!body.length) return undefined;
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
  return body.map((l) => l.slice(indent)).join('\n');
}

/** Canonical text, in the order a person writes it: what, when, who, how it went. */
export function formatResult(r: Result): string {
  const out: string[] = [`result:${r.workout ? ` ${r.workout}` : ''}`];
  const line = (key: string, value?: string) => { if (value) out.push(`${key}: ${value}`); };
  line('date', r.date);
  line('athlete', r.athlete);
  line('division', r.division);
  line('slot', r.slot);
  line('score', r.score);
  if (r.splits.length) out.push(`splits: ${r.splits.join(', ')}`);
  for (const n of r.notes) out.push(`notes: ${n}`);
  if (r.loads.length) {
    out.push('', 'loads:');
    for (const l of r.loads) out.push(`  - ${l.movement} @ ${l.value}`);
  }
  if (r.snapshot !== undefined) {
    out.push('', 'snapshot:');
    for (const l of r.snapshot.split('\n')) out.push(l.trim() ? `  ${l}` : '');
  }
  return out.join('\n') + '\n';
}

// --- the instantiation ------------------------------------------------------

export interface Instantiated {
  /** The workout as this execution ran it: the division read, the loads used. */
  workout: Workout;
  diagnostics: Diagnostic[];
}

/**
 * The class, with one person's execution written onto it.
 *
 * Two layers, in order, and the order is the argument. A **division** is part of
 * the class — the author wrote both weights into the file, so `resolve()` is
 * reading the file rather than adding to it (spec §10.1). A **load** from the
 * result is not in the file at all; it is what this person lifted, so it is
 * applied second and wins over whatever the division prescribed. That is the
 * whole shape of scaling: the workout says 145lb, you did 125lb, and the record
 * of what you did is the one that is true of you.
 *
 * Loads are matched to steps by movement, through the registry, which is the
 * same machinery a `variants:` entry uses and for the same reason — `Thruster`
 * has to find a step written `21 Thrusters`.
 */
export function instantiate(w: Workout, r: Result, opts: ResolveOptions = {}): Instantiated {
  const diagnostics: Diagnostic[] = [];
  let workout = w;

  if (r.division) {
    const res = resolve(workout, r.division, opts);
    diagnostics.push(...res.diagnostics);
    if (!res.diagnostics.some((d) => d.severity === 'error')) workout = res.workout;
  }

  if (!r.loads.length) return { workout, diagnostics };

  const look = movementLookup(opts.registry);
  const used = new Set<ResultLoad>();
  const body = workout.body.map((n) => mapStep(n, (step) => {
    let out = step;
    for (const entry of r.loads) {
      if (!sameMovement(entry.movement, step.movement, look)) continue;
      used.add(entry);
      const targets = readLoad(entry.value);
      if (!targets) {
        diagnostics.push({
          severity: 'note', code: 'result-load-unread', line: entry.line,
          message: `\`${entry.movement} @ ${entry.value}\` is not a load or a height — `
            + 'the step is unchanged',
        });
        continue;
      }
      out = withTargets(out, targets);
    }
    return out;
  }));

  for (const entry of r.loads) {
    if (used.has(entry)) continue;
    diagnostics.push({
      severity: 'warning', code: 'result-load-unmatched', line: entry.line,
      message: `no step in this workout is a \`${entry.movement}\` — the load is recorded and unused`,
    });
  }

  return { workout: { ...workout, body }, diagnostics };
}

/**
 * What a recorded load says. A load, or a load and a height — `6kg to 9ft` is
 * one wall-ball prescription, and it is the same split the grammar makes on a
 * step line and `variants:` makes on a table value.
 *
 * A movement is deliberately *not* read here, unlike a `variants:` value. A
 * division may swap the movement because the author wrote the swap into the
 * class; what a person substituted on the day is a modification, and whether
 * those want structure or free text is still open (roadmap §3.2, open question).
 * Reading one here would settle it by accident.
 */
function readLoad(value: string): Target[] | null {
  const parts = value.split(/\s+to\s+/i).map((t) => parseTarget(t.trim()));
  return parts.length && parts.every((t) => t.kind === 'load' || t.kind === 'height') ? parts : null;
}

function mapStep(n: Node, f: (s: Step) => Step): Node {
  if (n.node === 'step') return f(n);
  if (n.node === 'block') return { ...n, children: n.children.map((c) => mapStep(c, f)) };
  return n;
}

// --- checking ---------------------------------------------------------------

export interface ResultCheck {
  diagnostics: Diagnostic[];
  /** The workout the snapshot holds, parsed, when there is one that reads. */
  workout?: Workout;
  /** That workout with this execution on it — what analysis should read. */
  instance?: Workout;
}

/**
 * What a result says against what it is a result of.
 *
 * Everything here needs the snapshot, which is the point of carrying one: a
 * record that cannot be checked against anything is a note to self, and this
 * says so rather than reporting nothing and looking clean.
 */
export function checkResult(r: Result, opts: ResolveOptions = {}): ResultCheck {
  const diagnostics: Diagnostic[] = [];

  if (!r.date) {
    diagnostics.push({ severity: 'note', code: 'result-no-date',
      message: 'no date — this result cannot be placed in a series, so `progress` cannot see it' });
  }
  if (r.snapshot === undefined) {
    diagnostics.push({ severity: 'note', code: 'result-no-snapshot',
      message: 'no snapshot — nothing here can be checked against the workout, and the record '
        + 'stops meaning anything if the file changes' });
    return { diagnostics };
  }

  const parsed = parse(r.snapshot);
  for (const e of parsed.errors) {
    diagnostics.push({ severity: 'error', code: 'result-snapshot-unreadable', line: e.line,
      message: `snapshot: ${e.message}` });
  }
  const workout = parsed.workout;

  const declared = workout.directives.id;
  if (declared && r.workout && declared !== r.workout) {
    diagnostics.push({ severity: 'warning', code: 'result-id-mismatch',
      message: `this result names \`${r.workout}\` and its snapshot declares \`@id ${declared}\` `
        + '— one of the two is pointing at the wrong workout' });
  }

  const { workout: instance, diagnostics: applied } = instantiate(workout, r, opts);
  diagnostics.push(...applied);
  diagnostics.push(...checkScore(r, workout));

  return { diagnostics, workout, instance };
}

/**
 * The declared score, which is what constrains the shape of a valid result
 * (roadmap §3.2).
 *
 * A workout-level `score:` is the statement about the whole. Failing that, a
 * single top-level block's score is the workout's score by default — `for time:`
 * on its own is a whole workout and its score is implied by the header. A
 * workout of several blocks each with its own score is not asked, because
 * composing sibling scores is `score: sum of blocks` and nobody has written one.
 *
 * Exported because the board asks the same question from the other side — it has
 * just run the workout and needs to know what it is allowed to claim it
 * measured — and a second reading of "what does this workout score by" would
 * drift from this one.
 */
export function declaredScore(w: Workout): string | undefined {
  if (w.score) return w.score.primary || undefined;
  const blocks = w.body.filter((n) => n.node === 'block');
  if (blocks.length !== 1) return undefined;
  const only = blocks[0];
  return only.node === 'block' ? only.score?.primary || undefined : undefined;
}

/** Ways a score can be written down, by what the workout said to rank by. */
const READS: Record<string, (text: string) => boolean> = {
  time: (t) => parseDuration(t) !== null,
  reps: (t) => /^\d+$/.test(t.trim()),
  rounds: (t) => /^\d+$/.test(t.trim()),
  'rounds + reps': (t) => /^\d+(\s*\+\s*\d+)?$/.test(t.trim().replace(/\s*(rounds?|reps?)\s*/gi, '')),
  calories: (t) => /^\d+\s*(cal|calories)?$/i.test(t.trim()),
  distance: (t) => parseTarget(t).kind === 'height' || /^\d+(\.\d+)?\s*(m|km|mi|ft|yd)$/i.test(t.trim()),
  load: (t) => parseTarget(t).kind === 'load',
  'max load': (t) => parseTarget(t).kind === 'load',
  complete: (t) => /^(yes|no|done|complete|dnf|scaled)$/i.test(t.trim()),
};

/**
 * A score of the wrong shape, reported rather than rejected.
 *
 * `warning` and not `error`: the workout still executes, the number was still
 * true of the day, and the reading most likely to be wrong is *this table's*.
 * A primary the table has no entry for says nothing at all — a score this
 * project has not modelled yet is not a fault in somebody's log.
 */
function checkScore(r: Result, w: Workout): Diagnostic[] {
  const primary = declaredScore(w);
  if (!primary) {
    if (r.score) return [];
    return [{ severity: 'note', code: 'result-no-score',
      message: 'no score, and the workout declares none either — the record says it was done '
        + 'and nothing more' }];
  }
  if (!r.score) {
    return [{ severity: 'note', code: 'result-no-score',
      message: `the workout is scored by \`${primary}\` and this result records none` }];
  }
  // A capped for-time scores time, or reps if the cap was reached (spec §9.5),
  // so both readings are correct and either spelling is the truth about the day.
  const kinds = [primary, w.score?.onCap].filter(Boolean) as string[];
  const known = kinds.map((k) => READS[k.replace(/\s+per round$/, '')]).filter(Boolean);
  if (!known.length || known.some((reads) => reads(r.score!))) return [];
  return [{ severity: 'warning', code: 'result-score-shape',
    message: `the workout is scored by \`${primary}\` and \`${r.score}\` does not read as one` }];
}

// --- a series of executions -------------------------------------------------

/**
 * Results in the order they happened, ready for `checkSeries`.
 *
 * **Ordered by date as text.** An ISO date sorts correctly as a string, so
 * nothing here constructs a `Date`, which is the whole of how this avoids the
 * timezone bug that cost a day in `generate` — a stamp read in one zone and
 * written in another. Undated results keep the order they were given, at the
 * front, and `checkResult` has already said they cannot be placed.
 *
 * **The slot is what makes `progress` mean anything.** Two results of the same
 * workout are the same session twice, so the workout id is the default; a result
 * may name its own where a slot spans several files, exactly as a program entry
 * does.
 */
export function resultSeries(results: Result[], opts: ResolveOptions = {}): SeriesEntry[] {
  const dated = results.map((r, i) => ({ r, i }));
  dated.sort((a, b) => (a.r.date ?? '').localeCompare(b.r.date ?? '') || a.i - b.i);
  return dated.flatMap(({ r }) => {
    if (r.snapshot === undefined) return [];
    const { workout } = instantiate(parse(r.snapshot).workout, r, opts);
    return [{
      name: [r.date, workout.title || r.workout || 'a result'].filter(Boolean).join(' · '),
      timeline: compile(workout),
      slot: r.slot ?? r.workout ?? workout.title,
    }];
  });
}
