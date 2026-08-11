/**
 * Garmin FIT workout-file import (roadmap §4).
 *
 * FIT is binary and self-describing: definition records declare a message's
 * fields and widths, and data records follow that layout. Only two message
 * types matter for a workout file — `workout` (26) and `workout_step` (27) —
 * so a full SDK is unnecessary.
 *
 * It carries its own oracle. The `workout` message states `num_valid_steps`,
 * which must equal the number of `workout_step` records actually present, and a
 * repeat step names the index it jumps back to, so the structure can be checked
 * against a count the file itself publishes.
 */

import type { Workout, Node, Block, Step, Unit, Target } from '../ast.ts';

const MSG_WORKOUT = 26;
const MSG_WORKOUT_STEP = 27;

/** FIT base types, keyed by the low bits of the base-type byte: [size, signed]. */
const BASE: Record<number, { size: number; read: (v: DataView, o: number, le: boolean) => number | null }> = {
  0x00: { size: 1, read: (v, o) => (v.getUint8(o) === 0xff ? null : v.getUint8(o)) },
  0x01: { size: 1, read: (v, o) => (v.getInt8(o) === 0x7f ? null : v.getInt8(o)) },
  0x02: { size: 1, read: (v, o) => (v.getUint8(o) === 0xff ? null : v.getUint8(o)) },
  0x03: { size: 2, read: (v, o, le) => (v.getUint16(o, le) === 0x7fff ? null : v.getInt16(o, le)) },
  0x04: { size: 2, read: (v, o, le) => (v.getUint16(o, le) === 0xffff ? null : v.getUint16(o, le)) },
  0x05: { size: 4, read: (v, o, le) => (v.getUint32(o, le) === 0x7fffffff ? null : v.getInt32(o, le)) },
  0x06: { size: 4, read: (v, o, le) => (v.getUint32(o, le) === 0xffffffff ? null : v.getUint32(o, le)) },
  0x0a: { size: 1, read: (v, o) => (v.getUint8(o) === 0 ? null : v.getUint8(o)) },
  0x0b: { size: 2, read: (v, o, le) => (v.getUint16(o, le) === 0 ? null : v.getUint16(o, le)) },
  0x0c: { size: 4, read: (v, o, le) => (v.getUint32(o, le) === 0 ? null : v.getUint32(o, le)) },
  0x0d: { size: 1, read: (v, o) => v.getUint8(o) },
};

interface FieldDef { num: number; size: number; base: number }
interface MsgDef { global: number; le: boolean; fields: FieldDef[] }

export interface FitMessage { global: number; fields: Record<number, number | string | null> }

/** Walk the record stream, returning workout and workout_step messages in order. */
export function readFit(buf: Uint8Array): FitMessage[] {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const headerSize = v.getUint8(0);
  const dataSize = v.getUint32(4, true);
  let o = headerSize;
  const end = headerSize + dataSize;
  const defs = new Map<number, MsgDef>();
  const out: FitMessage[] = [];

  while (o < end) {
    const rh = v.getUint8(o++);
    const compressed = (rh & 0x80) !== 0;
    const local = compressed ? (rh >> 5) & 0x03 : rh & 0x0f;

    if (!compressed && (rh & 0x40)) {                    // definition message
      o++;                                               // reserved
      const le = v.getUint8(o++) === 0;
      const global = v.getUint16(o, le); o += 2;
      const n = v.getUint8(o++);
      const fields: FieldDef[] = [];
      for (let i = 0; i < n; i++) {
        fields.push({ num: v.getUint8(o), size: v.getUint8(o + 1), base: v.getUint8(o + 2) });
        o += 3;
      }
      if (rh & 0x20) {                                   // developer fields
        const dn = v.getUint8(o++);
        o += dn * 3;
      }
      defs.set(local, { global, le, fields });
      continue;
    }

    const def = defs.get(local);
    if (!def) break;                                     // stream we cannot follow
    const msg: FitMessage = { global: def.global, fields: {} };
    for (const f of def.fields) {
      const base = f.base & 0x1f;
      if (base === 0x07) {                               // string
        let sVal = '';
        for (let i = 0; i < f.size; i++) {
          const c = v.getUint8(o + i);
          if (c === 0) break;
          sVal += String.fromCharCode(c);
        }
        msg.fields[f.num] = sVal || null;
      } else {
        const b = BASE[base];
        msg.fields[f.num] = b && f.size >= b.size ? b.read(v, o, def.le) : null;
      }
      o += f.size;
    }
    if (msg.global === MSG_WORKOUT || msg.global === MSG_WORKOUT_STEP) out.push(msg);
  }
  return out;
}

// workout_step field numbers
const F_NAME = 0, F_DURATION_TYPE = 1, F_DURATION_VALUE = 2,
      F_TARGET_TYPE = 3, F_TARGET_VALUE = 4,
      F_CUSTOM_LOW = 5, F_CUSTOM_HIGH = 6, F_INTENSITY = 7;

/** Duration types that mean "repeat back to step N", rather than doing work. */
const REPEAT_TYPES = new Set([6, 7, 8, 9, 10, 11, 12, 13]);

const INTENSITY = ['active', 'rest', 'warmup', 'cooldown'];

function durationOf(type: number | null, value: number | null): Unit {
  if (type === 0 && value !== null) return { kind: 'duration', seconds: Math.round(value / 1000) };
  if (type === 1 && value !== null) return { kind: 'distance', value: Math.round(value / 100), unit: 'm' };
  if (type === 4 && value !== null) return { kind: 'calories', value };
  return { kind: 'open' };
}

function targetOf(type: number | null, value: number | null, lo: number | null, hi: number | null): Target[] {
  // A custom range beats a zone number; power is offset by 1000 when absolute.
  const w = (n: number) => (n > 1000 ? `${n - 1000}W` : `zone ${n}`);
  if (type === 4) {
    if (lo !== null && hi !== null && (lo || hi)) return [{ kind: 'power', text: `${w(lo)}-${w(hi)}` }];
    if (value) return [{ kind: 'power', text: w(value) }];
  }
  if (type === 1) {
    if (lo !== null && hi !== null && (lo || hi)) return [{ kind: 'heartRate', text: `${lo}-${hi}bpm` }];
    if (value) return [{ kind: 'heartRate', text: `zone ${value}` }];
  }
  if (type === 0 && lo !== null && hi !== null && (lo || hi)) {
    return [{ kind: 'pace', text: `${lo / 1000}-${hi / 1000}m/s` }];
  }
  return [];
}

export function importFit(buf: Uint8Array): Workout {
  const msgs = readFit(buf);
  const header = msgs.find((m) => m.global === MSG_WORKOUT);
  const rawSteps = msgs.filter((m) => m.global === MSG_WORKOUT_STEP);

  const body: Node[] = [];
  const emitted: Node[] = [];   // one slot per source step, for repeat targets

  rawSteps.forEach((m, i) => {
    const f = m.fields;
    const dType = f[F_DURATION_TYPE] as number | null;
    const dValue = f[F_DURATION_VALUE] as number | null;

    if (dType !== null && REPEAT_TYPES.has(dType)) {
      // `repeat_until_steps_cmplt`: duration_value is the index to jump back to,
      // target_value is how many times through. Wrap the steps already emitted.
      const from = dValue ?? 0;
      const times = (f[F_TARGET_VALUE] as number | null) ?? 2;
      const taken = emitted.slice(from).filter(Boolean) as Node[];
      for (const t of taken) {
        const at = body.indexOf(t);
        if (at >= 0) body.splice(at, 1);
      }
      const block: Block = {
        node: 'block', type: 'repeat', count: times,
        inherited: [], equipment: [], flags: ['rounds'],
        children: taken, comments: [], line: i + 1,
      };
      body.push(block);
      emitted.push(block);
      return;
    }

    const step: Step = {
      node: 'step',
      movement: (f[F_NAME] as string | null) || 'Bike',
      quantity: durationOf(dType, dValue),
      targets: targetOf(f[F_TARGET_TYPE] as number | null, f[F_TARGET_VALUE] as number | null,
                        f[F_CUSTOM_LOW] as number | null, f[F_CUSTOM_HIGH] as number | null),
      notes: [], flags: [], comments: [], line: i + 1,
    };
    const intensity = f[F_INTENSITY] as number | null;
    if (intensity !== null && intensity !== 0 && INTENSITY[intensity]) step.notes.push(INTENSITY[intensity]);
    body.push(step);
    emitted.push(step);
  });

  const workout: Workout = { node: 'workout', directives: {}, body, comments: [] };
  const name = header?.fields[8] as string | null;
  if (name) workout.title = name;
  workout.directives.source = 'garmin-fit';
  return workout;
}

/** Step count the file itself publishes, and the count actually present. */
export function fitStepCounts(buf: Uint8Array): { declared: number | null; present: number } {
  const msgs = readFit(buf);
  const header = msgs.find((m) => m.global === MSG_WORKOUT);
  return {
    declared: (header?.fields[6] as number | null) ?? null,
    present: msgs.filter((m) => m.global === MSG_WORKOUT_STEP).length,
  };
}

// ---------------------------------------------------------------------------

import type { Timeline } from '../timeline.ts';
import { flatten } from './flatten.ts';
import type { ExportResult } from './zwo.ts';

/** FIT's own CRC-16, over the header and then the whole file. */
const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

export function fitCrc(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    let tmp = CRC_TABLE[crc & 0xf];
    crc = ((crc >> 4) & 0x0fff) ^ tmp ^ CRC_TABLE[byte & 0xf];
    tmp = CRC_TABLE[crc & 0xf];
    crc = ((crc >> 4) & 0x0fff) ^ tmp ^ CRC_TABLE[(byte >> 4) & 0xf];
  }
  return crc & 0xffff;
}

class Writer {
  bytes: number[] = [];
  u8(v: number) { this.bytes.push(v & 0xff); }
  u16(v: number) { this.u8(v); this.u8(v >> 8); }
  u32(v: number) { this.u16(v); this.u16(v >> 16); }
  str(v: string, size: number) {
    for (let i = 0; i < size; i++) this.u8(i < v.length ? v.charCodeAt(i) : 0);
  }
}

const NAME_LEN = 16;

/**
 * Export to a Garmin `.fit` workout file.
 *
 * Writes a `file_id`, a `workout`, and one `workout_step` per step. Repeats are
 * **expanded** rather than re-emitted as `repeat_until_steps_cmplt` markers:
 * semantically identical, but it inflates the step count, and watches cap how
 * many steps they will accept. That is reported, not hidden.
 *
 * FIT is the richest of the three targets — duration, distance and calorie
 * steps, plus intensity roles. What it does not carry is rep-based strength
 * work, which has no duration type, so those become open steps.
 */
export interface FitExportOptions {
  name?: string;
  /** Needed to turn `% FTP` targets into the watts a device expects. */
  ftp?: number;
  /** Fixed by default so exports stay byte-identical run to run. */
  createdAt?: Date;
}

/** FIT counts seconds from 1989-12-31, not 1970. */
const FIT_EPOCH = 631065600;

const SPORT = { generic: 0, running: 1, cycling: 2, swimming: 5, training: 10 } as const;

/** Guess the sport from the movements, so the watch files the workout correctly. */
function sportOf(movements: string[]): number {
  const j = movements.join(' ').toLowerCase();
  if (/\bbike\b|cycl/.test(j)) return SPORT.cycling;
  if (/\bswim\b/.test(j)) return SPORT.swimming;
  if (/\brun\b|sprint|jog/.test(j)) return SPORT.running;
  return SPORT.training;
}

export function exportFit(t: Timeline, opts: FitExportOptions = {}): ExportResult {
  const { steps, warnings } = flatten(t);
  const w = new Writer();
  const name = (opts.name ?? t.root.label ?? 'Workout').slice(0, NAME_LEN - 1);
  const created = Math.round(((opts.createdAt?.getTime() ?? Date.UTC(2026, 0, 1)) / 1000) - FIT_EPOCH);

  // --- file_id (global 0), local 0
  w.u8(0x40); w.u8(0); w.u8(0); w.u16(0); w.u8(4);
  w.u8(0); w.u8(1); w.u8(0x00);            // type: enum
  w.u8(1); w.u8(2); w.u8(0x84);            // manufacturer: uint16
  w.u8(2); w.u8(2); w.u8(0x84);            // product: uint16
  w.u8(4); w.u8(4); w.u8(0x86);            // time_created: uint32
  w.u8(0x00); w.u8(5); w.u16(255); w.u16(0); w.u32(created);

  // --- workout (global 26), local 1
  w.u8(0x41); w.u8(0); w.u8(0); w.u16(26); w.u8(3);
  w.u8(8); w.u8(NAME_LEN); w.u8(0x07);     // wkt_name: string
  w.u8(4); w.u8(1); w.u8(0x00);            // sport: enum
  w.u8(6); w.u8(2); w.u8(0x84);            // num_valid_steps: uint16
  w.u8(0x01); w.str(name, NAME_LEN);
  w.u8(sportOf(steps.map((s) => s.movement))); w.u16(steps.length);

  // --- workout_step (global 27), local 2
  w.u8(0x42); w.u8(0); w.u8(0); w.u16(27); w.u8(9);
  w.u8(254); w.u8(2); w.u8(0x84);          // message_index: uint16
  w.u8(0); w.u8(NAME_LEN); w.u8(0x07);     // wkt_step_name: string
  w.u8(1); w.u8(1); w.u8(0x00);            // duration_type: enum
  w.u8(2); w.u8(4); w.u8(0x86);            // duration_value: uint32
  w.u8(3); w.u8(1); w.u8(0x00);            // target_type: enum
  w.u8(4); w.u8(4); w.u8(0x86);            // target_value: uint32
  w.u8(5); w.u8(4); w.u8(0x86);            // custom_target_value_low: uint32
  w.u8(6); w.u8(4); w.u8(0x86);            // custom_target_value_high: uint32
  w.u8(7); w.u8(1); w.u8(0x00);            // intensity: enum

  const INTENSITY: Record<string, number> = { active: 0, rest: 1, warmup: 2, cooldown: 3 };
  const NONE = 0xffffffff;
  let unconverted = 0;

  steps.forEach((s, i) => {
    let durationType = 5, durationValue = NONE;          // open
    if (s.seconds !== undefined) { durationType = 0; durationValue = s.seconds * 1000; }
    else if (s.distanceM !== undefined) { durationType = 1; durationValue = Math.round(s.distanceM * 100); }
    else if (s.calories !== undefined) { durationType = 4; durationValue = s.calories; }
    else if (s.reps !== undefined) { durationType = 29; durationValue = s.reps; }
    else if (s.threshold?.metric === 'hr') {
      // FIT has carried this since the beginning: 2 is hr_less_than, 3 is
      // hr_greater_than, and a bpm threshold is stored with a +100 offset.
      durationType = s.threshold.compare === 'lt' ? 2 : 3;
      durationValue = s.threshold.value + 100;
    } else if (s.threshold?.metric === 'power') {
      durationType = s.threshold.compare === 'lt' ? 14 : 15;
      durationValue = s.threshold.value + 1000;
    }

    // Custom power and heart-rate ranges carry a +1000 / +100 offset in FIT.
    let targetType = 2, targetValue = 0, low = NONE, high = NONE;
    const watts = s.watts ?? (s.ftp !== undefined && opts.ftp ? Math.round(s.ftp * opts.ftp) : undefined);
    if (watts !== undefined) {
      targetType = 4; targetValue = 0;
      low = 1000 + Math.round(watts * 0.97);
      high = 1000 + Math.round(watts * 1.03);
    } else if (s.ftp !== undefined) {
      unconverted++;
    }

    w.u8(0x02);
    w.u16(i);
    w.str(s.movement.slice(0, NAME_LEN - 1), NAME_LEN);
    w.u8(durationType);
    w.u32(durationValue);
    w.u8(targetType);
    w.u32(targetValue);
    w.u32(low);
    w.u32(high);
    w.u8(INTENSITY[s.intensity] ?? 0);
  });

  const ramps = steps.filter((s) => s.rampTo !== undefined).length;
  if (ramps) {
    warnings.push(`${ramps} ramp(s) exported at their starting target: a FIT workout step holds one target range, so a changing target flattens`);
  }
  const weighted = steps.filter((s) => s.weight).length;
  if (weighted) {
    warnings.push(`${weighted} step(s) exported without their load: a FIT workout step has no external-weight field, so the barbell weight is lost`);
  }
  if (unconverted) {
    warnings.push(`${unconverted} step(s) exported without a power target: FIT stores watts, so an FTP is needed to resolve a percentage — pass one to keep them`);
  }
  if (steps.length > 50) {
    warnings.push(`${steps.length} steps: repeats are expanded rather than emitted as repeat markers, and most devices refuse workouts beyond about 50 steps`);
  }

  // --- header, then CRCs
  const data = Uint8Array.from(w.bytes);
  const head = new Writer();
  head.u8(14); head.u8(0x10); head.u16(2140); head.u32(data.length);
  head.str('.FIT', 4);
  const headBytes = Uint8Array.from(head.bytes);
  const out = new Uint8Array(14 + data.length + 2);
  out.set(headBytes, 0);
  new DataView(out.buffer).setUint16(12, fitCrc(headBytes), true);
  out.set(data, 14);
  new DataView(out.buffer).setUint16(out.length - 2, fitCrc(out.subarray(0, out.length - 2)), true);

  return { output: Buffer.from(out).toString('base64'), warnings, bytes: out } as ExportResult & { bytes: Uint8Array };
}
