/** Phase 2 of the two-phase parse: line tree -> AST. */

import type {
  Workout, Node, Step, Rest, Block, Interrupt, Score, Target, Laterality,
} from './ast.ts';
import { readLines, expandInline, splitTopLevel, type Line } from './lines.ts';
import { parseQuantity, parseDuration, parseTarget } from './units.ts';

export interface ParseError { line: number; message: string; text: string; }

const SECTIONS = new Set([
  'warmup', 'warm-up', 'strength', 'skill', 'conditioning', 'accessory', 'cooldown', 'cool-down',
]);

class Parser {
  errors: ParseError[] = [];

  // ---------- steps ----------

  parseStep(text: string, line: Line): Step {
    const step: Step = {
      node: 'step', movement: '', quantity: { kind: 'open' },
      targets: [], flags: [], notes: [], comments: line.comments, line: line.line,
    };

    const parts = splitTopLevel(text, ',');
    let main = parts.shift() ?? '';

    // `@tiebreak` (no space) is a flag; `@ 95lb` (space) is a target.
    main = main.replace(/@(\w[\w-]*)/g, (_m, word) => { step.flags.push(word); return ''; }).trim();

    // Qualifiers may trail the step without a comma — `40 Wall Ball @ 20lb shared`,
    // `14 DB Curl each arm`, `21 DB Snatch first arm`. Peel them off the end before
    // splitting on `@`, or they end up inside the load or the movement name.
    main = this.peelTrailingQualifiers(main, step);

    const segments = main.split('@').map((s) => s.trim());
    let head = segments.shift() ?? '';
    for (const seg of segments) {
      if (!seg) continue;
      // `9kg to 10ft` is a load plus a target height.
      for (const piece of seg.split(/\s+to\s+/)) {
        if (piece.trim()) step.targets.push(parseTarget(piece));
      }
    }

    // A qualifier may sit before the target as well as after it —
    // `Dumbbell Curl each arm @ 2x35lb`. Peel the movement segment too.
    head = this.peelTrailingQualifiers(head, step);

    // laterality in parentheses
    head = head.replace(/\((both|split|per-side|total)\)/i, (_m, mode) => {
      const m = mode.toLowerCase();
      step.laterality = (m === 'total' ? 'split' : m) as Laterality;
      return '';
    }).trim();

    let { quantity, rest } = parseQuantity(head);

    // `2min max Push-Up` — the clock ends the step, the reps are what it
    // measures. Completion and measurement are different facts (spec §4, N6).
    const maxAfter = rest.match(/^max\s+(.+)$/i);
    if (maxAfter && quantity.kind === 'duration') {
      step.measures = 'reps';
      step.flags.push('max');
      rest = maxAfter[1];
    }
    // `max Bench Press` with no enclosing clock is a max effort to failure,
    // not a remainder — the two are resolved during compilation.
    step.quantity = quantity;

    // `10 alternating DB Snatch` — the word sits before the movement name, which
    // is how it is written on a whiteboard. It is a counting mode, not part of
    // the name (registry §6): it maps to `split` and survives as a note.
    let movement = rest.trim();
    const inlineAlt = movement.match(/^(alternating|alt)\s+(.+)$/i);
    if (inlineAlt) {
      step.laterality = 'split';
      step.notes.push('alternating');
      movement = inlineAlt[2];
    }
    step.movement = movement;

    for (const q of parts) this.applyQualifier(step, q, line);
    return step;
  }

  /** Repeatedly strip known qualifier phrases from the end of a step. */
  peelTrailingQualifiers(text: string, step: Step): string {
    const rules: [RegExp, (m: RegExpMatchArray) => void][] = [
      [/\s+(each|per)\s+(arm|leg|side|hand)$/i, (m) => { step.laterality = 'per-side'; step.limb = m[2].toLowerCase(); }],
      [/\s+(first|second|left|right)\s+(arm|leg|side)$/i, (m) => { step.side = m[1].toLowerCase() as any; step.limb = m[2].toLowerCase(); }],
      [/\s+(shared|synchronized|each)$/i, (m) => { step.team = m[1].toLowerCase() as any; }],
      [/\s+(alternating|alt)$/i, () => { step.laterality = 'split'; step.notes.push('alternating'); }],
      [/\s+(unbroken|building)$/i, (m) => { step.flags.push(m[1].toLowerCase()); }],
    ];
    let t = text.trim(), changed = true;
    while (changed) {
      changed = false;
      for (const [re, apply] of rules) {
        const m = t.match(re);
        if (m) { apply(m); t = t.slice(0, m.index).trim(); changed = true; break; }
      }
    }
    return t;
  }

  applyQualifier(step: Step, q: string, line: Line) {
    const t = q.trim();
    let m: RegExpMatchArray | null;

    if ((m = t.match(/^tempo\s+(\S+)$/i))) { step.tempo = m[1]; return; }
    if ((m = t.match(/^count\s+(cal|calories|reps|distance)$/i))) {
      step.measures = m[1].toLowerCase().startsWith('cal') ? 'calories' : (m[1].toLowerCase() as any);
      return;
    }
    if ((m = t.match(/^\+(\d+)\s+each\s+round$/i))) {
      step.perRound = { delta: +m[1], unit: 'reps' }; return;
    }
    if ((m = t.match(/^(first|second|left|right)\s+(arm|leg|side)$/i))) {
      step.side = m[1].toLowerCase() as any; step.limb = m[2].toLowerCase(); return;
    }
    if ((m = t.match(/^(each|per)\s+(arm|leg|side|hand)$/i))) {
      step.laterality = 'per-side'; step.limb = m[2].toLowerCase(); return;
    }
    if (/^alternating$|^alt$/i.test(t)) { step.laterality = 'split'; step.notes.push('alternating'); return; }
    if (/^(shared|each|synchronized)$/i.test(t)) { step.team = t.toLowerCase() as any; return; }
    if ((m = t.match(/^note:\s*"?(.*?)"?$/i))) { step.notes.push(m[1]); return; }
    if (/^(building|unbroken|open)$/i.test(t)) { step.flags.push(t.toLowerCase()); return; }
    if (/^ramp\s/i.test(t) || /^wearing\s/i.test(t)) { step.notes.push(t); return; }

    step.notes.push(t);
  }

  // ---------- rest ----------

  parseRest(text: string, line: Line): Rest {
    const rest: Rest = { node: 'rest', afterLast: false, comments: line.comments, line: line.line };
    let t = text.replace(/^rest\s*/i, '').trim();

    if (/after\s+last$/i.test(t)) { rest.afterLast = true; t = t.replace(/after\s+last$/i, '').trim(); }
    if (/^as\s+needed$/i.test(t)) { rest.dynamic = 'as-needed'; return rest; }
    if (/^=\s*work$/i.test(t) || /^equal\s+to\s+work$/i.test(t)) { rest.dynamic = 'equal-to-work'; return rest; }

    if (t) {
      const d = parseDuration(t, true);
      if (d) { rest.duration = d; return rest; }
      // Active recovery — `rest 400m Jog`. The rest interval is work, not a clock.
      const { quantity, rest: movement } = parseQuantity(t);
      if (quantity.kind !== 'open' && movement) {
        rest.active = { quantity, movement };
        return rest;
      }
      this.errors.push({ line: line.line, message: `unreadable rest duration "${t}"`, text: line.text });
    }
    return rest;
  }

  // ---------- blocks ----------

  blank(line: Line, type: Block['type']): Block {
    return {
      node: 'block', type, inherited: [], equipment: [], flags: [],
      children: [], comments: line.comments, line: line.line,
    };
  }

  parseHeader(headRaw: string, line: Line): Block {
    const parts = splitTopLevel(headRaw.replace(/:\s*$/, ''), ',');
    let head = (parts.shift() ?? '').trim();
    const block = this.blank(line, 'sequence');

    // header-level targets and equipment, inherited by children (spec §5.0)
    head = head.replace(/@\s*([^,@]+)/g, (_m, target) => {
      block.inherited.push(parseTarget(target.trim())); return '';
    }).trim();

    // `for time` may be fused onto a repeat: `3 rounds for time`
    if (/\bfor\s+time\b/i.test(head)) {
      block.score = { primary: 'time', raw: 'time', implied: true };
      head = head.replace(/\bfor\s+time\b/i, '').trim();
    }

    let m: RegExpMatchArray | null;
    if (!head) {
      block.type = 'sequence';
    } else if ((m = head.match(/^(\d+)\s+(rounds?|sets?)$/i))) {
      block.type = 'repeat'; block.count = +m[1];
      block.flags.push(/set/i.test(m[2]) ? 'sets' : 'rounds');
    } else if ((m = head.match(/^(\d+)\s+attempts?$/i))) {
      block.type = 'attempts'; block.count = +m[1];
    } else if ((m = head.match(/^team\s+of\s+(\d+)$/i))) {
      block.type = 'team'; block.count = +m[1];
    } else if (/^(\d+)(-\d+)+$/.test(head)) {
      block.type = 'ladder'; block.scheme = head.split('-').map(Number);
    } else if ((m = head.match(/^for\s+(\S+)$/i)) && parseDuration(m[1], true)) {
      // `for 12min:` — a duration-bounded block that is not an AMRAP (Cooper test).
      block.type = 'amrap'; block.duration = parseDuration(m[1], true) ?? undefined;
      block.flags.push('for-duration');
    } else if ((m = head.match(/^AMRAP(?:\s+(\S+))?$/i))) {
      block.type = 'amrap';
      block.duration = m[1] ? (parseDuration(m[1], true) ?? undefined) : undefined;
      block.score ??= { primary: 'rounds + reps', raw: 'rounds + reps', implied: true };
    } else if ((m = head.match(/^E(\d*)MOM\s+(\S+)$/i))) {
      block.type = 'clock';
      block.every = { kind: 'duration', seconds: (m[1] ? +m[1] : 1) * 60 };
      block.duration = parseDuration(m[2], true) ?? undefined;
    } else if ((m = head.match(/^every\s+(\S+)\s+until\s+failure$/i))) {
      block.type = 'clock'; block.every = parseDuration(m[1], true) ?? undefined; block.untilFailure = true;
    } else if ((m = head.match(/^every\s+(\S+)\s*(?:x|×)\s*(\d+)$/i))) {
      block.type = 'clock'; block.every = parseDuration(m[1], true) ?? undefined; block.count = +m[2];
    } else if ((m = head.match(/^every\s+(\S+)$/i))) {
      block.type = 'clock'; block.every = parseDuration(m[1], true) ?? undefined;
    } else if ((m = head.match(/^work\s+(\S+)$/i))) {
      block.type = 'work'; block.duration = parseDuration(m[1], true) ?? undefined;
    } else if ((m = head.match(/^min(?:ute)?\s+(\d+)$/i))) {
      block.type = 'cycleEntry'; block.count = +m[1];
    } else if (/^any\s+order$/i.test(head)) {
      block.type = 'tally';
    } else if (/^superset$/i.test(head)) {
      block.type = 'superset';
    } else if (/^complex$/i.test(head)) {
      block.type = 'complex';
    } else if (/^sequence$/i.test(head)) {
      block.type = 'sequence';
    } else if ((m = head.match(/^build\s+to\s+(.+?)\s+in\s+(\S+?)(?:\s+as\s+([\w-]+))?$/i))) {
      block.type = 'build';
      block.duration = parseDuration(m[2], true) ?? undefined;
      block.label = m[3];
      block.buildTarget = m[1];
      block.score ??= { primary: 'max load', raw: 'max load', implied: true };
    } else if (SECTIONS.has(head.toLowerCase())) {
      block.type = 'section'; block.name = head.toLowerCase();
    } else {
      block.type = 'sequence'; block.name = head;
      this.errors.push({ line: line.line, message: `unrecognized block header "${head}"`, text: line.text });
    }

    for (const mod of parts) this.applyBlockModifier(block, mod, line);
    return block;
  }

  applyBlockModifier(block: Block, mod: string, line: Line) {
    const t = mod.trim();
    let m: RegExpMatchArray | null;

    if ((m = t.match(/^cap\s+(\S+)$/i))) { block.cap = parseDuration(m[1], true) ?? undefined; return; }
    if ((m = t.match(/^(carry|cut|fail)\s+on\s+overrun$/i))) { block.onOverrun = m[1].toLowerCase() as any; return; }
    if ((m = t.match(/^wearing\s+(.+)$/i))) { block.equipment.push(m[1]); return; }
    if ((m = t.match(/^as\s+([\w-]+)$/i))) { block.label = m[1]; return; }
    if (/\bfor\s+time\b/i.test(t)) { block.score = { primary: 'time', raw: 'time', implied: true }; return; }
    if (/^(building|unbroken|synchronized|shared)$/i.test(t)) { block.flags.push(t.toLowerCase()); return; }
    block.flags.push(t);
  }

  // ---------- dispatch ----------

  parseNode(line: Line): Node | null {
    const { head, inline, tail } = expandInline(line);
    const kids = inline ? [...inline, ...line.children] : line.children;
    const text = head.trim();
    if (!text) return null;

    if (/^-\s+/.test(text)) return this.parseStep(text.replace(/^-\s+/, ''), line);
    if (/^rest\b/i.test(text)) return this.parseRest(text, line);

    // `every 1min: 5 Burpee` with inline body is an interrupt overlay (spec §5.8);
    // `every 3min x 5:` with children is a clock-driven repeat.
    let m = text.match(/^every\s+(\S+):\s*(.+)$/i);
    if (m) {
      const body = this.parseStep(m[2].replace(/^-\s+/, ''), line);
      return {
        node: 'interrupt', every: parseDuration(m[1], true) ?? { kind: 'duration', seconds: 60 },
        body: [body], comments: line.comments, line: line.line,
      } as Interrupt;
    }

    // `min 1: 12cal Row` / `work 20s: Burpee` — header with inline single child
    m = text.match(/^((?:min(?:ute)?\s+\d+|work\s+\S+)):\s*(.+)$/i);
    if (m) {
      const block = this.parseHeader(m[1], line);
      const child = /^rest\b/i.test(m[2])
        ? this.parseRest(m[2], line)
        : this.parseStep(m[2].replace(/^-\s+/, ''), line);
      block.children.push(child);
      return block;
    }

    if (text.endsWith(':')) {
      const block = this.parseHeader(text, line);
      for (const k of kids) {
        // A `score:` nested inside a block belongs to that block; at the top
        // level it belongs to the workout. One rule, no ambiguity with siblings.
        if (/^score:/i.test(k.text.trim())) { block.score = parseScore(k.text.trim()); continue; }
        const n = this.parseNode(k);
        if (n) block.children.push(n);
      }
      if (tail && /^score:/i.test(tail)) block.score = parseScore(tail);
      return block;
    }

    // bare step (inline-expanded bodies, and single-step workouts)
    return this.parseStep(text, line);
  }
}

function parseScore(text: string): Score {
  const raw = text.replace(/^score:\s*/i, '').trim();
  const score: Score = { primary: raw, raw };

  const inner = raw.replace(/^\{|\}$/g, '').trim();
  if (inner !== raw) {
    for (const part of splitTopLevel(inner, ',')) {
      const [k, ...v] = part.split(':');
      const key = k.trim().toLowerCase(), val = v.join(':').trim();
      if (key === 'primary') score.primary = val;
      else if (key === 'on cap') score.onCap = val;
      else if (key === 'tiebreak') score.tiebreak = val;
    }
    return score;
  }
  let m = raw.match(/^(min|max|sum)\s+per\s+round$/i);
  if (m) { score.aggregate = m[1].toLowerCase() as any; score.perRound = true; score.primary = raw; return score; }
  m = raw.match(/^(.+?)\s+per\s+round$/i);
  if (m) { score.perRound = true; score.primary = m[1]; return score; }
  m = raw.match(/^sum\s+of\s+blocks$/i);
  if (m) { score.aggregate = 'sum'; score.primary = 'blocks'; return score; }
  return score;
}

export function parse(source: string): { workout: Workout; errors: ParseError[] } {
  const p = new Parser();
  const workout: Workout = { node: 'workout', directives: {}, body: [], comments: [] };
  const roots = readLines(source);

  for (const line of roots) {
    const text = line.text.trim();

    if (!text) { workout.comments.push(...line.comments); continue; }

    const dm = text.match(/^@([\w-]+)\s*(.*)$/);
    if (dm) { workout.directives[dm[1]] = dm[2].trim(); continue; }
    if (text.startsWith('#')) { workout.title = text.replace(/^#+\s*/, ''); continue; }
    if (/^score:/i.test(text)) { workout.score = parseScore(text); continue; }
    if (/^variants:$/i.test(text)) {
      workout.variants = {};
      for (const v of line.children) {
        const vm = v.text.match(/^([\w-]+):\s*(.*)$/);
        if (!vm) continue;
        const entries: Record<string, string> = {};
        const inline = vm[2].replace(/^\{|\}$/g, '').trim();
        const src = inline ? splitTopLevel(inline, ',') : v.children.map((c) => c.text);
        for (const e of src) {
          const em = e.match(/^([\w-]+):\s*(.+)$/);
          if (em) entries[em[1]] = em[2].trim();
        }
        workout.variants[vm[1]] = entries;
      }
      continue;
    }

    const node = p.parseNode(line);
    if (node) workout.body.push(node);
  }

  return { workout, errors: p.errors };
}
