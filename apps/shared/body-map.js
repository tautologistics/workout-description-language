/**
 * A front-and-back body map: one SVG path per muscle, id-matched to
 * `registry/muscles.json`'s closed 19-muscle vocabulary.
 *
 * Deliberately stylised rather than anatomical — blocks and wedges standing in
 * for a pectoral or a hamstring — because the map exists to answer "which
 * fifth of the body did this hit", not to be a textbook plate. Whiteboard
 * legibility over fidelity is the same trade the format itself makes.
 *
 * Every muscle in the vocabulary is drawn on exactly one of the two views,
 * whichever side it is actually seen from, so painting both views paints the
 * whole body once with nothing doubled and nothing missing:
 *
 *   front: neck, shoulders, chest, biceps, forearms, abs, obliques,
 *          hip-flexors, quads, adductors
 *   back:  traps, triceps, lats, mid-back, erectors, glutes, abductors,
 *          hamstrings, calves
 *
 * A path with no `data-muscle` is scenery (head, hands, feet, an undrawn
 * shin) and `paintBody` never touches it.
 *
 * This file knows nothing about `@wdl/core` — it takes plain
 * `{primary, secondary}` shapes, which is exactly what `Exposure` and
 * `musclesFor()` already are, and plain `MuscleLoad` records. A caller wires
 * the two together; this file only draws and colours.
 */

const HATCH_ID = 'mm-hatch';

function frontSvg() {
  return `<svg viewBox="0 0 200 400" role="img" aria-label="Body, front">
  <defs>
    <pattern id="${HATCH_ID}" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="var(--rule, #ccc)"/>
      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--dim, #888)" stroke-width="2"/>
    </pattern>
  </defs>
  <g class="mm-scenery">
    <circle cx="100" cy="22" r="16"/>
    <ellipse cx="48" cy="165" rx="8" ry="12"/>
    <ellipse cx="152" cy="165" rx="8" ry="12"/>
    <path d="M78,257 L98,257 L94,330 L80,330 Z"/>
    <path d="M122,257 L102,257 L106,330 L120,330 Z"/>
    <ellipse cx="86" cy="340" rx="14" ry="8"/>
    <ellipse cx="114" cy="340" rx="14" ry="8"/>
  </g>
  <path data-muscle="neck" d="M92,36 L108,36 L110,50 L90,50 Z"/>
  <path data-muscle="shoulders" d="M58,44 L82,40 L84,58 L60,64 Z"/>
  <path data-muscle="shoulders" d="M142,44 L118,40 L116,58 L140,64 Z"/>
  <path data-muscle="chest" d="M80,44 L120,44 L124,84 L76,84 Z"/>
  <path data-muscle="biceps" d="M56,60 L76,58 L74,110 L54,112 Z"/>
  <path data-muscle="biceps" d="M144,60 L124,58 L126,110 L146,112 Z"/>
  <path data-muscle="forearms" d="M53,112 L74,110 L70,155 L50,156 Z"/>
  <path data-muscle="forearms" d="M147,112 L126,110 L130,155 L150,156 Z"/>
  <path data-muscle="abs" d="M78,84 L122,84 L120,150 L80,150 Z"/>
  <path data-muscle="obliques" d="M68,88 L80,86 L80,146 L70,144 Z"/>
  <path data-muscle="obliques" d="M132,88 L120,86 L120,146 L130,144 Z"/>
  <path data-muscle="hip-flexors" d="M80,150 L120,150 L122,168 L78,168 Z"/>
  <path data-muscle="quads" d="M78,168 L100,168 L98,255 L76,255 Z"/>
  <path data-muscle="quads" d="M122,168 L100,168 L102,255 L124,255 Z"/>
  <path data-muscle="adductors" d="M98,170 L102,170 L104,240 L96,240 Z"/>
</svg>`;
}

function backSvg() {
  return `<svg viewBox="0 0 200 400" role="img" aria-label="Body, back">
  <g class="mm-scenery">
    <circle cx="100" cy="22" r="16"/>
    <path d="M53,114 L74,112 L70,156 L50,157 Z"/>
    <path d="M147,114 L126,112 L130,156 L150,157 Z"/>
    <ellipse cx="48" cy="165" rx="8" ry="12"/>
    <ellipse cx="152" cy="165" rx="8" ry="12"/>
    <ellipse cx="86" cy="340" rx="14" ry="8"/>
    <ellipse cx="114" cy="340" rx="14" ry="8"/>
  </g>
  <path data-muscle="traps" d="M84,36 L116,36 L128,70 L72,70 Z"/>
  <path data-muscle="triceps" d="M56,60 L76,58 L74,112 L54,114 Z"/>
  <path data-muscle="triceps" d="M144,60 L124,58 L126,112 L146,114 Z"/>
  <path data-muscle="lats" d="M70,72 L90,70 L86,130 L66,124 Z"/>
  <path data-muscle="lats" d="M130,72 L110,70 L114,130 L134,124 Z"/>
  <path data-muscle="mid-back" d="M90,70 L110,70 L108,128 L92,128 Z"/>
  <path data-muscle="erectors" d="M86,128 L114,128 L112,158 L88,158 Z"/>
  <path data-muscle="glutes" d="M78,158 L122,158 L120,192 L80,192 Z"/>
  <path data-muscle="abductors" d="M66,160 L80,158 L80,192 L64,192 Z"/>
  <path data-muscle="abductors" d="M134,160 L120,158 L120,192 L136,192 Z"/>
  <path data-muscle="hamstrings" d="M78,194 L100,194 L98,260 L76,260 Z"/>
  <path data-muscle="hamstrings" d="M122,194 L100,194 L102,260 L124,260 Z"/>
  <path data-muscle="calves" d="M80,262 L98,262 L94,330 L82,330 Z"/>
  <path data-muscle="calves" d="M120,262 L102,262 L106,330 L118,330 Z"/>
</svg>`;
}

/** Build the two views inside `container` and return it, painted idle. */
export function mountBody(container) {
  container.classList.add('bodymap');
  container.innerHTML = `<div class="mm-view">${frontSvg()}<span class="mm-label">front</span></div>` +
    `<div class="mm-view">${backSvg()}<span class="mm-label">back</span></div>`;
  return container;
}

/**
 * Colour every muscle in `container` per `states`.
 *
 * `states` is `{ [muscleId]: spec | undefined }`, where a missing entry means
 * "not worked" (drawn idle) and `spec` is either `{ color, opacity }` or
 * `{ unmeasured: true }` — worked, but this view's number does not apply to
 * it (see `heatStates`). The vocabulary is read off the DOM itself rather
 * than hardcoded here, so this file does not have to know it twice.
 */
export function paintBody(container, states = {}) {
  const ids = new Set([...container.querySelectorAll('[data-muscle]')].map((e) => e.dataset.muscle));
  for (const id of ids) {
    const spec = states[id];
    for (const el of container.querySelectorAll(`[data-muscle="${id}"]`)) {
      el.classList.toggle('mm-unmeasured', !!spec?.unmeasured);
      if (!spec) { el.style.fill = ''; el.style.opacity = ''; continue; }
      if (spec.unmeasured) { el.style.fill = ''; el.style.opacity = '1'; continue; }
      el.style.fill = spec.color;
      el.style.opacity = String(spec.opacity ?? 1);
    }
  }
}

/**
 * Primary/secondary state for a whole workout (or any set of exposures),
 * folded down to one state per muscle.
 *
 * Opacity is the answer this project settled on for "how does the map show
 * primary vs secondary" (see docs/context/settled-decisions.md): full colour
 * for a primary mover, ~40% for a muscle a step only assists, one colour per
 * layer rather than a second hue. A muscle that is primary anywhere always
 * wins over a secondary appearance elsewhere, in either order.
 */
export function aggregateStates(exposures, color) {
  const states = {};
  for (const e of exposures) {
    for (const id of e.primary ?? []) states[id] = { color, opacity: 1 };
    for (const id of e.secondary ?? []) {
      if (!states[id]) states[id] = { color, opacity: 0.4 };
    }
  }
  return states;
}

/**
 * "What does this add to what I already have" — the aggregate, dimmed to
 * context, with the given movement's own muscles painted over it in a second
 * colour. Muscles the movement does not touch keep answering the aggregate's
 * question; muscles it does touch stop answering that one and start
 * answering this one, which is why they switch colour rather than only
 * brightening.
 */
export function highlightStates(exposures, movement, aggColor, hiColor) {
  const agg = aggregateStates(exposures, aggColor);
  const states = { ...agg };
  for (const id of movement.secondary ?? []) states[id] = { color: hiColor, opacity: 0.45 };
  for (const id of movement.primary ?? []) states[id] = { color: hiColor, opacity: 1 };
  for (const id of Object.keys(agg)) {
    if (!states[id] || states[id].color !== hiColor) states[id] = { color: aggColor, opacity: agg[id].opacity * 0.5 };
  }
  return states;
}

/**
 * Intensity by `metric`: `'frequency'` (exposures — how many steps touched a
 * muscle, primary or secondary, always defined) or `'volume'` (reps
 * attributed to it). Volume is the honest number for loaded reps work and
 * says nothing for a carry, a hold or a max effort — `stepVolume` reads those
 * as zero reps by construction — so a muscle worked only by that kind of step
 * is `unmeasured` under `'volume'` rather than coloured cold, which would
 * read as "not worked" and lie. Under `'frequency'` nothing is ever
 * unmeasured: a step always counts as one exposure regardless of what it
 * measures.
 */
export function heatStates(byMuscle, metric, colorFor) {
  const states = {};
  const values = [];
  for (const [id, m] of Object.entries(byMuscle)) {
    if (metric === 'frequency') {
      if (m.exposures > 0) values.push([id, m.exposures]);
      continue;
    }
    const reps = m.primary.reps + m.secondary.reps;
    if (reps > 0) values.push([id, reps]);
    else if (m.exposures > 0) states[id] = { unmeasured: true };
  }
  const max = Math.max(1, ...values.map(([, v]) => v));
  for (const [id, v] of values) states[id] = { color: colorFor(v / max), opacity: 1 };
  return states;
}

/** Pale amber to deep red, the default heat scale. */
export function heatColor(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return `hsl(18, ${28 + 55 * clamped}%, ${74 - 42 * clamped}%)`;
}
