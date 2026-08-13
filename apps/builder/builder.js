/**
 * The builder: parse, modify, generate — over one document.
 *
 * The design decision worth stating is what *not* to build. A GUI with a field
 * per property — reps here, load there, a dropdown for laterality — would always
 * lag the grammar, and the grammar is the interesting part. `21-15-9`, `each
 * arm`, `@ 85% 1RM`, `reversed`: every one of those would need a widget, and the
 * day the spec grows another the builder silently cannot express it.
 *
 * So the outline gives you *shape* — order, nesting, duplication, deletion — with
 * buttons, because those are the operations that are genuinely fiddly to do by
 * hand in text. Everything a line says stays a line you type, with the movement
 * registry as autocomplete and the parser reporting what it understood. The GUI
 * covers what text is bad at and gets out of the way of what it is good at.
 *
 * The text is the document. Structural operations splice the lines array in
 * place rather than regenerating from the AST, so comments, blank lines and your
 * own spacing survive being dragged around. Canonicalising is a button, not a
 * side effect of clicking something else.
 */

import { readLines } from '../../build/web/core/lines.js';
import {
  spans, move as moveLines, shift as shiftLines, remove as removeLines,
  duplicate as duplicateLines, insertAfter, logicalText, replaceLogical, logicalEnd,
} from '../../build/web/core/edit.js';
import { parse } from '../../build/web/core/parse.js';
import { format } from '../../build/web/core/format.js';
import { compile } from '../../build/web/core/timeline.js';
import { validate } from '../../build/web/core/validate.js';
import { run, roundLabel } from '../../build/web/core/run.js';
import { provide, has } from '../../build/web/core/env.js';

const REGISTRY = '../../registry/movements.json';
const el = (id) => document.getElementById(id);

const START = `# New workout
5 rounds for time:
  - 10 Push-Up
  - 15 Air Squat
`;

/** The document, as lines. Everything else is derived. */
let lines = START.replace(/\n$/, '').split('\n');
/** Which line the caret was on, so a redraw does not steal focus back to the top. */
let focused = null;

const text = () => `${lines.join('\n')}\n`;

// --- structure ---------------------------------------------------------------

// Every structural operation lives in @wdl/core: they are document edits any
// editor over this format would want, they are the ones with the subtle rules
// about what a thing owns, and they are testable there against the whole corpus
// rather than by clicking around in here.

const indentOf = (i) => lines[i - 1].length - lines[i - 1].trimStart().length;

const apply = (next, focus) => { lines = next; render(focus); };

const move = (line, dir) => apply(moveLines(lines, line, dir), line);
const shift = (line, by) => apply(shiftLines(lines, line, by), line);
const remove = (line) => apply(removeLines(lines, line), Math.min(line, lines.length));
const duplicate = (line) => apply(duplicateLines(lines, line), line);
const insert = (after, content) => apply(insertAfter(lines, after ?? undefined, content), (after ?? lines.length) + 1);

// --- rendering ---------------------------------------------------------------

const TOOLS = [
  ['↑', 'Move up', (l) => move(l, -1)],
  ['↓', 'Move down', (l) => move(l, 1)],
  ['⇥', 'Indent', (l) => shift(l, 2)],
  ['⇤', 'Outdent', (l) => shift(l, -2)],
  ['⧉', 'Duplicate', duplicate],
  ['✕', 'Delete', remove],
];

function render(focusLine) {
  if (focusLine !== undefined) focused = focusLine;
  el('text').value = text();
  renderOutline();
  renderReading();
  const link = el('board');
  link.href = `../display/#${encodeURIComponent(text())}`;
}

function renderOutline() {
  const outline = el('outline');
  outline.innerHTML = '';
  const parsed = parse(text());
  const badLines = new Set(parsed.errors.map((e) => e.line));

  const walk = (nodes, depth) => {
    for (const n of nodes) {
      const node = document.createElement('div');
      node.className = 'node';
      if (/:$/.test(n.text) || n.children.length) node.classList.add('block');
      if (n.text.startsWith('//')) node.classList.add('comment');
      if (badLines.has(n.line)) node.classList.add('bad');

      const rails = document.createElement('span');
      rails.className = 'rails';
      for (let d = 0; d <= depth; d++) {
        const rail = document.createElement('span');
        rail.className = 'rail';
        rails.append(rail);
      }

      // A wrapped inline block is one row standing for several lines; show the
      // whole of it, and write it back over all of them.
      const input = document.createElement('input');
      input.className = 'line';
      input.value = logicalText(lines, n.line);
      input.setAttribute('list', 'movements');
      input.dataset.line = String(n.line);
      input.addEventListener('input', () => {
        // The indent is structure, and the outline is not where you change it —
        // that is what indent and outdent are for. `replaceLogical` keeps it.
        lines = replaceLogical(lines, n.line, input.value);
        el('text').value = text();
        renderReading();
      });
      input.addEventListener('change', () => render(n.line));
      input.addEventListener('focus', () => { focused = n.line; });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); insert(n.line, ''); }
        if (e.key === 'Tab' && !e.shiftKey && input.selectionStart === input.value.length) {
          e.preventDefault(); shift(n.line, 2);
        }
      });

      const tools = document.createElement('span');
      tools.className = 'tools';
      for (const [glyph, title, fn] of TOOLS) {
        const b = document.createElement('button');
        b.textContent = glyph;
        b.title = title;
        b.onclick = () => fn(n.line);
        tools.append(b);
      }

      node.append(rails, input, tools);
      outline.append(node);
      walk(n.children, depth + 1);
    }
  };

  walk(readLines(text()), 0);

  const restore = outline.querySelector(`input[data-line="${focused}"]`);
  if (restore && document.activeElement?.tagName !== 'TEXTAREA') {
    restore.focus();
    restore.setSelectionRange(restore.value.length, restore.value.length);
  }
}

/**
 * What the parser understood — the honest half of the round trip.
 *
 * A builder that only shows you what you typed is a text editor. The value is in
 * showing what it *means*: how many reps that adds up to, how long it will take,
 * what order the steps come in once a rep scheme is expanded.
 */
function renderReading() {
  const { workout, errors } = parse(text());
  const summary = el('summary');
  const list = el('diagnostics');
  summary.innerHTML = '';
  list.innerHTML = '';

  let laid;
  try {
    laid = run(compile(workout));
  } catch (e) {
    summary.textContent = `cannot compile: ${e.message}`;
    return;
  }

  const dl = document.createElement('dl');
  const rows = [
    ['title', workout.title ?? '—'],
    ['cues', `${laid.cues.length}${laid.loops ? ' per pass' : ''}`],
    ['duration', laid.totalSeconds !== undefined
      ? `${Math.floor(laid.totalSeconds / 60)}:${String(Math.round(laid.totalSeconds % 60)).padStart(2, '0')}`
      : 'athlete-paced'],
    ...(laid.window ? [['window', `${laid.window / 60} min`]] : []),
    ...(laid.loops ? [['repeats', 'until the clock stops']] : []),
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.append(dt, dd);
  }
  summary.append(dl);

  const steps = document.createElement('div');
  steps.className = 'steps';
  for (const cue of laid.cues.slice(0, 24)) {
    const row = document.createElement('div');
    row.className = `cue ${cue.kind}`;
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(cue.index + 1);
    const label = document.createElement('span');
    const round = roundLabel(cue.rounds);
    label.textContent = round ? `${cue.label}  ·  ${round}` : cue.label;
    row.append(n, label);
    steps.append(row);
  }
  if (laid.cues.length > 24) {
    const more = document.createElement('div');
    more.className = 'more';
    more.textContent = `…and ${laid.cues.length - 24} more`;
    steps.append(more);
  }
  summary.append(steps);

  // Registry-backed checks need the registry. Without it the parse errors still
  // show; say what is missing rather than looking clean because half the checks
  // never ran.
  const diagnostics = [
    ...errors.map((e) => ({ severity: 'error', line: e.line, message: e.message })),
    ...(has('movements') ? validate(workout) : []),
  ];
  if (!has('movements')) {
    diagnostics.push({ severity: 'warning', message: 'no movement registry loaded — name checks are off' });
  }
  for (const d of diagnostics) {
    const li = document.createElement('li');
    const where = document.createElement('span');
    where.className = 'where';
    where.textContent = d.line ? `${d.line}  ` : '';
    const body = document.createElement('span');
    body.className = d.severity;
    body.textContent = d.message;
    li.append(where, body);
    for (const c of d.candidates ?? []) {
      const alt = document.createElement('div');
      alt.className = 'candidates';
      alt.textContent = `· ${c}`;
      li.append(alt);
    }
    list.append(li);
  }
  el('dirty').hidden = text() === format(workout);
}

// --- wiring ------------------------------------------------------------------

el('text').addEventListener('input', () => {
  lines = el('text').value.replace(/\n$/, '').split('\n');
  focused = null;
  renderOutline();
  renderReading();
  el('board').href = `../display/#${encodeURIComponent(text())}`;
});

// Canonicalising is deliberately a button. Reformatting as a side effect of an
// edit moves the caret and rewrites lines you did not touch, which is how a
// builder earns a reputation for fighting you.
el('canon').onclick = () => {
  const { workout } = parse(text());
  lines = format(workout).replace(/\n$/, '').split('\n');
  render();
};

el('download').onclick = () => {
  const { workout } = parse(text());
  const name = (workout.title ?? 'workout').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const url = URL.createObjectURL(new Blob([text()], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name || 'workout'}.wdl`;
  a.click();
  URL.revokeObjectURL(url);
};

el('open').onclick = () => el('file').click();
el('file').addEventListener('change', async () => {
  const file = el('file').files?.[0];
  if (!file) return;
  lines = (await file.text()).replace(/\n$/, '').split('\n');
  render();
});

for (const b of document.querySelectorAll('[data-add]')) {
  b.onclick = () => insert(focused, {
    step: '- 10 Movement',
    rest: 'rest 60s',
    block: '5 rounds:',
  }[b.dataset.add]);
}

addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  lines = (await file.text()).replace(/\n$/, '').split('\n');
  render();
});

// The core is handed its data; it reads no files itself. Autocomplete and the
// name checks both come from here, and both degrade rather than fail.
fetch(new URL(REGISTRY, location.href))
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
  .then((data) => {
    provide({ movements: () => data.movements });
    const list = el('movements');
    for (const m of data.movements) {
      const option = document.createElement('option');
      option.value = `- 10 ${m.title}`;
      option.label = m.title;
      list.append(option);
    }
  })
  .catch((e) => console.warn('no movement registry:', e.message))
  .finally(render);
