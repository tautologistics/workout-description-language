/** Quantity, load, and target parsing (spec §3). */

import type { Unit, Load, Target } from './ast.ts';

/**
 * Expand `1..10..1` into every step between the given waypoints.
 *
 * Here rather than in `parse.ts` because two things read a rep scheme now — the
 * hand-written header parser and the grammar's block semantics — and a ladder
 * that expands one way in one of them is the kind of divergence the grammar
 * exists to make impossible.
 */
export function expandRuns(points: number[]): number[] {
  const out: number[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1], to = points[i], dir = to >= from ? 1 : -1;
    for (let v = from + dir; dir > 0 ? v <= to : v >= to; v += dir) out.push(v);
  }
  return out;
}

const DIST = /^(\d+(?:\.\d+)?)(m|km|mi|ft|yd)$/;
const CAL = /^(\d+)\s*cal$/;
const REPS = /^(\d+)$/;
const FLOOR = /^(\d+)\+$/;

/**
 * Duration. `m` is accepted for minutes on input but canonical output is `min`
 * (spec §3, the `m` problem) — so a bare `m` is only a duration when the caller
 * knows it is in a duration position.
 */
export function parseDuration(s: string, bareMIsMinutes = false): Unit | null {
  // `3 m`, `1 min 30 s` — internal spacing is noise in a duration.
  // The spelled-out spellings are folded onto the compact ones here, and *here*
  // is the point: spec §3 accepts `min`, `mins` and `minute(s)` — and the same
  // for seconds and hours — "wherever a duration is expected", so the rule
  // belongs to the duration rather than to one caller. It used to live in
  // `parseQuantity`, anchored to the end of a single token, which is why
  // `45 seconds Plank` was 45 seconds and `rest 45 seconds` was an unreadable
  // rest with no bound at all: a rest is a duration position and never went
  // through the caller that knew. Global rather than anchored, so a compound
  // (`1 hour 30 minutes`) folds every part and not just the last.
  const t = s.trim().toLowerCase().replace(/\s+/g, '')
    // Longest spelling first in each: an ordered choice ordered by anything but
    // prefix leaves `mins` reading as `min` with an `s` of seconds behind it.
    .replace(/hours|hour/g, 'h')
    .replace(/minutes|minute|mins|min/g, 'min')
    .replace(/seconds|second|secs|sec/g, 's');

  // 1min30s, 12min, 90s, 1h, 1h30min
  const compound = /^(?:(\d+)h)?(?:(\d+)(?:min|m(?![a-z])))?(?:(\d+)s)?$/;
  const m = t.match(compound);
  if (m && (m[1] || m[2] || m[3])) {
    if (m[2] && !bareMIsMinutes && /\d+m$/.test(t) && !/min$/.test(t)) {
      // bare `m` in an unknown position — caller must disambiguate
    }
    const seconds = (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0));
    return { kind: 'duration', seconds };
  }
  // mm:ss, and h:mm:ss — which is not decoration. A HYROX finishes in `1:04:19`
  // and that is how the time gets written down; until 2026-08-23 the clock form
  // stopped at two fields, so the first real result record anybody wrote had a
  // score the language could not read. Found by writing one, not by the suite.
  const clock = t.match(/^(\d+):([0-5]\d)(?::([0-5]\d))?$/);
  if (clock) {
    return clock[3] !== undefined
      ? { kind: 'duration', seconds: +clock[1] * 3600 + +clock[2] * 60 + +clock[3] }
      : { kind: 'duration', seconds: +clock[1] * 60 + +clock[2] };
  }
  // `EMOM 10` / `AMRAP 12` — a bare number in a duration position is minutes.
  if (bareMIsMinutes && /^\d+$/.test(t)) return { kind: 'duration', seconds: +t * 60 };
  return null;
}

export function formatDuration(u: Unit): string {
  if (u.kind !== 'duration') return '';
  const h = Math.floor(u.seconds / 3600);
  const min = Math.floor((u.seconds % 3600) / 60);
  const s = u.seconds % 60;
  let out = '';
  if (h) out += `${h}h`;
  if (min) out += `${min}min`;
  if (s || !out) out += `${s}s`;
  return out;
}

/** Parse the leading quantity of a step. Returns the unit and the rest of the text. */
/** `until HR < 130bpm`, `until power > 250W`. */
export function parseThreshold(text: string): Unit | null {
  const t = text.trim();
  const CMP = '(<|>|below|above|under|over)';
  const lt = (c: string) => /^(<|below|under)$/i.test(c);

  // `until HR < Z2` — a zone rather than a reading. Connect keeps a field for
  // exactly this, and coaches write recovery in zones far more often than bpm.
  const z = t.match(new RegExp(`^until\\s+(hr|heart\\s*rate|power)\\s*${CMP}\\s*(?:zone\\s*)?Z?(\\d)$`, 'i'));
  if (z) {
    return {
      kind: 'threshold',
      metric: /power/i.test(z[1]) ? 'power' : 'hr',
      compare: lt(z[2]) ? 'lt' : 'gt',
      zone: Number(z[3]),
    };
  }

  const m = t.match(new RegExp(`^until\\s+(hr|heart\\s*rate|power)\\s*${CMP}\\s*(\\d+(?:\\.\\d+)?)\\s*(bpm|w|watts)?$`, 'i'));
  if (!m) return null;
  const metric = /power/i.test(m[1]) ? 'power' : 'hr';
  return {
    kind: 'threshold', metric, compare: lt(m[2]) ? 'lt' : 'gt',
    value: Number(m[3]), unit: metric === 'hr' ? 'bpm' : 'W',
  };
}

export function parseQuantity(text: string): { quantity: Unit; rest: string } {
  const t = text.trim();

  const threshold = parseThreshold(t);
  if (threshold) return { quantity: threshold, rest: '' };

  if (/^max\b/i.test(t)) return { quantity: { kind: 'max' }, rest: t.slice(3).trim() };

  // Spaced unit forms — `15 cal Row`, `400 m Run`, `12 min` — are how people
  // actually type. Duration words are matched before a bare `m` so that
  // `12 min` is minutes and `400 m` is metres (spec §3, the `m` problem).
  let sp: RegExpMatchArray | null;
  if ((sp = t.match(/^(\d+)\s+(?:cal|calories)\b/i)))
    return { quantity: { kind: 'calories', value: +sp[1] }, rest: t.slice(sp[0].length).trim() };
  if ((sp = t.match(/^(\d+)\s+reps?\b/i)))
    return { quantity: { kind: 'reps', value: +sp[1] }, rest: t.slice(sp[0].length).trim() };
  if ((sp = t.match(/^(\d+)\s*(?:min|mins|minutes?|sec|secs|seconds?|hours?)\b/i))) {
    // The spelling is folded by `parseDuration` now, not here — a duration means
    // the same thing in every position, and this was the only position that knew.
    const d = parseDuration(sp[0], true);
    if (d) return { quantity: d, rest: t.slice(sp[0].length).trim() };
  }
  if ((sp = t.match(/^(\d+(?:\.\d+)?)\s+(m|km|mi|ft|yd|meters?|metres?|miles?|feet)\b/i))) {
    const u = sp[2].toLowerCase();
    const unit = u.startsWith('me') ? 'm' : u.startsWith('mi') && u !== 'mi' ? 'mi' : u === 'feet' ? 'ft' : u;
    return { quantity: { kind: 'distance', value: +sp[1], unit: unit as any }, rest: t.slice(sp[0].length).trim() };
  }

  const first = t.split(/\s+/)[0];
  const rest = t.slice(first.length).trim();

  let m: RegExpMatchArray | null;
  // `8-12 Dumbbell Curl` — a rep range. At block level the same shape is a rep
  // scheme (`21-15-9:`); the trailing colon is what separates them.
  if ((m = first.match(/^(\d+)-(\d+)$/)) && +m[1] < +m[2]) {
    return { quantity: { kind: 'range', min: +m[1], max: +m[2] }, rest };
  }
  if ((m = first.match(FLOOR))) return { quantity: { kind: 'floor', value: +m[1] }, rest };
  if ((m = first.match(DIST)))
    return { quantity: { kind: 'distance', value: +m[1], unit: m[2] as any }, rest };
  if ((m = first.match(CAL))) return { quantity: { kind: 'calories', value: +m[1] }, rest };
  if ((m = first.match(REPS))) return { quantity: { kind: 'reps', value: +m[1] }, rest };

  const dur = parseDuration(first, true);
  if (dur) return { quantity: dur, rest };

  return { quantity: { kind: 'open' }, rest: t };
}

export function formatQuantity(u: Unit): string {
  switch (u.kind) {
    case 'reps': return String(u.value);
    case 'distance': return `${u.value}${u.unit}`;
    case 'calories': return `${u.value}cal`;
    case 'duration': return formatDuration(u);
    case 'max': return 'max';
    case 'floor': return `${u.value}+`;
    case 'range': return `${u.min}-${u.max}`;
    case 'maxEffort': return 'max';
    case 'threshold': return `until ${u.metric === 'hr' ? 'HR' : 'power'} ${u.compare === 'lt' ? '<' : '>'} ${u.zone !== undefined ? `Z${u.zone}` : `${u.value}${u.unit}`}`;
    case 'open': return '';
  }
}

const LOAD_ABS = /^(\d+(?:\.\d+)?)\s*(lbs?|kgs?|#|pood)$/i;
const LOAD_PAIR = /^(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(lbs?|kgs?|#|pood)$/i;
const LOAD_PCT = /^(\d+(?:\.\d+)?)%(?:\s+(.+))?$/;
const LOAD_MULT = /^(\d+(?:\.\d+)?)x\s+(.+)$/i;
const HEIGHT = /^(\d+(?:\.\d+)?)\s*(in|cm|ft|")$/i;

export function parseTarget(text: string): Target {
  const t = text.trim();
  let m: RegExpMatchArray | null;

  const norm = (u: string) => (u === '#' ? 'lb' : u.toLowerCase().replace(/s$/, ''));
  // A pood is a Russian unit CrossFit still uses for kettlebells: 16.38 kg.
  if ((m = t.match(LOAD_PAIR)))
    return { kind: 'load', load: { kind: 'absolute', value: +m[2], unit: norm(m[3]) as any, implements: +m[1] } };
  if ((m = t.match(LOAD_ABS)))
    return { kind: 'load', load: { kind: 'absolute', value: +m[1], unit: norm(m[2]) as any } };
  if (/^of\s+/i.test(t))
    return { kind: 'load', load: { kind: 'reference', name: t.replace(/^of\s+/i, '') } };
  if ((m = t.match(LOAD_PCT))) {
    const of = m[2]?.trim();
    if (of && /^of\s+/i.test(of))
      return { kind: 'load', load: { kind: 'percent', value: +m[1], of: of.replace(/^of\s+/i, '') } };
    return { kind: 'load', load: { kind: 'percent', value: +m[1], of } };
  }
  if ((m = t.match(LOAD_MULT)))
    return { kind: 'load', load: { kind: 'multiple', value: +m[1], of: m[2] } };
  if ((m = t.match(HEIGHT)))
    return { kind: 'height', value: +m[1], unit: m[2] === '"' ? 'in' : m[2].toLowerCase() };
  if (/pace$|\/km$|\/mi$|\/500m$/i.test(t)) return { kind: 'pace', text: t };
  if (/^\d+W$|FTP$/i.test(t)) return { kind: 'power', text: t };
  if (/^power\s*(zone\s*)?Z?\d$/i.test(t)) return { kind: 'power', text: `power Z${t.match(/(\d)$/)![1]}` };
  if (/^Z\d$|bpm$/i.test(t)) return { kind: 'heartRate', text: t };
  if (/^RPE|^RIR/i.test(t)) return { kind: 'effort', text: t };
  if (/^(heavy|moderate|light|unloaded)$/i.test(t))
    return { kind: 'load', load: { kind: 'qualitative', value: t.toLowerCase() as any } };
  return { kind: 'raw', text: t };
}

export function formatLoad(l: Load): string {
  switch (l.kind) {
    // `?? ''` rather than a default unit: an unlabelled rx split has no unit to
    // write, and `105lb` where `105` was written is a heavier claim than the
    // author made. See the `Load` comment in `ast.ts`.
    case 'absolute': {
      const u = l.unit ?? '';
      return l.implements ? `${l.implements}x${l.value}${u}` : `${l.value}${u}`;
    }
    case 'percent': return l.of ? `${l.value}% ${l.of}` : `${l.value}%`;
    case 'multiple': return `${l.value}x ${l.of}`;
    case 'reference': return `of ${l.name}`;
    case 'qualitative': return l.value;
  }
}

/**
 * An rx split, written back labelled whichever way it came in.
 *
 * One function because it is written in two places that must not drift: `fmt`
 * puts it on the step line, and the timeline puts it in the cue a board shows.
 * The cue *is* the at-rest text here — with no division chosen, which is the
 * only state either app has, a step reads as what the whiteboard says.
 *
 * Labelled rather than positional on purpose. `(105/65)` is read by magnitude,
 * so echoing it positionally would hand back the ambiguity the labels exist to
 * remove — and spec §10 already makes canonical output the place it stops.
 */
export function formatRx(rx: Record<string, Load>): string {
  return Object.entries(rx).map(([who, l]) => `${who} ${formatLoad(l)}`).join(' / ');
}

/**
 * A load in kilograms, or `undefined` where the language cannot say.
 *
 * Kilograms because two loads written in different units cannot be compared, and
 * comparing loads across executions is the whole reason anything reads one — see
 * `measure: load` in `goals.ts`. One unit, converted once, at the edge.
 *
 * Four loads deliberately have no answer here, and each silence is a fact:
 *
 * - **A percentage or a multiple of bodyweight.** `85% 1RM` is a load only once
 *   an athlete profile says what the 1RM is, and inventing one would make the
 *   number look measured when it was guessed (spec §8.2).
 * - **A magnitude with no unit.** An unlabelled rx split writes `(105/65)`,
 *   which is a real prescription on a whiteboard and not a quantity anywhere
 *   else; see the `Load` comment in `ast.ts`.
 * - **A reference to a named result** — `85% of heavy-single` — which is a load
 *   the *session* determines (spec §8.3).
 * - **A qualitative load** — `@ heavy` — which was never a number to begin
 *   with. See the `qualitative` case in the `Load` comment in `ast.ts`.
 *
 * A paired load is the total carried: `2x24kg` is 24kg in each hand and 48kg in
 * the athlete's hands, which is what spec §3 says the notation means.
 */
const KILOGRAMS: Record<string, number> = { kg: 1, lb: 0.45359237, pood: 16.38 };

export function loadKilograms(l: Load): number | undefined {
  if (l.kind !== 'absolute' || !l.unit) return undefined;
  const per = KILOGRAMS[l.unit];
  if (per === undefined) return undefined;
  return Math.round(l.value * per * (l.implements ?? 1) * 100) / 100;
}

export function formatTarget(t: Target): string {
  switch (t.kind) {
    case 'load': return formatLoad(t.load);
    case 'height': return `${t.value}${t.unit}`;
    default: return (t as any).text;
  }
}
