/**
 * Goals: the rules a workout is checked against, or generated to satisfy.
 *
 * Goals are deliberately not part of the workout syntax. A workout file says
 * what to do; it should read on a whiteboard and say nothing about why. What
 * you were trying to achieve by writing it is a separate artifact, supplied
 * alongside — the same workout can be good against one intent and bad against
 * another, and burying the intent in the file would make that impossible to say.
 *
 * The file is written in the same indentation-and-colon shape as a workout, and
 * reuses phase 1 of the parser to prove the point: `readLines` knows nothing
 * about workouts, so a second line grammar over the same tree costs almost
 * nothing. Every rule is a header naming its kind and a body of `key: value`.
 *
 *     no repeat:
 *       level: primary
 *       except: forearms, abs
 *
 *     cover:
 *       muscles: glutes, lats, chest
 *       at least: 2 exposures
 *
 * Five rule kinds, chosen because they are the questions worth asking of a
 * single session and a training block: what must not follow what, what must be
 * worked, what must not be overworked, what must stay in proportion, and what
 * must go up over time.
 */

import { readLines, type Line } from './lines.ts';
import type { Timeline } from './timeline.ts';
import {
  muscles, exposures, within, muscleLoad,
  type AttributionOptions, type Exposure,
} from './muscles.ts';
import type { MovementVolume } from './volume.ts';

// --- the rules -----------------------------------------------------------

/**
 * What a rule counts. `movements` is how many steps in the written order touch
 * the muscle; `exposures` is the same thing with rounds multiplied in. "Don't
 * put more than three shoulder movements in a session" and "don't do more than
 * sixty shoulder efforts" are different rules, and only one of them changes when
 * you add a round.
 */
export type Dimension = 'movements' | 'exposures' | 'reps' | 'seconds' | 'metres' | 'calories';

/**
 * What a rule is asked of. A floor on pushing volume is usually a statement
 * about a training block — "don't let the push drop while ramping the pull" —
 * and asked of every session it fires on leg day, which was never going to have
 * any pushing in it.
 */
export type Scope = 'session' | 'block';

/** A named amount in one dimension: `2 exposures`, `50 reps`, `+5%`. */
export interface Amount {
  value: number;
  dimension: Dimension;
  /** True when the value is a proportion of what came before, not an absolute. */
  relative: boolean;
}

export interface NoRepeatRule {
  kind: 'no repeat';
  /** Which muscles count: the movers only, or the assisters too. */
  level: 'primary' | 'any';
  /** How many other exposures must separate two uses of the same muscle. */
  gap: number;
  /** Muscles that are worked by nearly everything and would make the rule unsatisfiable. */
  except: string[];
  line: number;
}

/** A named set of muscles: one muscle, or a whole region taken together. */
export interface Group {
  name: string;
  muscles: string[];
}

export interface CoverRule {
  kind: 'cover' | 'limit';
  /**
   * Checked one group at a time. `muscles: a, b` makes each its own group, so
   * the bound applies to each; `regions: upper` makes one group of the whole
   * region, so the bound applies to the region's total. That is what each
   * phrasing reads as, and conflating them made "cover the upper body" demand
   * that the neck be worked.
   */
  targets: Group[];
  bound: Amount;
  level: 'primary' | 'any';
  scope: Scope;
  line: number;
}

export interface BalanceRule {
  kind: 'balance';
  /** Two or more groups — muscles or regions — held in proportion to each other. */
  between: Group[];
  /** The smallest group must be at least (1 - tolerance) of the largest. */
  tolerance: number;
  measure: Dimension;
  level: 'primary' | 'any';
  scope: Scope;
  line: number;
}

export interface ProgressRule {
  kind: 'progress';
  targets: Group[];
  /** The increase required from each workout in the series to the next. */
  bound: Amount;
  measure: Dimension;
  level: 'primary' | 'any';
  line: number;
}

export type Rule = NoRepeatRule | CoverRule | BalanceRule | ProgressRule;

export interface Goals {
  title?: string;
  rules: Rule[];
  errors: { line: number; message: string }[];
}

// --- parsing -------------------------------------------------------------

const listOf = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

/** Expand region names to their muscles; pass muscle ids through unchanged. */
function resolveTargets(names: string[]): { ok: string[]; unknown: string[] } {
  const known = muscles();
  const ok: string[] = [], unknown: string[] = [];
  for (const raw of names) {
    const n = raw.toLowerCase();
    if (known.has(n)) { ok.push(n); continue; }
    const inRegion = [...known.values()].filter((m) => m.region === n);
    if (inRegion.length) ok.push(...inRegion.map((m) => m.id));
    else unknown.push(raw);
  }
  return { ok: [...new Set(ok)], unknown };
}

/**
 * Reading a `measure:` line, and **refusing to substitute one**.
 *
 * `DIMENSIONS[written] ?? fallback` was the shape until 2026-08-19, and it made
 * every unrecognized spelling silently become the default: `measure: load`
 * parsed with no error and produced a *rep* check, so a rule asking to ramp
 * weight quietly asked to ramp repetitions instead. A typo did the same —
 * `measure: repss` was a rep check — and so did a dimension the language simply
 * does not have.
 *
 * A missing line still takes the default, because that is the author declining
 * to choose. A line that is *present and unread* is reported by name, and the
 * rule is dropped rather than run against something else: a goal report is
 * checked against a training block, and a rule that answers a question nobody
 * asked is worse than a rule that is missing.
 */
function readMeasure(
  written: string | undefined, fallback: Dimension, head: string, line: number,
  fail: (line: number, message: string) => void,
): Dimension | undefined {
  if (written === undefined) return fallback;
  const known = DIMENSIONS[written];
  if (known) return known;
  fail(line, `${head}: \`${written}\` is not something this measures — `
    + `use ${[...new Set(Object.values(DIMENSIONS))].join(', ')}`);
  return undefined;
}

const DIMENSIONS: Record<string, Dimension> = {
  movement: 'movements', movements: 'movements',
  exposure: 'exposures', exposures: 'exposures', rep: 'reps', reps: 'reps',
  second: 'seconds', seconds: 'seconds', sec: 'seconds', s: 'seconds',
  metre: 'metres', metres: 'metres', meter: 'metres', meters: 'metres', m: 'metres',
  calorie: 'calories', calories: 'calories', cal: 'calories', cals: 'calories',
};

/** `2 exposures`, `50 reps`, `+5%`, `25%`. */
function parseAmount(text: string, fallback: Dimension): Amount | undefined {
  const pct = text.match(/^([+-]?\d+(?:\.\d+)?)\s*%$/);
  if (pct) return { value: Number(pct[1]) / 100, dimension: fallback, relative: true };
  const m = text.match(/^([+-]?\d+(?:\.\d+)?)\s*([a-z]*)$/i);
  if (!m) return undefined;
  const dim = m[2] ? DIMENSIONS[m[2].toLowerCase()] : fallback;
  if (!dim) return undefined;
  return { value: Number(m[1]), dimension: dim, relative: false };
}

const KEYS = (body: Line[]) => {
  const out = new Map<string, { value: string; line: number }>();
  for (const l of body) {
    const i = l.text.indexOf(':');
    if (i === -1) continue;
    out.set(l.text.slice(0, i).trim().toLowerCase(), { value: l.text.slice(i + 1).trim(), line: l.line });
  }
  return out;
};

export function parseGoals(source: string): Goals {
  const goals: Goals = { rules: [], errors: [] };
  const fail = (line: number, message: string) => { goals.errors.push({ line, message }); };

  for (const node of readLines(source)) {
    if (!node.text) continue;
    const colon = node.text.indexOf(':');
    const head = (colon === -1 ? node.text : node.text.slice(0, colon)).trim().toLowerCase();
    const inline = colon === -1 ? '' : node.text.slice(colon + 1).trim();
    const k = KEYS(node.children);
    const groupsOf = (names: string[], line: number): Group[] => names.map((name) => {
      const { ok, unknown } = resolveTargets([name]);
      if (unknown.length) fail(line, `unknown muscle or region: ${unknown.join(', ')}`);
      return { name, muscles: ok };
    }).filter((g) => g.muscles.length);
    const level = (k.get('level')?.value === 'any' ? 'any' : 'primary') as 'primary' | 'any';
    const scope: Scope = k.get('per')?.value === 'block' ? 'block' : 'session';
    if (k.get('per') && !['session', 'block'].includes(k.get('per')!.value)) {
      fail(node.line, `per: expected "session" or "block", got "${k.get('per')!.value}"`);
    }

    // Each name becomes its own group, so a muscle is checked alone and a region
    // is checked as a whole.
    const targetsFrom = (): Group[] | undefined => {
      const raw = k.get('muscles')?.value ?? k.get('regions')?.value ?? k.get('muscle')?.value;
      if (!raw) { fail(node.line, `${head}: needs a \`muscles:\` or \`regions:\` line`); return undefined; }
      const groups = groupsOf(listOf(raw), node.line);
      return groups.length ? groups : undefined;
    };

    switch (head) {
      case 'goals':
        goals.title = inline || undefined;
        // A `goals:` header may carry the rules as its children, or they may sit
        // at the top level. Both read naturally, so both are accepted.
        for (const child of node.children) {
          if (child.text.includes(':')) {
            goals.rules.push(...parseGoals(renderSubtree(child)).rules);
          }
        }
        break;

      case 'no repeat': {
        const gapText = k.get('gap')?.value;
        const gap = gapText === undefined ? 1 : Number(gapText);
        if (!Number.isFinite(gap) || gap < 1) { fail(node.line, `no repeat: gap must be a positive whole number, got "${gapText}"`); break; }
        const { ok, unknown } = resolveTargets(listOf(k.get('except')?.value ?? ''));
        if (unknown.length) fail(node.line, `unknown muscle or region: ${unknown.join(', ')}`);
        goals.rules.push({ kind: 'no repeat', level, gap, except: ok, line: node.line });
        break;
      }

      case 'cover':
      case 'limit': {
        const targets = targetsFrom();
        if (!targets) break;
        const key = head === 'cover' ? 'at least' : 'at most';
        const text = k.get(key)?.value;
        if (!text) { fail(node.line, `${head}: needs an \`${key}:\` line`); break; }
        const bound = parseAmount(text, 'exposures');
        if (!bound || bound.relative) { fail(node.line, `${head}: cannot read "${text}" as an amount`); break; }
        goals.rules.push({ kind: head, targets, bound, level, scope, line: node.line });
        break;
      }

      case 'balance': {
        const raw = k.get('between')?.value;
        if (!raw) { fail(node.line, 'balance: needs a `between:` line'); break; }
        const groups = groupsOf(listOf(raw), node.line);
        if (groups.length < 2) { fail(node.line, 'balance: needs at least two groups to compare'); break; }
        const within = parseAmount(k.get('within')?.value ?? '25%', 'exposures');
        if (!within?.relative) { fail(node.line, 'balance: `within:` must be a percentage'); break; }
        const measure = readMeasure(k.get('measure')?.value, 'exposures', 'balance', node.line, fail);
        if (!measure) break;
        goals.rules.push({ kind: 'balance', between: groups, tolerance: within.value, measure, level, scope, line: node.line });
        break;
      }

      case 'progress': {
        const targets = targetsFrom();
        if (!targets) break;
        const text = k.get('at least')?.value;
        if (!text) { fail(node.line, 'progress: needs an `at least:` line'); break; }
        const measure = readMeasure(k.get('measure')?.value, 'reps', 'progress', node.line, fail);
        if (!measure) break;
        const bound = parseAmount(text, measure);
        if (!bound) { fail(node.line, `progress: cannot read "${text}" as an amount`); break; }
        goals.rules.push({ kind: 'progress', targets, bound, measure, level, line: node.line });
        break;
      }

      default:
        fail(node.line, `unknown rule "${head}"`);
    }
  }
  return goals;
}

/** Re-render a subtree as text, so a nested rule can be parsed by the same code. */
function renderSubtree(node: Line, depth = 0): string {
  const pad = '  '.repeat(depth);
  return [`${pad}${node.text}`, ...node.children.map((c) => renderSubtree(c, depth + 1))].join('\n');
}

// --- checking ------------------------------------------------------------

export interface Finding {
  rule: Rule['kind'];
  /** Source line of the rule that produced it. */
  line: number;
  message: string;
  /**
   * How many times the same thing was found. A ten-tier ladder repeats its
   * structure ten times, and reporting one structural fault ten times buries
   * the other nine faults. The fact is stated once, with its count.
   */
  count: number;
  /** Exposure indices implicated, where the rule is about a position. */
  where?: number[];
}

export interface CheckReport {
  findings: Finding[];
  /** Movements no source could attribute. Every rule below is blind to these. */
  unresolved: string[];
  /** True when some part has no fixed amount, so any amount-based rule is judging a floor. */
  unbounded: boolean;
}

const DIMENSION_OF = (v: MovementVolume, d: Dimension): number =>
  d === 'reps' ? v.reps : d === 'seconds' ? v.seconds
  : d === 'metres' ? v.distanceM : d === 'calories' ? v.calories : 0;

/**
 * How much a set of muscles received, in one dimension.
 *
 * Counted over the steps that touch the group, once each — not summed over the
 * group's muscles. A 400m run works four muscles below the waist; the lower
 * body ran 400 metres, not 1600. Whether the group is one muscle or a whole
 * region, the question is the same: how much of the workout landed on it.
 */
function amountFor(
  exp: Exposure[], targets: string[], d: Dimension, level: 'primary' | 'any',
): number {
  const want = new Set(targets);
  const hits = exp.filter((e) => {
    const worked = level === 'any' ? [...e.primary, ...e.secondary] : e.primary;
    return worked.some((m) => want.has(m));
  });
  if (d === 'movements') return hits.length;
  if (d === 'exposures') return hits.reduce((n, e) => n + e.rounds, 0);
  return hits.reduce((n, e) => n + DIMENSION_OF(e.volume, d) * e.rounds, 0);
}

const list = (xs: string[]) => xs.join(', ');

/** Check one workout against the rules that apply to a single session. */
export function check(t: Timeline, goals: Goals, opts: AttributionOptions = {}): CheckReport {
  const { list: exp, unresolved } = exposures(t, opts);
  return {
    ...checkExposures(exp, goals, muscleLoad(t, opts).unbounded, 'session'),
    unresolved,
  };
}

/**
 * The rules, evaluated over an exposure list rather than a workout.
 *
 * Everything a session rule needs is in the list: what each step works, how
 * much of it, how many rounds, and what may follow what. Nothing re-reads the
 * timeline. That is what lets the generator try a thousand candidate workouts
 * without compiling a thousand workouts — the structure is fixed by the
 * template, and only the muscles change.
 */
export function checkExposures(
  exp: Exposure[], goals: Goals, unbounded = false, scope: Scope = 'session',
): Omit<CheckReport, 'unresolved'> {
  const found = new Map<string, Finding>();
  const findings = {
    push(f: Omit<Finding, 'count'>) {
      const key = `${f.rule}|${f.line}|${f.message}`;
      const seen = found.get(key);
      if (seen) { seen.count++; if (f.where) seen.where!.push(...f.where); return; }
      found.set(key, { ...f, count: 1, where: f.where ? [...f.where] : undefined });
    },
  };

  const worked = (e: Exposure, level: 'primary' | 'any') =>
    level === 'any' ? [...e.primary, ...e.secondary] : e.primary;

  for (const rule of goals.rules) {
    // `no repeat` is about order, which only exists within a session. Everything
    // else states which it is asked of, and is skipped by the other pass.
    if (rule.kind === 'no repeat' ? scope !== 'session' : rule.kind !== 'progress' && rule.scope !== scope) continue;
    switch (rule.kind) {
      case 'no repeat': {
        const skip = new Set(rule.except);
        for (const [a, b] of within(exp, rule.gap)) {
          const shared = worked(a, rule.level).filter((m) => worked(b, rule.level).includes(m) && !skip.has(m));
          if (!shared.length) continue;
          findings.push({
            rule: rule.kind, line: rule.line, where: [a.index, b.index],
            message: rule.gap === 1
              ? `${a.movement} is followed by ${b.movement}; both work ${list(shared)}`
              : `${a.movement} and ${b.movement} are within ${rule.gap} of each other and both work ${list(shared)}`,
          });
        }
        break;
      }

      case 'cover':
      case 'limit': {
        for (const g of rule.targets) {
          const got = amountFor(exp, g.muscles, rule.bound.dimension, rule.level);
          const under = rule.kind === 'cover' && got < rule.bound.value;
          const over = rule.kind === 'limit' && got > rule.bound.value;
          if (under || over) {
            findings.push({
              rule: rule.kind, line: rule.line,
              message: `${g.name}: ${got} ${rule.bound.dimension}, ${rule.kind === 'cover' ? 'at least' : 'at most'} ${rule.bound.value} required`,
            });
          }
        }
        break;
      }

      case 'balance': {
        const got = rule.between.map((g) => ({ ...g, amount: amountFor(exp, g.muscles, rule.measure, rule.level) }));
        const high = Math.max(...got.map((g) => g.amount));
        const low = Math.min(...got.map((g) => g.amount));
        if (high === 0) break;   // nothing worked at all; `cover` is the rule for that
        if (low < high * (1 - rule.tolerance)) {
          findings.push({
            rule: rule.kind, line: rule.line,
            message: `${got.map((g) => `${g.name} ${g.amount}`).join(' vs ')} ${rule.measure}`
              + ` — a spread of ${Math.round((1 - low / high) * 100)}%, over the ${Math.round(rule.tolerance * 100)}% allowed`,
          });
        }
        break;
      }

      case 'progress':
        // Meaningless against one workout; checkSeries handles it.
        break;
    }
  }

  return { findings: [...found.values()], unbounded };
}

/** One workout in a series, and which recurring session it is an instance of. */
export interface SeriesEntry {
  name: string;
  timeline: Timeline;
  /**
   * Sessions with the same slot are compared to each other and to nothing else.
   * Without it, "ramp the pulling volume" compares this week's pull session to
   * this week's leg session, notices the pulling went down, and is wrong — the
   * leg session was never supposed to have any pulling in it.
   *
   * Omitted, every workout shares one slot, which is right for a series that is
   * genuinely one session repeated.
   */
  slot?: string;
}

/** One workout's exposures, for a series checked without recompiling anything. */
export interface SeriesExposures {
  name: string;
  slot?: string;
  exp: Exposure[];
  unbounded?: boolean;
}

/**
 * Check a series in order. `progress` rules live here — "ramp the pulling
 * volume" is a statement about a training block, and no single file can be
 * checked against it. Block-scoped rules read the whole series at once. Every
 * other rule is asked of each workout in turn.
 */
export function checkSeriesExposures(
  series: SeriesExposures[], goals: Goals,
): { perWorkout: { name: string; report: Omit<CheckReport, 'unresolved'> }[]; findings: Finding[] } {
  const perWorkout = series.map((s) => ({
    name: s.name,
    report: checkExposures(s.exp, goals, s.unbounded ?? false, 'session'),
  }));

  // Block-scoped rules read the whole series at once. Indices are renumbered so
  // nothing downstream mistakes two sessions' exposures for one.
  const whole = series.flatMap((s) => s.exp).map((e, i) => ({ ...e, index: i }));
  const findings: Finding[] = checkExposures(
    whole, goals, series.some((s) => s.unbounded), 'block',
  ).findings;

  // Positions grouped by slot, keeping the order they were given in.
  const slots = new Map<string, number[]>();
  series.forEach((s, i) => {
    const key = s.slot ?? '';
    (slots.get(key) ?? slots.set(key, []).get(key)!).push(i);
  });

  for (const rule of goals.rules) {
    if (rule.kind !== 'progress') continue;
    for (const g of rule.targets) {
      const amounts = series.map((s) => amountFor(s.exp, g.muscles, rule.measure, rule.level));
      for (const [slot, positions] of slots) {
        for (let n = 1; n < positions.length; n++) {
          const [a, b] = [positions[n - 1], positions[n]];
          const prev = amounts[a], now = amounts[b];
          const need = rule.bound.relative ? prev * (1 + rule.bound.value) : prev + rule.bound.value;
          if (now >= need) continue;
          findings.push({
            rule: rule.kind, line: rule.line, count: 1,
            message: `${g.name}${slot ? ` (${slot})` : ''}: ${series[a].name} ${prev} \u2192 ${series[b].name} ${now} ${rule.measure};`
              + ` ${rule.bound.relative ? `${Math.round(rule.bound.value * 100)}% more` : `${rule.bound.value} more`} required (${Math.round(need)})`,
          });
        }
      }
    }
  }
  return { perWorkout, findings };
}

/** The same, from compiled workouts. */
export function checkSeries(
  series: SeriesEntry[], goals: Goals, opts: AttributionOptions = {},
): { perWorkout: { name: string; report: CheckReport }[]; findings: Finding[] } {
  const each = series.map((s) => {
    const { list, unresolved } = exposures(s.timeline, opts);
    return { name: s.name, slot: s.slot, exp: list, unresolved, unbounded: muscleLoad(s.timeline, opts).unbounded };
  });
  const r = checkSeriesExposures(each, goals);
  return {
    perWorkout: r.perWorkout.map((w, i) => ({ name: w.name, report: { ...w.report, unresolved: each[i].unresolved } })),
    findings: r.findings,
  };
}

