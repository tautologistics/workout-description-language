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
 */

import { parse } from '../../build/web/core/parse.js';
import { compile } from '../../build/web/core/timeline.js';
import { run, roundLabel } from '../../build/web/core/run.js';
import { validate } from '../../build/web/core/validate.js';
import { provide } from '../../build/web/core/env.js';

// The core is handed its data; it reads no files itself. On Node that is
// packages/core/node.ts, here it is a fetch.
const REGISTRY = '../../registry/movements.json';

const el = (id) => document.getElementById(id);
const bar = el('bar');
const board = el('board');
const controls = el('controls');
const problems = el('problems');

const SAMPLES = {
  Fran: '# Fran\nfor time:\n  21-15-9:\n    - Thruster @ 95lb\n    - Pull-Up\n',
  Cindy: '# Cindy\nAMRAP 20min:\n  - 5 Pull-Up\n  - 10 Push-Up\n  - 15 Air Squat\n',
  '5×5': '# Back squat\n5 sets:\n  - 5 Back Squat @ 225lb\n  rest 3min\n',
  Intervals: '# Threshold\n6 rounds:\n  - 3min Row @ 90% FTP\n  rest 90s\n',
};

/** Everything that changes as the workout runs. */
const state = {
  source: '',
  lines: [],
  cues: [],
  loops: false,
  window: undefined,
  at: -1,          // -1 is "not started"
  startedAt: 0,    // ms, for the whole workout
  cueStartedAt: 0, // ms, for the current cue
  running: false,
  lap: 0,          // completed passes, for a looping AMRAP
};

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
  const nowLine = cue?.line;

  // A line is spent when nothing still to come points at it — not merely when
  // it has been passed once. In `21-15-9` the pull-up is behind you three times
  // and finished only the last, and dimming it after the first round would tell
  // you the workout is nearly over when a third of it is left. On a looping
  // workout nothing is ever spent.
  // Only lines a cue points at are candidates: a block header or a title is
  // never "done", it is context, and dimming it would empty the board.
  const spent = new Set(state.loops ? [] : state.cues.map((c) => c.line));
  for (let i = Math.max(0, state.at); i < state.cues.length; i++) spent.delete(state.cues[i].line);

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
  el('now-label').textContent = cue ? cue.label : finished ? 'Done' : 'Ready';
  el('now-sub').textContent = [
    cue ? roundLabel(cue.rounds) : '',
    state.loops && state.lap ? `pass ${state.lap + 1}` : '',
    cue?.pacing === 'athlete' ? 'press space when done' : '',
    finished ? `${state.cues.length} cues` : '',
  ].filter(Boolean).join(' · ');

  el('position').textContent = state.cues.length
    ? `${Math.min(Math.max(0, state.at + 1), state.cues.length)} / ${state.cues.length}${state.loops ? '+' : ''}`
    : '';
  el('prev').disabled = state.at <= 0;
  el('next').disabled = !state.cues.length || finished;
  el('start').disabled = finished;
  el('start').textContent = state.running ? 'Pause' : state.at < 0 ? 'Start' : 'Resume';
}

/**
 * The clock ticks on the cue, and on the workout as a whole.
 *
 * A timed cue counts *down*, because what matters mid-effort is how much is
 * left. Everything else counts up, because there is nothing to count down to —
 * and a timed cue that overruns keeps counting, in red, rather than sitting at
 * zero pretending the athlete finished.
 */
function tick() {
  const cue = state.cues[state.at];
  const now = performance.now();
  const elapsed = state.running ? (now - state.cueStartedAt) / 1000 : state.heldCue ?? 0;
  const total = state.running ? (now - state.startedAt) / 1000 : state.heldTotal ?? 0;

  let text, sub, waiting = false, overrun = false;
  if (!cue) {
    text = fmt(total);
    sub = 'elapsed';
  } else if (cue.seconds !== undefined) {
    const left = cue.seconds - elapsed;
    overrun = left < 0;
    text = (overrun ? '+' : '') + fmt(Math.abs(left));
    sub = overrun ? 'over' : 'left';
  } else {
    waiting = true;
    text = fmt(elapsed);
    sub = 'on this';
  }

  el('clock').textContent = text;
  el('clock-sub').textContent = `${sub} · ${fmt(total)} total`;
  bar.classList.toggle('waiting', waiting && !overrun);
  bar.classList.toggle('overrun', overrun);

  // A timed cue advances itself. That is the whole difference between a board
  // and a runtime, and it is one line because `run` already decided which cues
  // end by themselves.
  if (state.running && cue?.seconds !== undefined && elapsed >= cue.seconds && cue.pacing === 'timed') {
    advance(1);
  }
}

// --- moving through the workout ---------------------------------------------

function advance(by) {
  const next = state.at + by;
  if (next >= state.cues.length) {
    // A looping workout has no end to reach; an ordinary one stops.
    if (state.loops) { state.lap++; state.at = 0; }
    else { state.at = state.cues.length; state.running = false; hold(); }
  } else {
    state.at = Math.max(0, next);
  }
  state.cueStartedAt = performance.now();
  paint();
  tick();
}

/** Freeze the two clocks where they are, so pausing does not lose the count. */
function hold() {
  const now = performance.now();
  state.heldCue = (now - state.cueStartedAt) / 1000;
  state.heldTotal = (now - state.startedAt) / 1000;
}

function resume() {
  const now = performance.now();
  state.cueStartedAt = now - (state.heldCue ?? 0) * 1000;
  state.startedAt = now - (state.heldTotal ?? 0) * 1000;
}

function toggle() {
  if (!state.cues.length) return;
  if (state.at < 0) {
    state.at = 0;
    state.heldCue = 0;
    state.heldTotal = 0;
  }
  state.running = !state.running;
  if (state.running) resume(); else hold();
  paint();
  tick();
}

function reset() {
  state.at = -1;
  state.lap = 0;
  state.running = false;
  state.heldCue = 0;
  state.heldTotal = 0;
  paint();
  tick();
}

// --- loading ----------------------------------------------------------------

function load(source) {
  state.source = source;
  state.lines = source.replace(/\n$/, '').split('\n');

  const { workout, errors } = parse(source);
  const compiled = compile(workout);
  const laid = run(compiled);

  state.cues = laid.cues;
  state.loops = laid.loops;
  state.window = laid.window;

  // Errors mean the board is showing something the parser did not fully
  // understand. Say so, and show it anyway — a workout you can read beats a
  // blank screen, and mid-session is the worst time to be told to go and fix
  // your file.
  const diagnostics = [
    ...errors.map((e) => `line ${e.line}: ${e.message}`),
    ...validate(workout).filter((d) => d.severity === 'error').map((d) => `line ${d.line}: ${d.message}`),
    ...laid.warnings,
  ];
  problems.hidden = !diagnostics.length;
  problems.textContent = diagnostics.join('\n');

  bar.hidden = false;
  controls.hidden = false;
  draw();
  reset();
  location.hash = encodeURIComponent(source);
}

function showEmpty() {
  bar.hidden = true;
  controls.hidden = true;
  problems.hidden = true;
  location.hash = '';
  location.reload();
}

// --- wiring -----------------------------------------------------------------

el('start').onclick = toggle;
el('next').onclick = () => advance(1);
el('prev').onclick = () => advance(-1);
el('reset').onclick = reset;
el('edit').onclick = showEmpty;

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA') return;
  const keys = {
    ' ': () => (state.cues[state.at]?.pacing === 'timed' || !state.running ? toggle() : advance(1)),
    ArrowRight: () => advance(1),
    ArrowLeft: () => advance(-1),
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
  const source = decodeURIComponent(location.hash.slice(1));
  if (source.trim() && source !== state.source) load(source);
});

setInterval(tick, 100);

// The registry is only needed for validation hints, so a board still works
// without it. Say what was lost rather than failing to start.
fetch(new URL(REGISTRY, location.href))
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
  .then((data) => provide({ movements: () => data.movements }))
  .catch((e) => console.warn('no movement registry, validation hints are off:', e.message))
  .finally(() => {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash.trim()) load(hash);
  });
