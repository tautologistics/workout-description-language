/**
 * The board: a workout as written, with a marker for where you are.
 *
 * All the thinking is in @wdl/core — parse, compile, run. This file holds the
 * two things a browser adds and the core deliberately does not: a clock, and a
 * position in the cue list. Keeping those out of the core is what lets the same
 * run script drive a screen, a watch and a test.
 *
 * The board renders the *source text*, line for line. It would be easier to
 * render the cue list, and it would be wrong: the point of the format is that
 * what you wrote is what you read, and a display that regenerates the workout
 * into its own layout is quietly asserting the text was not good enough.
 *
 * Since 2026-08-23 it holds a fourth: **what happened**. A result is the record
 * of one execution, and the board is the only thing in this project that can
 * write one — it held the clock and it held the cursor, which is exactly the
 * pair the core deliberately does not have. What it writes is the format's own
 * text, editable before you keep it, because a claim about your session should
 * be readable by you first.
 *
 * Since 2026-08-20 it holds a third such thing: which **division** is being
 * read. That is not something the core lacks — `resolve()` is core — but the
 * *choosing* is a reader's act, like the clock and the cursor, and like them it
 * never touches the file. The rows go on saying what everyone does; the bar says
 * what you do.
 */

import { parse } from '../../build/web/core/parse.js';
import { compile } from '../../build/web/core/timeline.js';
import { run, roundLabel } from '../../build/web/core/run.js';
import { validate } from '../../build/web/core/validate.js';
import { divisions, resolve } from '../../build/web/core/variants.js';
import { declaredScore } from '../../build/web/core/result.js';
import { provide, has } from '../../build/web/core/env.js';
import { exposures, musclesFor } from '../../build/web/core/muscles.js';
import { mountBody, paintBody, aggregateStates, highlightStates, attachZoom } from '../shared/body-map.js';
import { getById as pbGetById } from '../shared/pocketbase.js';

// The core is handed its data; it reads no files itself. On Node that is
// packages/core/node.ts, here it is a fetch.
const GRAMMAR = '../../spec/grammar-0.1.ohm';
const REGISTRY = '../../registry/movements.json';
const CANONICAL = '../../registry/movements.canonical.json';
const MUSCLES = '../../registry/muscles.json';

// The grammar first, and awaited: `parse` is that file, so unlike the registry
// below — which only takes the validation hints with it — a board without it is
// not a degraded board, it is no board. Say so on the screen rather than leaving
// a Start button that does nothing.
try {
  const source = await fetch(new URL(GRAMMAR, location.href))
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status} ${r.statusText}`))));
  provide({ grammar: () => source });
} catch (e) {
  document.body.textContent = `Cannot read ${GRAMMAR} — the parser is that file. ${e.message}`;
  throw e;
}

const el = (id) => document.getElementById(id);
const bar = el('bar');
const board = el('board');
const controls = el('controls');
const problems = el('problems');
const picker = el('division');
const pickerRow = el('division-pick');
const bodyEl = attachZoom(mountBody(el('bodymap')));
const AGG_COLOR = '#5b8dd9';
// The same yellow the current cue is marked with elsewhere on the board —
// "what you are doing right now" reads as one colour throughout.
const HI_COLOR = 'var(--now)';

const SAMPLES = {
  Fran: '# Fran\nfor time:\n  21-15-9:\n    - Thruster @ 95lb\n    - Pull-Up\n',
  Cindy: '# Cindy\nAMRAP 20min:\n  - 5 Pull-Up\n  - 10 Push-Up\n  - 15 Air Squat\n',
  '5×5': '# Back squat\n5 sets:\n  - 5 Back Squat @ 225lb\n  rest 3min\n',
  Intervals: '# Threshold\n6 rounds:\n  - 3min Row @ 90% FTP\n  rest 90s\n',
  // A section that repeats inside one that does not: the run and the row happen
  // once, the middle comes round until its own clock stops it.
  'Buy-in': '# Buy-in\nfor time:\n  - 800m Run\n  AMRAP 10min:\n'
    + '    - 10 Kettlebell Swing @ 53lb\n    - 10 Box Jump\n  - 800m Run\n',
};

/** Everything that changes as the workout runs. */
const state = {
  source: '',
  workout: undefined, // the file as parsed. Kept so that choosing a division can
                      // re-cue without reparsing, and so the picker knows what
                      // this workout offers.
  division: '',       // '' is "as written" — every division at once, which is
                      // what the file says and what a whiteboard shows.
  errors: [],
  lines: [],
  cues: [],
  cycles: [],
  cap: undefined,    // seconds, when a cap bounds the whole workout
  timeUp: false,     // the cap ran out; the cursor stopped where it stood
  exposures: [],
  at: -1,            // -1 is "not started"
  startedAt: 0,      // ms, for the whole workout
  cueStartedAt: 0,   // ms, for the current cue
  cycleStartedAt: 0, // ms, for the section that repeats
  running: false,
  lap: 0,            // completed passes of the section the cursor is in
  // Cumulative workout seconds at each round boundary. Deltas are computed when
  // the record is written; keeping the running total means a split never drifts
  // from the clock above it.
  splits: [],
  // Source lines the cursor has been on since the last split. Coming back to one
  // is what closes a round; see `crossed`.
  seen: new Set(),
};

/**
 * The section the cursor is inside, when one comes round again.
 *
 * `run` reports these as cue ranges. A workout that is entirely an AMRAP has one
 * covering every cue; a buy-in around one has a cycle covering only the middle,
 * and that difference is the whole of why the board cannot simply loop the cue
 * list — the run before it and the row after it happen once.
 */
const cycleAt = (i) => state.cycles.find((c) => i >= c.from && i < endOf(c));
const endOf = (c) => c.to ?? state.cues.length;

// --- rendering --------------------------------------------------------------

const fmt = (s) => {
  const n = Math.max(0, Math.floor(s));
  const m = Math.floor(n / 60);
  return `${m}:${String(n % 60).padStart(2, '0')}`;
};

/**
 * Draw the source, one row per line.
 *
 * Rows are built once and kept; moving the marker only changes class names.
 * Rebuilding the board every tick would make the text flicker on a big screen
 * and would lose the scroll position, which matters on a long workout.
 */
function draw() {
  board.innerHTML = '';
  state.rows = state.lines.map((text, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    if (!text.trim()) row.classList.add('blank');
    else if (text.trimStart().startsWith('//')) row.classList.add('comment');
    row.dataset.line = String(i + 1);
    const mark = document.createElement('span');
    mark.className = 'mark';
    mark.textContent = '▸';
    const body = document.createElement('span');
    body.className = 'text';
    body.textContent = text || ' ';
    row.append(mark, body);
    board.append(row);
    return row;
  });
}

function paint() {
  const cue = state.cues[state.at];
  const cycle = cycleAt(state.at);
  const nowLine = cue?.line;

  // A line is spent when nothing still to come points at it — not merely when
  // it has been passed once. In `21-15-9` the pull-up is behind you three times
  // and finished only the last, and dimming it after the first round would tell
  // you the workout is nearly over when a third of it is left.
  // Inside a section that repeats, "still to come" starts at the top of that
  // section rather than at the cursor: the cue you just finished comes round
  // again. Nothing in the section is ever spent, and everything before it —
  // the buy-in — still is.
  // Only lines a cue points at are candidates: a block header or a title is
  // never "done", it is context, and dimming it would empty the board.
  const spent = new Set(state.cues.map((c) => c.line));
  const ahead = Math.max(0, cycle ? Math.min(state.at, cycle.from) : state.at);
  for (let i = ahead; i < state.cues.length; i++) spent.delete(state.cues[i].line);

  for (const row of state.rows ?? []) {
    const line = Number(row.dataset.line);
    row.classList.toggle('now', line === nowLine);
    row.classList.toggle('done', line !== nowLine && spent.has(line));
  }
  if (nowLine !== undefined) {
    const row = state.rows[nowLine - 1];
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // Three states, and "finished" is not the same as "not started": a board that
  // says Ready when you have just done the last rep is telling you nothing
  // happened.
  const finished = state.cues.length > 0 && state.at >= state.cues.length;
  // The cap ran out. Distinct from `finished`: the cursor is still on a real
  // cue, mid-workout, and the label says so rather than claiming "Done" —
  // "Done" would say the athlete reached the last cue, which capping out never
  // certifies.
  const timeUp = state.timeUp;
  el('now-label').textContent = cue ? cue.label : finished ? 'Done' : 'Ready';
  // The division leads, and it is the one item here that never changes while
  // the workout runs. It earns the place because the label above it may name a
  // weight that differs from the line on the board below — the board says what
  // everyone does, the bar says what *you* do — and the reason for the
  // difference has to sit next to the number, not in the footer.
  el('now-sub').textContent = [
    state.division,
    cue ? roundLabel(cue.rounds) : '',
    cycle ? cycle.label : '',
    cycle && state.lap ? `pass ${state.lap + 1}` : '',
    cue?.pacing === 'athlete' && !timeUp ? 'press space when done' : '',
    timeUp ? 'time — cap reached' : '',
    finished ? `${state.cues.length} cues` : '',
  ].filter(Boolean).join(' · ');

  // The `+` says the count is not the whole story: inside a section that repeats
  // there are more cues to come than the list has in it.
  el('position').textContent = state.cues.length
    ? `${Math.min(Math.max(0, state.at + 1), state.cues.length)} / ${state.cues.length}${cycle ? '+' : ''}`
    : '';
  el('prev').disabled = state.at <= 0 || timeUp;
  el('next').disabled = !state.cues.length || finished || timeUp;
  // A section with no clock ends when the athlete says so, and there has to be
  // something to say it with. Shown only where it means something — and once
  // the cap has ended the workout there is nothing left to leave.
  el('leave').hidden = !cycle || timeUp;
  el('start').disabled = finished || timeUp;
  // Once a session has begun there is something to record, whether or not it
  // reached the end: a workout you stopped halfway still happened.
  el('record-open').hidden = state.at < 0;
  el('start').textContent = state.running ? 'Pause' : timeUp ? 'Time' : state.at < 0 ? 'Start' : 'Resume';

  // The whole workout as a constant, the current cue's movement emphasised on
  // top — the same two layers as the builder's per-movement highlight, driven
  // by the cursor instead of a hover.
  const attribution = cue?.movement && has('canonicalMovements') ? musclesFor(cue.movement) : undefined;
  paintBody(bodyEl, attribution
    ? highlightStates(state.exposures, attribution, AGG_COLOR, HI_COLOR)
    : aggregateStates(state.exposures, AGG_COLOR));
}

/** Seconds spent in the section the cursor is in, frozen while paused. */
function cycleElapsed() {
  const now = performance.now();
  return state.running ? (now - state.cycleStartedAt) / 1000 : state.heldCycle ?? 0;
}

/** True when a section's own clock has run out. A section with none never has. */
function expired(cycle) {
  return cycle.window !== undefined && cycleElapsed() >= cycle.window;
}

/**
 * True when the workout's own cap has run out. A workout with none never has.
 *
 * `Run.cap` counts only on the spine (the same rule a window follows), so this
 * is the workout's own deadline rather than any one section's — a section
 * inside a capped workout can still expire first, and does, in `77-tiff.wdl`.
 */
function capExpired() {
  return state.cap !== undefined && totalElapsed() >= state.cap;
}

/**
 * The clock ticks on the cue, on the section, and on the workout as a whole.
 *
 * The big number is the nearest deadline: the cue's if it has one, otherwise the
 * section's, otherwise nothing to count down to and it counts up. Inside a
 * 20-minute AMRAP the useful number is how much of the twenty is left, not how
 * long you have been on this set of ten — but during a 3-minute row inside one,
 * the row's clock is nearer, and the twenty goes to the line below.
 *
 * A timed cue counts *down*, because what matters mid-effort is how much is
 * left, and one that overruns keeps counting, in red, rather than sitting at
 * zero pretending the athlete finished.
 *
 * A cap is a third clock on top of the cue and the section, and reads as the
 * same "the clock" the section already does — the athlete cares which number
 * is nearer, not which field of the file produced it. `77-tiff.wdl` runs a
 * cap and a section clock at once (`for time, cap 25min:` around a bare
 * `AMRAP:`), so `onClock` takes whichever of the two is closer, the same way
 * a cue's own clock already outranks the section's.
 */
function tick() {
  const cue = state.cues[state.at];
  const cycle = cycleAt(state.at);
  const now = performance.now();
  const elapsed = state.running ? (now - state.cueStartedAt) / 1000 : state.heldCue ?? 0;
  const total = state.running ? (now - state.startedAt) / 1000 : state.heldTotal ?? 0;
  const sectionClock = cycle?.window !== undefined ? cycle.window - cycleElapsed() : undefined;
  const capClock = state.cap !== undefined ? state.cap - total : undefined;
  const onClock = sectionClock === undefined ? capClock
    : capClock === undefined ? sectionClock
    : Math.min(sectionClock, capClock);

  let text, sub, waiting = false, overrun = false, aside = '';
  if (!cue) {
    text = fmt(total);
    sub = 'elapsed';
  } else if (cue.seconds !== undefined) {
    const left = cue.seconds - elapsed;
    overrun = left < 0;
    text = (overrun ? '+' : '') + fmt(Math.abs(left));
    sub = overrun ? 'over' : 'left';
    if (onClock !== undefined) aside = `${fmt(Math.max(0, onClock))} on the clock`;
  } else if (onClock !== undefined) {
    text = fmt(Math.max(0, onClock));
    sub = 'left on the clock';
  } else {
    waiting = true;
    text = fmt(elapsed);
    sub = 'on this';
  }

  el('clock').textContent = text;
  el('clock-sub').textContent = [sub, aside, `${fmt(total)} total`].filter(Boolean).join(' · ');
  bar.classList.toggle('waiting', waiting && !overrun);
  bar.classList.toggle('overrun', overrun);

  // The cap ends the whole workout where the cursor stands — spec §5.6 — so it
  // is checked before a section's own clock: the outermost deadline outranks
  // one that only bounds part of the work, the same way a section's clock
  // outranks a cue's.
  if (state.running && capExpired()) { capOut(); return; }
  // The clock that bounds a section ends it where you stand: an AMRAP does not
  // let you finish the round you are in. Checked before the cue's own clock
  // because it is the outer deadline — the last row of a 20-minute AMRAP does
  // not get its three minutes because it started at 19:00.
  if (state.running && cycle && expired(cycle)) { leave(); return; }

  // A timed cue advances itself. That is the whole difference between a board
  // and a runtime, and it is one line because `run` already decided which cues
  // end by themselves.
  if (state.running && cue?.seconds !== undefined && elapsed >= cue.seconds && cue.pacing === 'timed') {
    advance(1);
  }
}

// --- moving through the workout ---------------------------------------------

/** What each section has already taken, and how many passes, while away from it. */
const visited = new Map();

/**
 * Move the cursor, and start whatever clocks the move starts.
 *
 * Arriving in a section starts that section's clock. A 20-minute AMRAP between
 * a buy-in and a buy-out is on twenty minutes of its own, and they begin when
 * you reach it — not when the workout did.
 *
 * Arriving *back* in one does not restart it. Stepping over the line and back
 * is how a mis-tap is undone, and a board that answered that with a fresh
 * twenty minutes would be a way to cheat the clock by pressing Back.
 */
function goTo(index) {
  const from = cycleAt(state.at);
  const into = cycleAt(index);
  if (into !== from) {
    if (from) visited.set(from, { elapsed: cycleElapsed(), lap: state.lap });
    if (into) {
      const seen = visited.get(into) ?? { elapsed: 0, lap: 0 };
      state.lap = seen.lap;
      state.heldCycle = seen.elapsed;
      state.cycleStartedAt = performance.now() - seen.elapsed * 1000;
    }
  }
  state.at = index;
  state.cueStartedAt = performance.now();
  if (!state.running) state.heldCue = 0;
  paint();
  tick();
}

function finish() {
  markSplit();
  state.at = state.cues.length;
  state.running = false;
  hold();
  paint();
  tick();
  // The record is what the session was for; it should not need finding. Shown
  // rather than written over anything the athlete has already typed into it.
  if (state.splits.length || state.at > 0) showRecord();
}

/**
 * The cap ran out. Spec §5.6: the workout ends — so, unlike `finish()`, the
 * cursor is left exactly where it stands rather than moved to the last cue. A
 * cap did not certify the athlete reached the end of what was written, only
 * that the clock did; `state.at` staying put is what keeps `measuredScore`
 * honest about that, and what a score *on cap* means is item 2's question, not
 * this one's.
 */
function capOut() {
  markSplit();
  state.running = false;
  state.timeUp = true;
  hold();
  paint();
  tick();
  if (state.splits.length || state.at > 0) showRecord();
}

/**
 * Step out of a section that repeats — its clock ran out, or the athlete is
 * done. It leaves from wherever the cursor stands: an AMRAP does not owe you
 * the rest of the round you were in.
 */
function leave() {
  const cycle = cycleAt(state.at);
  if (!cycle) return;
  const to = endOf(cycle);
  if (to >= state.cues.length) finish(); else goTo(to);
}

function advance(by) {
  const cycle = cycleAt(state.at);
  const next = state.at + by;
  // A section comes round again at its *own* end, not the workout's. The AMRAP
  // between a buy-in and a buy-out returns to the top of the AMRAP; the run
  // before it stays behind you and the row after it waits its turn. Once the
  // section's clock is up it is over, and falling through ends it.
  if (cycle && next >= endOf(cycle) && !expired(cycle)) {
    state.lap++;
    crossed(cycle.from);
    goTo(cycle.from);
    return;
  }
  if (next >= state.cues.length) finish();
  else {
    // Forward only. Stepping back is how a mis-tap is undone, and a board that
    // recorded a split for it would put a number in the log that names nothing
    // the athlete did.
    if (by > 0) crossed(next);
    goTo(Math.max(0, next));
  }
}

/**
 * Arriving at a cue, and noticing when it means a round has closed.
 *
 * **A round is a line you have already been on.** That is the whole rule, and it
 * is a fact about the cue list rather than a guess: coming back to a line you
 * passed since the last split is what going round again *is*.
 *
 * The obvious rule was the wrong one. `Cue.rounds` looks like the answer — it is
 * literally called rounds — but `run` only fills it for a block that *repeats*,
 * and `21-15-9` does not repeat: the timeline expands a rep scheme into three
 * explicit tiers (`compile`, the `ladder` case), so every cue in Fran carries an
 * empty round list. A board keying on it recorded no splits at all for the one
 * workout the roadmap uses to illustrate them. Found by running Fran on the
 * board, which is the only way it could have been.
 *
 * One rule covers all three shapes for the same reason: a ladder tier, a round
 * of a `5 sets:` and a pass of an AMRAP all return the cursor to a line it has
 * already been on.
 */
function crossed(index) {
  const line = state.cues[index]?.line;
  if (line === undefined) return;
  if (state.seen.has(line)) { markSplit(); state.seen.clear(); }
  state.seen.add(line);
}

/**
 * Close a split at the elapsed workout time.
 *
 * Cumulative, and turned into deltas only when the record is written — so a
 * split can never disagree with the clock that was on the screen. A boundary
 * crossed in under a second is a mis-tap being corrected rather than a round,
 * and recording it would put a `0:00` in a log of real efforts.
 */
function markSplit() {
  if (state.at < 0) return;
  const total = state.running ? (performance.now() - state.startedAt) / 1000 : state.heldTotal ?? 0;
  const last = state.splits[state.splits.length - 1] ?? 0;
  if (total - last < 1) return;
  state.splits.push(total);
}

/** Freeze the clocks where they are, so pausing does not lose the count. */
function hold() {
  const now = performance.now();
  state.heldCue = (now - state.cueStartedAt) / 1000;
  state.heldTotal = (now - state.startedAt) / 1000;
  state.heldCycle = cycleAt(state.at) ? (now - state.cycleStartedAt) / 1000 : 0;
}

function resume() {
  const now = performance.now();
  state.cueStartedAt = now - (state.heldCue ?? 0) * 1000;
  state.startedAt = now - (state.heldTotal ?? 0) * 1000;
  state.cycleStartedAt = now - (state.heldCycle ?? 0) * 1000;
}

function toggle() {
  if (!state.cues.length) return;
  const starting = state.at < 0;
  if (starting) {
    state.heldCue = 0;
    state.heldTotal = 0;
    state.heldCycle = 0;
  }
  state.running = !state.running;
  if (state.running) resume(); else hold();
  // Starting goes through `goTo` so that a workout which opens with a section —
  // an AMRAP with nothing before it — starts that section's clock too.
  if (starting) { crossed(0); goTo(0); } else { paint(); tick(); }
}

function reset() {
  visited.clear();
  clearRecord();
  state.at = -1;
  state.lap = 0;
  state.splits = [];
  state.seen.clear();
  state.running = false;
  state.timeUp = false;
  state.heldCue = 0;
  state.heldTotal = 0;
  state.heldCycle = 0;
  paint();
  tick();
}

// --- the record -------------------------------------------------------------

/**
 * Today, in local time.
 *
 * `toISOString` is the obvious call and it is the wrong one: it converts to UTC,
 * so a session finished at nine in the evening west of Greenwich is stamped
 * tomorrow. This cost a day in `generate` once already — a stamp is read in
 * local time, so it must be written in local time.
 */
function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `8:42`, and `1:04:19` once a session runs past the hour. */
function clockText(seconds) {
  const n = Math.max(0, Math.round(seconds));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/** Seconds on the workout clock, whether it is running or held. */
const totalElapsed = () =>
  (state.running ? (performance.now() - state.startedAt) / 1000 : state.heldTotal ?? 0);

/**
 * What the board is *entitled* to claim it measured.
 *
 * It held a clock and it counted passes, and that is the whole of what it knows.
 * A workout scored by time gets its time; one scored by rounds gets the passes
 * of the section that repeats. Everything else — a load, a tiebreak, the reps in
 * the last partial round — is a fact about the athlete that no clock observed,
 * so the board says it could not and leaves the line to be typed. Writing a
 * plausible number there would be the board making something up about somebody's
 * training, which is the one thing a log must never do.
 */
function measuredScore() {
  const primary = declaredScore(state.workout) ?? '';
  const total = totalElapsed();
  if (/time/.test(primary) || !primary) {
    return { score: clockText(total), note: primary ? undefined
      : 'this workout declares no score — the time is what the board measured' };
  }
  if (/^rounds/.test(primary)) {
    // `lap` counts passes of a section that comes round again, and is exact —
    // it counts loops, not clock. A workout with no such section has no laps at
    // all, so a `5 sets:` scored by rounds would have recorded **zero**; there
    // the rounds are the boundaries the cursor crossed, which is what a split
    // already is.
    const passes = state.cycles.length ? state.lap : state.splits.length;
    return {
      score: String(passes),
      note: primary === 'rounds + reps'
        ? `${passes} full passes in ${clockText(total)} — add the reps of the one you were in`
        : undefined,
    };
  }
  return { note: `the workout is scored by \`${primary}\`, which no clock can see — `
    + `it took ${clockText(total)}` };
}

/**
 * The session, as a result record.
 *
 * Written in the format rather than through `formatResult`, because what belongs
 * on the screen here is not only the record: it is the record *plus what the
 * board could not measure*, as comments, so nothing measured is thrown away and
 * nothing unmeasured is invented. Comments are stripped when it is read back,
 * which is exactly right — a hint is not data.
 */
function recordText() {
  const w = state.workout;
  const id = w?.directives?.id;
  const out = [];
  const { score, note } = measuredScore();

  out.push(`result:${id ? ` ${id}` : ''}`);
  if (!id) out.push('// no @id on the workout — the snapshot below is what makes this findable');
  out.push(`date: ${today()}`);
  if (state.division) out.push(`division: ${state.division}`);
  if (note) out.push(`// ${note}`);
  if (score !== undefined) out.push(`score: ${score}`);

  // Deltas, from the cumulative marks. Fewer than two and the only split is the
  // whole workout, which the score already says.
  if (state.splits.length > 1) {
    const deltas = state.splits.map((at, i) => clockText(at - (state.splits[i - 1] ?? 0)));
    out.push(`splits: ${deltas.join(', ')}`);
  }

  // The loads the *file* states, commented out, one per movement that carries
  // one. Offered rather than filled in: what the workout prescribes is not
  // evidence of what anybody lifted, and an absent field is not a claim.
  const loaded = [...new Set(state.cues.filter(hasLoad).map((c) => c.movement))];
  if (loaded.length) {
    out.push('', '// what you actually lifted, where it was not what the file says:');
    out.push('// loads:');
    for (const m of loaded) out.push(`//   - ${m} @ `);
  }

  out.push('', 'snapshot:');
  for (const line of state.source.replace(/\n+$/, '').split('\n')) {
    out.push(line.trim() ? `  ${line}` : '');
  }
  return out.join('\n') + '\n';
}

/** A cue whose line prescribes a weight, which is the only kind worth offering. */
const hasLoad = (cue) => !!cue.movement && /@/.test(cue.label);

/** Forget the record, so the next session writes its own rather than inheriting. */
function clearRecord() {
  const box = el('record-text');
  if (box) box.value = '';
  const panel = el('record');
  if (panel) panel.hidden = true;
}

function showRecord() {
  const box = el('record-text');
  // Never over what is already there: the panel opens on finishing and again on
  // the button, and the second time would otherwise wipe what was typed.
  if (!box.value.trim()) box.value = recordText();
  el('record').hidden = false;
  said('');
}

const said = (text) => { el('record-said').textContent = text; };

/** The filename a person would have chosen: the date and what it was. */
function recordName() {
  const title = (state.workout?.title || 'result').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${today()}-${title || 'result'}.wdlr`;
}

// --- loading ----------------------------------------------------------------

/**
 * Where a diagnostic points, when it points anywhere.
 *
 * Three of `validate`'s findings are facts about the whole workout rather than
 * about a line, and `unknown-division` is a fourth — so they carry no `line`,
 * and the board used to print the word `undefined` in front of a message that
 * was otherwise correct. A known debt before this item; the picker would have
 * made it easy to hit, so it goes here.
 */
const where = (d) => (d.line === undefined ? d.message : `line ${d.line}: ${d.message}`);

/**
 * The URL is the share link, the hash is the workout — and now the division too.
 *
 * `encodeURIComponent` escapes `&`, so an `&` in the hash can only be one this
 * function put there. That makes it a separator no workout text can forge, and
 * it leaves every link written before today reading exactly as it did.
 *
 * **Why the division survives a reload at all.** The queue item asked the
 * question and answered it from a premise that turns out to be false — *"the
 * board already keeps position across one"*. Measured 2026-08-20: it does not.
 * `load` ends in `reset`, so a reload restarts the session. What survives is the
 * workout and nothing else, because the hash is what survives. So the analogy to
 * draw is not to the position but to the workout: a division is not progress
 * through a session, it is *which reading of the file is on the screen* — and
 * that is exactly what the hash already carries. Sharing the link shares the
 * reading, which is a coherent thing to send someone: "today's HYROX, women's".
 */
/**
 * A saved workout the URL points at by id: `/apps/display/?w=<id>`.
 *
 * This is the share link for an account-saved workout (builder item 20). A
 * pretty `/w/<id>` was the alternative and was dropped: PocketBase serves
 * `pb_public/` with an index fallback, so an unknown path like `/w/abc` just
 * returns the root `index.html` — a real `/w/<id>` route would need a
 * `pb_hooks` handler, i.e. an infra change, for no gain over a query param on
 * a file that actually exists. The `#<source>` hash mechanism is untouched and
 * still authoritative when both are present is decided in the bootstrap below.
 */
const sharedId = () => new URLSearchParams(location.search).get('w') || '';

/** Fetch a shared workout and run it, or show a "not found" line (never crash). */
async function loadShared(id) {
  try {
    const rec = await pbGetById(id);
    if (!rec?.source) throw new Error('empty');
    load(rec.source, '', false);
  } catch (e) {
    // A `private` record 404s for a stranger; a bad id 404s too. Either way the
    // board stays on its empty drop-zone with a line saying why.
    problems.hidden = false;
    problems.textContent = e.status === 404 || e.message === 'empty'
      ? 'That workout could not be found — the link may be wrong, or it may be private.'
      : `Could not load that workout: ${e.message}`;
  }
}

const readHash = () => {
  const raw = location.hash.slice(1);
  const at = /&division=([^&]*)$/.exec(raw);
  return {
    source: decodeURIComponent(at ? raw.slice(0, at.index) : raw),
    division: at ? decodeURIComponent(at[1]) : '',
  };
};

const writeHash = () => {
  location.hash = encodeURIComponent(state.source)
    + (state.division ? `&division=${encodeURIComponent(state.division)}` : '');
};

/**
 * Offer what this workout offers, in the order `divisions()` gives them — which
 * is stable, so the options do not shuffle between one render and the next.
 *
 * Hidden when there is nothing to choose. Most workouts prescribe one thing to
 * everyone, and a control whose only answer is "as written" is a question that
 * should not have been asked.
 */
function offerDivisions() {
  const names = divisions(state.workout);
  pickerRow.hidden = !names.length;
  picker.innerHTML = '';
  for (const name of ['', ...names]) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name || 'as written';
    picker.append(option);
  }
}

/**
 * The canonical merge, fetched at most once and only when something needs it.
 *
 * A `variants:` value may name a **movement to swap in**, and `resolve()` proves
 * one against the registry because a movement name cannot prove itself from its
 * own text. It consults both registries for a reason recorded when it was
 * written: `Ring Row` — spec §10's own example of a swap — is in the canonical
 * merge and not in the curated one, so the curated registry alone makes the
 * spec's own example unreadable. The board had only the curated one, so a real
 * movement came back reported as *not a movement in the registry*, which is not
 * merely a missed swap but a false statement on the screen.
 *
 * It is 1.7MB, which is why it is not simply fetched beside the other one. It
 * is asked for on exactly one signal: the resolver has said it could not read a
 * value. A value that read fine as a load or a height was never going to consult
 * a registry, so a bigger one cannot change the answer — the HYROX file, whose
 * `variants:` table is five loads, never pays. Re-cue when it lands, so the swap
 * appears rather than waiting for the next thing to move.
 *
 * **The size is the crude part of this fix and it is worth saying so.** What the
 * resolver needs from 1.7MB is names, and a slim name index would do the same
 * job for a fraction of it — see `known-debts.md`.
 */
let canonical;
function wantCanonical() {
  if (canonical || has('canonicalMovements')) return;
  canonical = fetch(new URL(CANONICAL, location.href))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
    .then((data) => { provide({ canonicalMovements: () => data.movements }); recue(); paint(); })
    .catch((e) => console.warn('no canonical registry, a variant naming a movement may not resolve:', e.message));
}

/**
 * Build the cue list from the workout the chosen division reads.
 *
 * **Choosing never touches the file, and it never touches the board either.**
 * The rows go on saying what was written — both magnitudes for an rx split, the
 * whole `variants:` table for the other spelling — and what follows the division
 * is the running headline. That is not a compromise with "the board renders
 * source text, line for line"; it is the same split one layer down. The written
 * workout is the class and the board shows the class; a division is the face of
 * it you are doing, and the bar is where the runtime's facts about *this* run
 * already live. Nothing has to rewrite a line to make a division visible,
 * because in both spellings the line already shows every division at once.
 *
 * Called again whenever the division changes, and deliberately without touching
 * the cursor or the clocks: a reader who says "women" three rounds in is
 * answering a question about the weights, not asking to start over.
 */
function recue() {
  let workout = state.workout;
  const chosen = [];
  if (state.division) {
    const r = resolve(workout, state.division);
    chosen.push(...r.diagnostics);
    // The one thing a bigger registry can change: a value the resolver could not
    // read may be a movement it was simply never handed.
    if (chosen.some((d) => d.code === 'variant-value-unread')) wantCanonical();
    // A division this workout does not offer is an error, and the board must not
    // then go on claiming to read it. Unreachable from the picker, which is
    // built from `divisions()` — and perfectly reachable from a link, which is
    // why it is handled here rather than trusted to the control.
    if (r.diagnostics.some((d) => d.severity === 'error')) state.division = '';
    else workout = r.workout;
  }
  picker.value = state.division;

  const timeline = compile(workout);
  const laid = run(timeline);
  // For the body map: which division is read never changes what a step
  // works, so this is the one thing here resolving cannot change — recomputed
  // anyway because it is cheap and `timeline` is a new object either way.
  state.exposures = has('muscles') && has('canonicalMovements') ? exposures(timeline).list : [];

  // Resolving changes what a step prescribes, never how the workout is shaped,
  // so the cue ranges come back identical — but the objects are new and
  // `visited` is keyed by identity. Carry it across by range, or a section left
  // before the switch and returned to after it loses its clock and its passes.
  const carried = [...visited].flatMap(([was, seen]) => {
    const now = laid.cycles.find((c) => c.from === was.from && c.to === was.to);
    return now ? [[now, seen]] : [];
  });
  visited.clear();
  for (const [cycle, seen] of carried) visited.set(cycle, seen);

  state.cues = laid.cues;
  state.cycles = laid.cycles;
  state.cap = laid.cap;

  // Errors mean the board is showing something the parser did not fully
  // understand. Say so, and show it anyway — a workout you can read beats a
  // blank screen, and mid-session is the worst time to be told to go and fix
  // your file.
  //
  // `validate` runs on the workout the division reads, which is what
  // `wdl check --variant` does: one flag, one meaning. A resolve diagnostic
  // joins them whatever its severity, and that is the exception worth stating —
  // a `note` here says a step did *not* take the division that was asked for,
  // and a weight quietly left at another division's is the failure this control
  // exists to prevent.
  const diagnostics = [
    ...state.errors.map(where),
    ...validate(workout).filter((d) => d.severity === 'error').map(where),
    ...chosen.map(where),
    ...laid.warnings,
  ];
  problems.hidden = !diagnostics.length;
  problems.textContent = diagnostics.join('\n');
}

/**
 * `toUrl: false` when the source came from `?w=<id>` — the id *is* the share
 * link, so the board leaves the clean `?w=<id>` in the address bar rather than
 * expanding the whole workout into the hash. Expanding it there would make the
 * copied URL leak the source even after the owner set the record back to
 * private, and a `#<source>` link is not what "unlisted" is for.
 */
function load(source, division = '', toUrl = true) {
  state.source = source;
  state.division = division;
  state.lines = source.replace(/\n$/, '').split('\n');

  const parsed = parse(source);
  state.workout = parsed.workout;
  state.errors = parsed.errors;

  offerDivisions();
  visited.clear();
  clearRecord();
  recue();

  bar.hidden = false;
  controls.hidden = false;
  draw();
  reset();
  if (toUrl) writeHash();
}

/** Read the same workout as a different division, from where you stand. */
function chooseDivision(name) {
  if (name === state.division) return;
  state.division = name;
  recue();
  writeHash();
  paint();
  tick();
}

function showEmpty() {
  bar.hidden = true;
  controls.hidden = true;
  problems.hidden = true;
  // Drop both the hash and a `?w=<id>` share param, so "Edit" lands on the
  // real empty board rather than immediately reloading the shared workout.
  if (location.search || location.hash) location.assign(location.pathname);
  else location.reload();
}

// --- wiring -----------------------------------------------------------------

el('start').onclick = toggle;
el('next').onclick = () => advance(1);
el('prev').onclick = () => advance(-1);
el('leave').onclick = leave;
el('reset').onclick = reset;
el('record-open').onclick = showRecord;
el('record-close').onclick = () => { el('record').hidden = true; };
el('record-copy').onclick = async () => {
  try { await navigator.clipboard.writeText(el('record-text').value); said('copied'); }
  catch (e) { said(`could not copy: ${e.message}`); }
};
el('record-save').onclick = () => {
  const blob = new Blob([el('record-text').value], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = recordName();
  a.click();
  URL.revokeObjectURL(a.href);
  said(`saved ${a.download}`);
};
el('edit').onclick = showEmpty;
picker.onchange = () => chooseDivision(picker.value);

addEventListener('keydown', (e) => {
  // A focused control owns these keys itself. The picker uses the arrows to
  // change division and space to open, and a board that also advanced the cue
  // would move two things with one press.
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const keys = {
    ' ': () => (state.cues[state.at]?.pacing === 'timed' || !state.running ? toggle() : advance(1)),
    ArrowRight: () => advance(1),
    ArrowLeft: () => advance(-1),
    e: leave,
    r: reset,
  };
  const fn = keys[e.key];
  if (fn) { e.preventDefault(); fn(); }
});

// A board is something you drop a file onto.
addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragging'); });
addEventListener('dragleave', () => document.body.classList.remove('dragging'));
addEventListener('drop', async (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  const file = e.dataTransfer?.files?.[0];
  if (file) load(await file.text());
});

const paste = el('paste');
if (paste) {
  paste.addEventListener('input', () => {
    if (paste.value.trim().length > 4) load(paste.value);
  });
}

const samples = el('samples');
for (const [name, src] of Object.entries(SAMPLES)) {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => load(src);
  samples.append(b);
}

// The board writes the workout into the hash so the URL is the share link. That
// only works if arriving at a different hash loads a different workout —
// including by pasting one over the address bar of a board already running.
addEventListener('hashchange', () => {
  const { source, division } = readHash();
  if (!source.trim()) return;
  if (source !== state.source) load(source, division);
  // A different division of the same workout is not a different workout: switch
  // where the reader stands rather than starting the session again. This is also
  // the path `writeHash` re-enters by, and `chooseDivision` returns on the spot
  // when nothing moved.
  else chooseDivision(division);
});

setInterval(tick, 100);

// The registry is only needed for validation hints, so a board still works
// without it. Say what was lost rather than failing to start.
fetch(new URL(REGISTRY, location.href))
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
  .then((data) => provide({ movements: () => data.movements }))
  .catch((e) => console.warn('no movement registry, validation hints are off:', e.message))
  .finally(() => {
    // `#<source>` in the hash wins when present — it is a whole workout, needs
    // no round trip, and is what every link written before today carries. Only
    // with no hash does `?w=<id>` fetch a saved one.
    const { source, division } = readHash();
    if (source.trim()) load(source, division);
    else if (sharedId()) loadShared(sharedId());
  });

/**
 * The body map's data: the muscle vocabulary, and the canonical registry that
 * attributes a movement name to it. `wantCanonical` above fetches the same
 * 1.7MB file lazily, on the one signal that variant resolution needs it — the
 * body map is not that rare, it wants an attribution for every step of every
 * workout, so here it is fetched once, eagerly, but *not* awaited: the board
 * is usable — text, clock, cursor — the instant the grammar and registry are
 * in, and the map fills itself in a moment later rather than holding up
 * anything else.
 */
const wantMuscles = () => (has('canonicalMovements')
  ? Promise.resolve()
  : fetch(new URL(CANONICAL, location.href)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
    .then((data) => provide({ canonicalMovements: () => data.movements })));

Promise.all([
  fetch(new URL(MUSCLES, location.href)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
    .then((data) => provide({ muscles: () => data.muscles })),
  wantMuscles(),
])
  .then(() => { if (state.workout) { recue(); paint(); } })
  .catch((e) => console.warn('no muscle data, the body map stays blank:', e.message));
