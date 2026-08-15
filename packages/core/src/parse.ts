/** Phase 2 of the two-phase parse: line tree -> AST. */

import type {
  Workout, Node, Step, Rest, Block, Interrupt, Score, Target,
} from './ast.ts';
import { readLines, expandInline, splitTopLevel, type Line } from './lines.ts';
import {
  parseQuantity, parseDuration, parseTarget, parseThreshold, expandRuns,
} from './units.ts';
import { wdl } from './grammar/parser.ts';
import { blankStep } from './grammar/step-semantics.ts';

export interface ParseError { line: number; message: string; text: string; }

const SECTIONS = new Set([
  'warmup', 'warm-up', 'strength', 'skill', 'conditioning', 'accessory', 'cooldown', 'cool-down',
]);

class Parser {
  errors: ParseError[] = [];

  // ---------- steps ----------

  /**
   * One step line, read by `spec/grammar-0.1.ohm`.
   *
   * Everything this used to do by hand — splitting on `or`, peeling qualifiers
   * off the end, sweeping `@` out of the line before anything else — is stated
   * in the grammar's `step` rule instead, and what each production contributes
   * is in `grammar/step-semantics.ts`. What is left here is the one thing a
   * grammar over *one line* cannot answer: where the line came from, and what to
   * do when it is not a step at all.
   *
   * `A or B or C` is one step with several ways to do it, and the first is the
   * prescription — it stays in `movement` and `quantity`, so every consumer that
   * does not care about the choice is untouched. That is the grammar's `orTail`
   * now rather than a `splitOr` here.
   */
  parseStep(text: string, line: Line): Step {
    const got = wdl().tryStep(text, line);
    if (got.ok) return got.value;

    // Not a step. Held rather than dropped — the text survives as the movement
    // name, which is what every consumer already does with a name it cannot
    // resolve — and reported, because the alternative is a step that silently
    // means nothing. The one line known to land here is a bare threshold
    // (`until HR > 160bpm` with nothing to do), which the old parser read as a
    // step with an empty movement; see the vocabulary form pinned beside it.
    this.errors.push({ line: line.line, message: `unreadable step "${text}"`, text: line.text });
    const step = blankStep(line);
    step.movement = text.trim();
    return step;
  }

  // ---------- rest ----------

  parseRest(text: string, line: Line): Rest {
    const rest: Rest = { node: 'rest', afterLast: false, comments: line.comments, line: line.line };
    let t = text.replace(/^rest\s*/i, '').trim();

    if (/after\s+last$/i.test(t)) { rest.afterLast = true; t = t.replace(/after\s+last$/i, '').trim(); }
    const threshold = parseThreshold(t);
    if (threshold) { rest.duration = threshold; return rest; }
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
    } else if ((m = head.match(/^(\d+(?:(?:\.\.|-)\d+)+)\s+(m|km|mi|ft|yd|s|min|cal)$/i))) {
      // A scheme may count something other than reps: `1..5..1 min:` is the
      // interval pyramid, `250-500-750 m:` the rowing one.
      block.type = 'ladder';
      block.scheme = m[1].includes('..') ? expandRuns(m[1].split('..').map(Number)) : m[1].split('-').map(Number);
      block.schemeUnit = m[2].toLowerCase();
    } else if (/^\d+(\.\.\d+)+$/.test(head)) {
      // `1..10`, `10..1`, `1..10..1` — a run, expanded. Ten-tier schemes are
      // common enough that spelling every number out is its own error source.
      block.type = 'ladder'; block.scheme = expandRuns(head.split('..').map(Number));
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
    // `choice:` with alternatives under it. Still one step — the athlete does
    // one of them, so it takes one place in the order and counts once — but the
    // block form exists because three options each with their own measure is a
    // mouthful on one line, so the shape is remembered rather than normalised
    // back to the shape it was written to avoid.
    if (/^choice:$/i.test(text)) {
      const opts = line.children
        .map((c) => this.parseStep(c.text.replace(/^-\s*/, ''), c))
        .filter((o) => o.movement);
      if (!opts.length) {
        this.errors.push({ line: line.line, message: '`choice:` with nothing to choose between', text: line.text });
        return undefined;
      }
      const step = opts[0];
      step.options = opts.map((o) => ({
        movement: o.movement,
        quantity: o.quantity.kind === 'open' ? opts[0].quantity : o.quantity,
      }));
      step.optionsForm = 'block';
      step.line = line.line;
      step.comments = line.comments;
      return step;
    }

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
        const kt = k.text.trim();
        if (/^score:/i.test(kt)) { block.score = parseScore(kt); continue; }
        let c = kt.match(/^on\s+cap:\s*(.+)$/i);
        if (c && block.score) { block.score.onCap = c[1].trim(); continue; }
        c = kt.match(/^tiebreak:\s*(.+)$/i);
        if (c && block.score) { block.score.tiebreak = c[1].trim(); continue; }
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

/**
 * `on cap:` and `tiebreak:` qualify the score above them, so one with no score
 * above it qualifies nothing. It used to fall through to the step grammar and
 * become a movement called `tiebreak: time + rounds` — which parsed, validated,
 * and turned up in the cue list as something to do.
 */
const orphan = (line: { line: number; text: string }, key: string): ParseError => ({
  line: line.line,
  text: line.text,
  message: `\`${key}:\` has no \`score:\` above it to qualify — add one, or drop this line`,
});

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
    if (/^score:/i.test(text)) {
      // A second one used to overwrite the first without a word, so a workout
      // scored two ways kept whichever was written last and then failed
      // validation over a score its author had not chosen as the primary.
      if (workout.score) {
        p.errors.push({
          line: line.line, text: line.text,
          message: `already scored by \`${workout.score.primary}\` — a workout has one score; `
            + 'put the other on the block it belongs to, or use `tiebreak:`',
        });
        continue;
      }
      workout.score = parseScore(text);
      continue;
    }
    // `on cap:` and `tiebreak:` are continuations of the score above them.
    let cont = text.match(/^on\s+cap:\s*(.+)$/i);
    if (cont && workout.score) { workout.score.onCap = cont[1].trim(); continue; }
    if (cont) { p.errors.push(orphan(line, 'on cap')); continue; }
    cont = text.match(/^tiebreak:\s*(.+)$/i);
    if (cont && workout.score) { workout.score.tiebreak = cont[1].trim(); continue; }
    if (cont) { p.errors.push(orphan(line, 'tiebreak')); continue; }
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
