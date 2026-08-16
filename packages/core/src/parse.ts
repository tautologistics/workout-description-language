/** Phase 2 of the two-phase parse: line tree -> AST. */

import type {
  Workout, Node, Step, Rest, Block, Interrupt, Score,
} from './ast.ts';
import { readLines, expandInline, type Line } from './lines.ts';
import { parseDuration } from './units.ts';
import { wdl } from './grammar/parser.ts';
import { blankStep } from './grammar/step-semantics.ts';

export interface ParseError { line: number; message: string; text: string; }

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

  /**
   * One `rest …` line, read by the grammar's `restLine` rule.
   *
   * Unlike a step or a header this line carries its own keyword, so the rule
   * selects the lines it applies to rather than being pointed at them — the
   * dispatch above still keys on `rest` because phase 1 hands over lines and
   * something has to choose, but the reading is one rule.
   *
   * A rest is bounded five ways — a clock, the athlete, the work before it, a
   * sensor reading, or work of its own — and the failure below is the sixth
   * case: a bound written in a spelling the language does not accept there. The
   * spelled-out duration words (`rest 45 seconds`) are the known one, and they
   * are a debt rather than a swap casualty: neither implementation read them
   * before this change either.
   */
  parseRest(text: string, line: Line): Rest {
    const got = wdl().tryRest(text, line);
    if (got.ok) return got.value;

    const rest: Rest = { node: 'rest', afterLast: false, comments: line.comments, line: line.line };
    let t = text.replace(/^rest\s*/i, '').trim();
    // `after last` is a fact about *which* rest, not about its bound, so it is
    // read even when the bound is not — otherwise an unreadable duration would
    // quietly cost the "only after the last round" as well.
    if (/after\s+last$/i.test(t)) { rest.afterLast = true; t = t.replace(/after\s+last$/i, '').trim(); }
    if (t) {
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

  /**
   * One block header, read by the grammar's `blockHeader` rule.
   *
   * The `:` is stripped before the match and never reaches the grammar. That is
   * the same division of labour phase 1 has, and it is what lets `21-15-9` be a
   * rep scheme here and `8-12` a rep range in a step without any rule having to
   * tell the two shapes apart: which start rule the caller picks *is* the answer.
   *
   * An unrecognized header is held as a named sequence — every child and every
   * modifier kept — which is the grammar's `headerKind_unknown`. Reporting it is
   * this side's job: an error is not part of the AST, and a header nobody taught
   * the language is worth saying out loud even though nothing is lost.
   */
  parseHeader(headRaw: string, line: Line): Block {
    const head = headRaw.replace(/:\s*$/, '');
    const got = wdl().tryHeader(head, line);
    if (!got.ok) {
      this.errors.push({ line: line.line, message: `unreadable block header "${head}"`, text: line.text });
      const block = this.blank(line, 'sequence');
      block.name = head.trim();
      return block;
    }
    const block = got.value;
    // A named sequence is what the grammar makes of a head it has no kind for;
    // `sequence:` itself sets no name, and a section sets `type: 'section'`.
    if (block.type === 'sequence' && block.name) {
      this.errors.push({
        line: line.line, message: `unrecognized block header "${block.name}"`, text: line.text,
      });
    }
    return block;
  }

  // ---------- dispatch ----------

  parseNode(line: Line): Node | null {
    const { head, inline, tail } = expandInline(line);
    const kids = inline ? [...inline, ...line.children] : line.children;
    const raw = head.trim();
    if (!raw) return null;

    // Spec §2 states two rules that `- AMRAP 3min:` satisfies at once — a line
    // beginning `- ` is a step, a line ending in `:` opens a block — and never
    // said which wins. **The colon does**, stated 2026-08-15: a step never ends
    // in one, so the colon is the more specific signal, and phase 1 has already
    // given this line children on the strength of it. Read as a step it became a
    // movement named `AMRAP 3min:` and everything under it was dropped in
    // silence. The dash is decoration on a nested block, as it is on a step.
    const text = raw.endsWith(':') ? raw.replace(/^-\s+/, '') : raw;

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
      if (line.adopted) block.adopted = true;
      for (const k of kids) {
        // A `score:` nested inside a block belongs to that block; at the top
        // level it belongs to the workout. One rule, no ambiguity with siblings.
        const kt = k.text.trim();
        const score = readScore(kt);
        if (score) {
          block.score = score;
          nestedScoreFields(k.children, this.errors);
          continue;
        }
        // Which score an `on cap:` qualifies is a question about several lines,
        // so the grammar reads the line and the answer is here: the one above it.
        // With no score above it the line is not a qualifier at all and falls
        // through to the step grammar, which is what it did before.
        const q = wdl().tryQualifier(kt);
        if (q.ok && block.score) { block.score[q.value.key] = q.value.text; continue; }
        const n = this.parseNode(k);
        if (n) block.children.push(n);
      }
      const tailScore = tail ? readScore(tail) : null;
      if (tailScore) block.score = tailScore;
      return block;
    }

    // bare step (inline-expanded bodies, and single-step workouts)
    return this.parseStep(text, line);
  }
}

/**
 * A `score:` line, if this is one.
 *
 * The grammar's `scoreLine` carries its own keyword, so it selects the lines it
 * applies to and this returns `null` for everything else — which is why the
 * callers below ask it rather than testing a regex first and then reading.
 */
function readScore(text: string): Score | null {
  const got = wdl().tryScore(text);
  return got.ok ? got.value : null;
}

/**
 * A `score:` line has no children, and a line indented under one is reported.
 *
 * **The nested block form is not part of WDL 0.1**, decided 2026-08-15 — spec
 * §9.5 and §9.6 illustrated it for a while and the prose was corrected, not the
 * parser. A compound score has two spellings, sibling lines and inline braces,
 * and they cover the two cases that exist: a few lines, or one line. An indented
 * key-and-value block under `score:` is a third spelling of the same three
 * fields, and it is the one you would not write on a whiteboard — the same
 * objection that made a canonical output with braces around a compound score a
 * *bug* rather than a formatting choice.
 *
 * What is *not* acceptable either way is the old behaviour: the children were
 * never looked at, so `primary: time` and `on cap: reps` vanished without a word
 * while `wdl check` said ok. A form the language declines is still a form
 * somebody wrote, so it is named and the spelling to use is named with it.
 */
function nestedScoreFields(children: Line[], errors: ParseError[]): void {
  for (const c of children) {
    errors.push({
      line: c.line,
      text: c.text,
      message: `\`${c.text.trim()}\` is indented under \`score:\` — a score's fields are `
        + 'sibling lines (`score: time`, then `on cap: reps`) or inline braces '
        + '(`score: {primary: time, on cap: reps}`), never a nested block',
    });
  }
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

/**
 * Take a `score:` / `on cap:` / `tiebreak:` line that was never indented back out
 * to the top level, in source order.
 *
 * Adoption (spec §2) moves *work* into the block it was written flat under, which
 * is what the rule is for. A score is not work — it is a statement about the
 * thing as a whole, and in a flat file the only whole that can be reached is the
 * workout. **Absorbing one does damage rather than merely misplacing it**:
 * `for time:` is stored as a sequence carrying an *implied* `time` score, so a
 * `score: rounds` landing on it overwrites the header's own kind and the block
 * comes back out as `sequence:`. Indent a score to put it on a block.
 *
 * *Corrected 2026-08-15, the day the adoption rule landed. It first accepted
 * absorption for every kind of line, which measured harmless on a one-block
 * AMRAP; a real workout with a `for time:` buy-in and a trailing `score:` showed
 * what it costs. Found by typing it into the builder, not by the suite.*
 */
function liftScores(roots: Line[]): Line[] {
  const lifted: Line[] = [];
  const walk = (nodes: Line[]) => {
    for (const n of nodes) {
      const kept = n.children.filter((c) => {
        const t = c.text.trim();
        if (!c.adopted || !(readScore(t) || wdl().tryQualifier(t).ok)) return true;
        lifted.push(c);
        return false;
      });
      n.children = kept;
      walk(kept);
    }
  };
  walk(roots);
  return lifted;
}

export function parse(source: string): { workout: Workout; errors: ParseError[] } {
  const p = new Parser();
  const workout: Workout = { node: 'workout', directives: {}, body: [], comments: [] };
  const tree = readLines(source);
  const roots = [...tree, ...liftScores(tree)];

  for (const line of roots) {
    const text = line.text.trim();

    if (!text) { workout.comments.push(...line.comments); continue; }

    // `@id`, `# Fran` — each carries its own marker, so like the score line the
    // grammar's rules select the lines they apply to and there is nothing to
    // test for first.
    const dm = wdl().tryDirective(text);
    if (dm.ok) { workout.directives[dm.value.key] = dm.value.value; continue; }
    const title = wdl().tryTitle(text);
    if (title.ok) { workout.title = title.value; continue; }
    const score = readScore(text);
    if (score) {
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
      workout.score = score;
      nestedScoreFields(line.children, p.errors);
      continue;
    }
    // `on cap:` and `tiebreak:` are continuations of the score above them.
    const cont = wdl().tryQualifier(text);
    if (cont.ok) {
      if (workout.score) { workout.score[cont.value.key] = cont.value.text; continue; }
      p.errors.push(orphan(line, cont.value.key === 'onCap' ? 'on cap' : 'tiebreak'));
      continue;
    }
    // `variants:` opens a table. *Which* variant a field belongs to is a
    // question about several lines, so the grammar reads `women:` and
    // `load: 65lb` and this puts one inside the other — the same division that
    // leaves `on cap:` attaching to its score up here.
    if (/^variants:$/i.test(text)) {
      workout.variants = {};
      for (const v of line.children) {
        const vt = v.text.trim();
        const variant = wdl().tryVariant(vt);
        if (!variant.ok) {
          p.errors.push({ line: v.line, message: `unreadable variant "${vt}"`, text: v.text });
          continue;
        }
        // Inline braces, or a field per indented line. Two spellings because one
        // variant with one field is a line where three with three is a table.
        const fields = variant.value.fields
          ?? v.children.flatMap((c) => {
            const f = wdl().tryField(c.text.trim());
            if (f.ok) return [f.value];
            p.errors.push({ line: c.line, message: `unreadable variant field "${c.text.trim()}"`, text: c.text });
            return [];
          });
        const entries: Record<string, string> = {};
        for (const f of fields) entries[f.key] = f.value;
        workout.variants[variant.value.name] = entries;
      }
      continue;
    }

    const node = p.parseNode(line);
    if (node) workout.body.push(node);
  }

  return { workout, errors: p.errors };
}
