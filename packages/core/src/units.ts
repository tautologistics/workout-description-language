/** Quantity, load, and target parsing (spec §3). */

import type { Unit, Load, Target } from './ast.ts';

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
  const t = s.trim().toLowerCase().replace(/\s+/g, '');

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
  // mm:ss
  const clock = t.match(/^(\d+):([0-5]\d)$/);
  if (clock) return { kind: 'duration', seconds: +clock[1] * 60 + +clock[2] };
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
    const d = parseDuration(sp[0].replace(/\s+/g, '').replace(/(minutes?|mins)$/i, 'min')
      .replace(/(seconds?|secs?)$/i, 's').replace(/hours?$/i, 'h'), true);
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
  return { kind: 'raw', text: t };
}

export function formatLoad(l: Load): string {
  switch (l.kind) {
    case 'absolute': return l.implements ? `${l.implements}x${l.value}${l.unit}` : `${l.value}${l.unit}`;
    case 'percent': return l.of ? `${l.value}% ${l.of}` : `${l.value}%`;
    case 'multiple': return `${l.value}x ${l.of}`;
    case 'reference': return `of ${l.name}`;
  }
}

export function formatTarget(t: Target): string {
  switch (t.kind) {
    case 'load': return formatLoad(t.load);
    case 'height': return `${t.value}${t.unit}`;
    default: return (t as any).text;
  }
}
