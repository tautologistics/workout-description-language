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
