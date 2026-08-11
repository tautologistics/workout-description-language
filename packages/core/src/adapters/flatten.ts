/**
 * Timeline → a flat list of executable steps, which is what every exporter
 * wants. Repeats are expanded; regions no format can express are reported
 * rather than silently dropped (roadmap §4: adapters report their lossiness).
 */

import type { Timeline, TimelineItem, TimelineStep, TimelineRest } from '../timeline.ts';

export interface FlatStep {
  movement: string;
  seconds?: number;
  distanceM?: number;
  calories?: number;
  reps?: number;
  /** Power as a fraction of FTP, when the step carries one. */
  ftp?: number;
  rampTo?: number;
  watts?: number;
  intensity: 'active' | 'rest' | 'warmup' | 'cooldown';
  label: string;
}

export interface Flattened { steps: FlatStep[]; warnings: string[] }

const PCT = /^(\d+(?:\.\d+)?)%\s*FTP$/i;
const WATTS = /^(\d+(?:\.\d+)?)W$/i;
const RAMP = /ramp\s+(\d+(?:\.\d+)?)%\s*->\s*(\d+(?:\.\d+)?)%\s*FTP/i;
const RAMP_W = /ramp\s+(\d+(?:\.\d+)?)W\s*->\s*(\d+(?:\.\d+)?)W/i;

function roleOf(s: TimelineStep): FlatStep['intensity'] {
  const n = s.notes.join(' ').toLowerCase();
  if (n.includes('warmup') || n.includes('warm-up')) return 'warmup';
  if (n.includes('cooldown') || n.includes('cool-down')) return 'cooldown';
  return 'active';
}

export function flatten(t: Timeline): Flattened {
  const steps: FlatStep[] = [];
  const warnings: string[] = [...t.warnings];

  const emitStep = (s: TimelineStep) => {
    const flat: FlatStep = { movement: s.movement, intensity: roleOf(s), label: s.label };

    switch (s.quantity.kind) {
      case 'duration': flat.seconds = s.quantity.seconds; break;
      case 'distance': flat.distanceM = s.quantity.value * ({ m: 1, km: 1000, mi: 1609.344, ft: 0.3048, yd: 0.9144 }[s.quantity.unit] ?? 1); break;
      case 'calories': flat.calories = s.quantity.value; break;
      case 'reps': case 'floor': flat.reps = s.quantity.value; break;
      case 'range': flat.reps = s.quantity.min; break;
      default: break;                                     // open / max: no bound
    }

    for (const target of s.targets) {
      // `@ 95% FTP` written by hand parses as a *load* with a reference, while
      // an imported file yields a power target carrying text. Both mean the
      // same thing, and an exporter that reads only one silently drops the
      // other — which is how a threshold interval became a 50% cruise.
      if (target.kind === 'load' && target.load.kind === 'percent'
          && /^FTP$/i.test(target.load.of ?? '')) {
        flat.ftp = target.load.value / 100;
        continue;
      }
      if (target.kind === 'load' && target.load.kind === 'absolute') {
        flat.watts = target.load.value;
        continue;
      }
      const text = (target as any).text as string | undefined;
      if (!text) continue;
      const p = text.match(PCT); if (p) flat.ftp = Number(p[1]) / 100;
      const w = text.match(WATTS); if (w) flat.watts = Number(w[1]);
    }
    for (const note of s.notes) {
      const r = note.match(RAMP);
      if (r) { flat.ftp = Number(r[1]) / 100; flat.rampTo = Number(r[2]) / 100; }
      const rw = note.match(RAMP_W);
      if (rw) { flat.watts = Number(rw[1]); flat.rampTo = Number(rw[2]); }
    }
    steps.push(flat);
  };

  const emitRest = (r: TimelineRest) => {
    steps.push({ movement: 'Rest', seconds: r.seconds, intensity: 'rest', label: r.label });
  };

  const walk = (item: TimelineItem, times: number) => {
    if (item.kind === 'step') { for (let i = 0; i < times; i++) emitStep(item); return; }
    if (item.kind === 'rest') { for (let i = 0; i < times; i++) emitRest(item); return; }

    if (item.freeOrder) {
      warnings.push('tally block flattened to document order — the workout prescribes no order');
    }
    if (item.interrupt) {
      warnings.push('interrupt overlay dropped — no target format expresses a periodic interruption');
    }

    let factor = times;
    if (item.type === 'repeat' || item.type === 'attempts') {
      if (item.rounds === undefined) { warnings.push('repeat with no round count skipped'); return; }
      factor = times * item.rounds;
    } else if (item.type === 'amrap' || item.type === 'build') {
      warnings.push(`${item.type} block exported as a single open segment — its repetition is unbounded`);
      if (item.window) steps.push({ movement: item.label, seconds: item.window, intensity: 'active', label: item.label });
      return;
    } else if (item.type === 'clock') {
      if (item.untilFailure || item.rounds === undefined) {
        warnings.push('unbounded repeat skipped — the round count is not known until execution');
        return;
      }
      factor = times * item.rounds;
    }

    for (let i = 0; i < factor; i++) for (const c of item.items) walk(c, 1);
  };

  walk(t.root, 1);
  return { steps, warnings };
}
