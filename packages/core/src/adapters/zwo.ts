/**
 * Zwift `.zwo` import (roadmap §4).
 *
 * Beyond being an adapter we owe, this is a *cross-format oracle*. A `.zwo`
 * file states each segment's duration explicitly, so the workout's total can be
 * derived straight from the XML by a completely different computation path than
 * parse → AST → compile → estimate. If the two disagree, one of them is wrong.
 *
 * The format is flat and well-formed enough that a small element scanner beats
 * taking on an XML dependency.
 */

import type { Workout, Node, Block, Step, Unit, Target } from '../ast.ts';

interface El { name: string; attrs: Record<string, string> }

/** Scan elements in document order. Self-closing and open tags both count. */
function elements(xml: string): El[] {
  const out: El[] = [];
  const tag = /<([A-Za-z_][\w.-]*)((?:\s+[\w.-]+\s*=\s*"[^"]*")*)\s*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(xml))) {
    const attrs: Record<string, string> = {};
    const attr = /([\w.-]+)\s*=\s*"([^"]*)"/g;
    let a: RegExpExecArray | null;
    while ((a = attr.exec(m[2] ?? ''))) attrs[a[1]] = a[2];
    out.push({ name: m[1], attrs });
  }
  return out;
}

function textOf(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m?.[1].trim() || undefined;
}

const secs = (v?: string): Unit => ({ kind: 'duration', seconds: Math.round(Number(v ?? 0)) });
const pct = (v?: string) => Math.round(Number(v ?? 0) * 1000) / 10;

function step(seconds: Unit, targets: Target[], notes: string[] = [], line = 0): Step {
  return {
    node: 'step', movement: 'Bike', quantity: seconds, targets,
    flags: [], notes, comments: [], line,
  };
}

const ftp = (power?: string): Target[] =>
  power === undefined ? [] : [{ kind: 'power', text: `${pct(power)}% FTP` }];

/** Segments Zwift treats as a ramp between two power targets. */
function rampNotes(el: El): string[] {
  const lo = el.attrs.PowerLow, hi = el.attrs.PowerHigh;
  return lo !== undefined && hi !== undefined && lo !== hi
    ? [`ramp ${pct(lo)}% -> ${pct(hi)}% FTP`] : [];
}

export function importZwo(xml: string): Workout {
  const body: Node[] = [];
  const push = (n: Node) => body.push(n);
  let line = 0;

  for (const el of elements(xml)) {
    line++;
    const a = el.attrs;
    switch (el.name) {
      case 'Warmup':
      case 'Cooldown':
      case 'Ramp': {
        const notes = rampNotes(el);
        push(step(secs(a.Duration), notes.length ? [] : ftp(a.Power ?? a.PowerLow), notes, line));
        break;
      }
      case 'SteadyState':
        push(step(secs(a.Duration), ftp(a.Power ?? a.PowerLow), [], line));
        break;
      case 'FreeRide':
        push(step(secs(a.Duration), [], ['free ride'], line));
        break;
      case 'MaxEffort':
        push(step(secs(a.Duration), [], ['max effort'], line));
        break;
      case 'IntervalsT': {
        // Zwift's only repeat construct: N x (on, off).
        const block: Block = {
          node: 'block', type: 'repeat', count: Number(a.Repeat ?? 1),
          inherited: [], equipment: [], flags: ['rounds'], children: [],
          comments: [], line,
        };
        block.children.push(step(secs(a.OnDuration), ftp(a.OnPower), [], line));
        block.children.push(step(secs(a.OffDuration), ftp(a.OffPower), [], line));
        push(block);
        break;
      }
    }
  }

  const workout: Workout = {
    node: 'workout', directives: {}, body, comments: [],
  };
  const name = textOf(xml, 'name');
  if (name) workout.title = name;
  const author = textOf(xml, 'author');
  if (author) workout.directives.author = author;
  workout.directives.source = 'zwift-zwo';
  return workout;
}

/**
 * Total seconds read straight off the XML, with no structural interpretation.
 * Deliberately naive — that is the point: it must agree with the compiled
 * timeline without sharing any code with it.
 */
export function zwoDurationSeconds(xml: string): number {
  let total = 0;
  for (const el of elements(xml)) {
    const a = el.attrs;
    if (['Warmup', 'Cooldown', 'Ramp', 'SteadyState', 'FreeRide', 'MaxEffort'].includes(el.name)) {
      total += Math.round(Number(a.Duration ?? 0));
    } else if (el.name === 'IntervalsT') {
      total += Number(a.Repeat ?? 1) *
        (Math.round(Number(a.OnDuration ?? 0)) + Math.round(Number(a.OffDuration ?? 0)));
    }
  }
  return total;
}
