/**
 * Divisions: one namespace, one resolver, two spellings (spec §10).
 *
 * A workout can prescribe different work to different athletes in two places,
 * and until 2026-08-18 they were two mechanisms that shared nothing:
 *
 *   - a **step-level rx split** — `30 Clean & Jerk (women 105lb / men 145lb)`,
 *     parsed into `Step.rx` and read by nothing but the formatter;
 *   - a **workout-level `variants:` table** — movement-keyed overrides, parsed
 *     into `Workout.variants` and read by nothing at all.
 *
 * This module is the one place that answers *which divisions does this workout
 * offer* and *what does it say for division X*, so an exporter, a CLI flag and
 * an app all ask one question instead of three.
 *
 * **The lowering is into the resolver, not into the table**, and that is a
 * deliberate departure from how the queue item was written ("`rx` should
 * desugar into `variants:`"). Rewriting a split into movement-keyed entries is
 * the literal reading, and it loses information: a `variants:` entry is keyed by
 * *movement*, so a workout with two Thruster steps at different splits collapses
 * to whichever was written last. An rx split belongs to the **step** it was
 * written on. So the split stays where it was parsed, the table stays as it was
 * authored, and both are read through `resolve()` — which is what "exporters
 * need know about only one" actually asks for.
 *
 * **Nothing is resolved unless something asks.** With no division chosen — the
 * state both apps are permanently in — a step keeps its split and reads as what
 * the whiteboard says; see `formatRx` and the cue in `timeline.ts`.
 */

import type { Workout, Node, Step, Block, Target } from './ast.ts';
import type { Diagnostic } from './validate.ts';
import type { Registry, MovementEntry } from './fold.ts';
import { fold, depluralize } from './fold.ts';
import { defaultRegistry, canonicalRegistry } from './registry.ts';
import { has } from './env.ts';
import { parseTarget } from './units.ts';

export interface ResolveOptions {
  registry?: Registry;
}

export interface Resolved {
  /** The workout as one division reads it. `variants` and the applied splits are gone. */
  workout: Workout;
  diagnostics: Diagnostic[];
}

/**
 * Every division this workout offers, whichever way it was written.
 *
 * Authored names first, in the order the table states them, then any division
 * that only an rx split names, in document order. Order is stable so a picker
 * built from this does not shuffle between renders.
 */
export function divisions(w: Workout): string[] {
  const out: string[] = [];
  const add = (name: string) => { if (!out.includes(name)) out.push(name); };
  for (const name of Object.keys(w.variants ?? {})) add(name);
  walkSteps(w.body, (s) => { for (const name of Object.keys(s.rx ?? {})) add(name); });
  return out;
}

/**
 * The workout as one division reads it.
 *
 * Both mechanisms apply, in that order — an authored `variants:` entry is the
 * more specific statement, so it is applied second and wins over a split on the
 * same step. That ordering matters exactly once, when a workout carries both,
 * and picking it silently is how the surprise gets in.
 *
 * A division that names nothing is an **error** rather than a no-op: asking for
 * `--variant womens` and getting the men's workout back with no complaint is the
 * failure mode worth spending a diagnostic on.
 */
export function resolve(w: Workout, division: string, opts: ResolveOptions = {}): Resolved {
  const diagnostics: Diagnostic[] = [];
  const known = divisions(w);
  if (!known.includes(division)) {
    diagnostics.push({
      severity: 'error', code: 'unknown-division',
      message: known.length
        ? `no division \`${division}\` — this workout offers ${known.map((d) => `\`${d}\``).join(', ')}`
        : `no division \`${division}\` — this workout has no variants and no rx split`,
    });
    return { workout: w, diagnostics };
  }

  // Lazily, and only if there is an authored table to read: a workout whose
  // divisions come only from rx splits needs no registry at all, and the
  // registry accessors throw when the host has not provided one.
  const table = w.variants?.[division];
  const look = table ? lookup(opts.registry) : undefined;

  const body = w.body.map((n) => mapNode(n, (s) => {
    let step = s;

    // The split first, and only for the division being asked for. A step split
    // by sex says nothing about `scaled`, so `scaled` leaves it alone — spec §10
    // calls these independent axes, and this is what that means in code.
    if (step.rx?.[division]) {
      step = withTargets(step, [{ kind: 'load', load: step.rx[division] }]);
      const { rx: _dropped, ...rest } = step;
      step = rest as Step;
    }

    if (table) {
      for (const [movement, value] of Object.entries(table)) {
        if (!sameMovement(movement, step.movement, look)) continue;
        const applied = readValue(value, look);
        if (!applied) {
          diagnostics.push({
            severity: 'note', code: 'variant-value-unread', line: step.line,
            message: `\`${movement}: ${value}\` is not a load, a height, or a movement in the `
              + `registry — the step is unchanged for \`${division}\``,
          });
          continue;
        }
        if (applied.movement) step = { ...step, movement: applied.movement };
        if (applied.targets) step = withTargets(step, applied.targets);
      }
    }
    return step;
  }));

  const { variants: _spent, ...rest } = w;
  return { workout: { ...rest, body } as Workout, diagnostics };
}

/**
 * The registries to consult, in order, for a name.
 *
 * Both, because they answer different questions and a variant needs both
 * answers. The curated registry is what `validate` consults and is the vetted
 * one; the canonical merge is the superset, and it is where `Ring Row` — the
 * movement swap in spec §10's own example — actually lives. Consulting only the
 * curated one made the spec's example unreadable.
 *
 * Either may be absent: nothing under `src/` opens a file, so a host that
 * provided neither gets a lookup that knows nothing rather than a throw.
 */
function lookup(provided?: Registry): (name: string) => MovementEntry | undefined {
  const regs: Registry[] = [];
  if (provided) regs.push(provided);
  else if (has('movements')) regs.push(defaultRegistry());
  if (has('canonicalMovements')) regs.push(canonicalRegistry());
  return (name) => {
    for (const r of regs) {
      const hit = r.resolve(name);
      if (hit.status === 'ok') return hit.entry;
    }
    return undefined;
  };
}

/**
 * Whether a variant key names the movement a step is prescribing.
 *
 * Two answers, and both are needed. The registry's is the good one — it knows
 * `pull-up`, `Pull-Ups` and `C2B` are one movement — but it only speaks for
 * movements it holds, and a variant may legitimately name one it does not. So a
 * folded, depluralized comparison stands behind it.
 *
 * The plural is not a corner case: it is what the one corpus file using
 * `variants:` actually does. `wall-ball: 6kg to 9ft` against a step written
 * `100 Wall Balls` folds to `wallball` against `wallballs`, and a bare `fold`
 * equality missed the whole entry — the women's wall ball silently stayed at the
 * men's 9kg to 10ft. Found 2026-08-18 by resolving that file for the first time.
 */
function sameMovement(a: string, b: string, look?: (n: string) => MovementEntry | undefined): boolean {
  const ea = look?.(a);
  const eb = look?.(b);
  if (ea && eb) return ea.id === eb.id;
  return depluralize(fold(a)) === depluralize(fold(b));
}

/**
 * What one variant field says, when the language can read it.
 *
 * **A target is tried before a movement**, and the order is the decision. Both
 * readings end in prose — `parseTarget` returns `raw` for anything it does not
 * recognize, and a movement name is exactly that — so whichever is asked second
 * is the one that has to prove itself. A target can prove itself from the text
 * alone (`102kg` is a load, `9ft` is a height); a movement cannot, so it is
 * checked against the registry and a value that is neither is **reported and
 * not applied** rather than guessed at. `junk: junk` leaves the step alone and
 * says so; spec §10's `pull-up: Ring Row` swaps the movement.
 */
function readValue(
  value: string,
  look?: (n: string) => MovementEntry | undefined,
): { movement?: string; targets?: Target[] } | null {
  // `9kg to 10ft` is a load plus a target height — the same split the grammar's
  // `toTail` makes on a step line, so the two positions read a value alike.
  const parts = value.split(/\s+to\s+/i).map((t) => parseTarget(t.trim()));
  if (parts.length && parts.every((t) => t.kind !== 'raw')) return { targets: parts };
  const named = look?.(value);
  return named ? { movement: named.title } : null;
}

/** Own targets win by kind, which is what `mergeTargets` means one layer down. */
function withTargets(s: Step, incoming: Target[]): Step {
  const kinds = new Set(incoming.map((t) => t.kind));
  return { ...s, targets: [...s.targets.filter((t) => !kinds.has(t.kind)), ...incoming] };
}

function mapNode(n: Node, f: (s: Step) => Step): Node {
  if (n.node === 'step') return f(n);
  if (n.node === 'block') return { ...n, children: (n as Block).children.map((c) => mapNode(c, f)) };
  return n;
}

function walkSteps(nodes: Node[], f: (s: Step) => void): void {
  for (const n of nodes) {
    if (n.node === 'step') f(n);
    else if (n.node === 'block') walkSteps((n as Block).children, f);
  }
}
