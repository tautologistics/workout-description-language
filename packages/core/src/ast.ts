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

export interface Step {
  node: 'step';
  movement: string;
  quantity: Unit;
  targets: Target[];
  /** Measured output for scoring, distinct from what ends the step (spec §4, N6). */
  measures?: 'reps' | 'calories' | 'distance';
  laterality?: Laterality;
  side?: 'first' | 'second' | 'left' | 'right';
  /** The limb noun the author used, preserved for display: arm, leg, side, hand. */
  limb?: string;
  tempo?: string;
  /** Per-round delta, e.g. `+3 each round` (spec §8.1). */
  perRound?: { delta: number; unit: string };
  team?: 'shared' | 'each' | 'synchronized';
  flags: string[];                                     // unbroken, building, tiebreak…
  notes: string[];
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
