/** WDL abstract syntax tree. This is the semantic contract (roadmap §5). */

export type Unit =
  | { kind: 'reps'; value: number }
  | { kind: 'distance'; value: number; unit: 'm' | 'km' | 'mi' | 'ft' | 'yd' }
  | { kind: 'calories'; value: number }
  | { kind: 'duration'; seconds: number }
  | { kind: 'max' }                                   // remainder of enclosing clock
  | { kind: 'floor'; value: number }                  // `5+` — at least N, then open
  | { kind: 'range'; min: number; max: number }       // `8-12` — a rep range
  | { kind: 'maxEffort' }                             // `max` with no clock — to failure
  /**
   * Ends when a sensor reading crosses a bound — `until HR < 130bpm`. Neither
   * the clock nor the athlete decides; the device does. Both FIT and Garmin
   * Connect have carried this all along (`hr_less_than`, `heart.rate` with a
   * comparison), and recovery intervals are written this way constantly.
   */
  | {
      kind: 'threshold';
      metric: 'hr' | 'power';
      compare: 'lt' | 'gt';
      /** An absolute reading — 130bpm, 250W. */
      value?: number;
      unit?: string;
      /** Or a zone, which Connect stores in its own `endConditionZone` field. */
      zone?: number;
    }
  | { kind: 'open' };

export type Load =
  | { kind: 'absolute'; value: number; unit: 'lb' | 'kg'; implements?: number }
  | { kind: 'percent'; value: number; of?: string }    // 75%, 85% TM, 95% FTP
  | { kind: 'multiple'; value: number; of: string }    // 1.5x BW
  | { kind: 'reference'; name: string };               // 85% of heavy-single

export type Target =
  | { kind: 'load'; load: Load }
  | { kind: 'height'; value: number; unit: string }
  | { kind: 'pace'; text: string }
  | { kind: 'power'; text: string }
  | { kind: 'heartRate'; text: string }
  | { kind: 'effort'; text: string }
  | { kind: 'raw'; text: string };

/** How a step's reps are distributed across two limbs (registry §6). */
export type Laterality = 'both' | 'split' | 'per-side';

/** One of several things the athlete may pick between for a single step. */
export interface StepOption {
  movement: string;
  quantity: Unit;
}

export interface Step {
  node: 'step';
  movement: string;
  quantity: Unit;
  /**
   * Alternatives, when the step was written as `A or B`. The first is the
   * prescription and is duplicated in `movement`/`quantity` above, so anything
   * that does not care about the choice keeps working unchanged.
   *
   * Two shapes, both common on a whiteboard: one measure across several
   * machines — `1min Bike or Row or SkiErg` — and a different measure for each,
   * which is how a run becomes a machine when it rains: `800m Run or 25cal Bike
   * or 20cal Row`.
   */
  options?: StepOption[];
  /**
   * Which shape they were written in. Inline stays inline and a `choice:` block
   * stays a block: the block form exists because three options each with their
   * own measure is a mouthful on one line, and rewriting it back to one line
   * would undo the reason it was chosen.
   */
  optionsForm?: 'inline' | 'block';
  /**
   * What each division is prescribed, written `(women 105lb / men 145lb)` or,
   * minimally, `(105/145)`.
   *
   * Unlabelled, the *larger* number is the men's — not the first one. Position
   * is the usual convention and it is not safe: whiteboards write `95/65`
   * meaning men first, so reading position would put the heavier bar on the
   * lighter athlete for anyone who writes it the other way round. Magnitude
   * cannot be written backwards.
   */
  rx?: Record<string, Load>;
  targets: Target[];
  /** Measured output for scoring, distinct from what ends the step (spec §4, N6). */
  measures?: 'reps' | 'calories' | 'distance';
  laterality?: Laterality;
  side?: 'first' | 'second' | 'left' | 'right';
  /** The limb noun the author used, preserved for display: arm, leg, side, hand. */
  limb?: string;
  tempo?: string;
  /** Repeat this exact step N times — `3 Bench Press @ 80% 1RM x5`.
   *  Percentage waves are written this way everywhere strength work is
   *  programmed, and spelling out five identical lines is how errors get in. */
  sets?: number;
  /** Per-round delta, e.g. `+3 each round` (spec §8.1). */
  perRound?: { delta: number; unit: string };
  team?: 'shared' | 'each' | 'synchronized';
  flags: string[];                                     // unbroken, building, tiebreak…
  notes: string[];
  /**
   * Text the language does not read, held verbatim and meaning nothing.
   *
   * **Unknown is a first-class state — not an error and not a guess.** A
   * modifier the grammar has no rule for is kept here, survives a round trip,
   * and is deliberately absent from everything that derives meaning: it never
   * reaches the timeline, so no cue, no export and no analysis can act on it.
   * It is *reported*, informationally, by `validate` — held-and-inert is not the
   * same as silent, and `10 Thruster, unbrokn` should say something.
   *
   * Kept apart from `notes` because that array is *rendered*: an authored
   * `note: "…"` is written for the athlete, and a token the parser could not
   * read is not. Until 2026-08-15 both landed in `notes`, so an unknown token
   * silently acquired the meaning "the author wrote a note" — and a bare
   * `warmup` in it turned into a warmup segment in a Garmin export.
   */
  unknown?: string[];
  comments: string[];
  line: number;
}

export interface Rest {
  node: 'rest';
  duration?: Unit;
  dynamic?: 'as-needed' | 'equal-to-work';
  /** Active recovery — `rest 400m Jog`. The interval is work, not a clock. */
  active?: { quantity: Unit; movement: string };
  afterLast: boolean;                                  // spec §5.2, N1
  comments: string[];
  line: number;
}

/** Kalsu's shape: a periodic interruption of the surrounding work (spec §5.8). */
export interface Interrupt {
  node: 'interrupt';
  every: Unit;
  body: Node[];
  comments: string[];
  line: number;
}

export type BlockType =
  | 'sequence' | 'repeat' | 'ladder' | 'amrap' | 'clock'
  | 'superset' | 'complex' | 'tally' | 'team' | 'attempts'
  | 'build' | 'section' | 'cycleEntry' | 'work';

export interface Block {
  node: 'block';
  type: BlockType;
  /** repeat/attempts/team size */
  count?: number;
  /** ladder rep scheme */
  scheme?: number[];
  /** What the scheme's numbers are. Reps unless stated — `1..5..1 min:`. */
  schemeUnit?: string;
  /** amrap/clock/build window */
  duration?: Unit;
  /** clock cadence */
  every?: Unit;
  untilFailure?: boolean;
  onOverrun?: 'carry' | 'cut' | 'fail';
  cap?: Unit;
  label?: string;                                      // `as heavy-single`
  buildTarget?: string;                                // `a heavy single`
  name?: string;                                       // section name
  /** Targets on the header, inherited by children (spec §5.0, N5). */
  inherited: Target[];
  equipment: string[];
  flags: string[];
  /**
   * The header's twin of `Step.unknown`, and it exists for the same reason:
   * an unrecognized header modifier used to land in `flags`, beside `unbroken`
   * and `rounds`, so nothing afterwards could tell a token nobody taught the
   * language from a flag the language defines.
   *
   * This is the *modifier* position only. A header whose **kind** is
   * unrecognized (`3 rounds of madness:`) is a different thing and stays a
   * reported error: the kind decides how the block executes, so failing to read
   * it loses the three rounds. A modifier the grammar cannot read costs nothing
   * that runs.
   */
  unknown?: string[];
  score?: Score;
  children: Node[];
  comments: string[];
  line: number;
}

export type Node = Step | Rest | Block | Interrupt;

export interface Score {
  primary: string;
  /** Derived from the block header (`for time`, AMRAP, build) rather than written.
   *  The formatter must not re-emit these or the header would state the score twice. */
  implied?: boolean;
  perRound?: boolean;
  aggregate?: 'min' | 'max' | 'sum';
  onCap?: string;
  tiebreak?: string;
  raw: string;
}

export interface Workout {
  node: 'workout';
  directives: Record<string, string>;
  title?: string;
  body: Node[];
  score?: Score;
  variants?: Record<string, Record<string, string>>;
  comments: string[];
}
