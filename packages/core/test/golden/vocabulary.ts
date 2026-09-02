/**
 * The vocabulary: every syntactic form the spec documents, one case each.
 *
 * Why this exists. `corpus.test.ts` parses 190 real workouts and checks that
 * each one round-trips, which is a strong test of *stability* and a weak test
 * of *correctness* — it only ever sees the forms the corpus happens to use.
 * Measured, 13 of the 24 documented syntax features appear in **zero** corpus
 * files: alternatives, rx splits, thresholds, `note:`, `variants:`, the inline
 * brace form and the rest. Every defect the grammar exploration turned up lived
 * in that gap.
 *
 * So this file is deliberately a *vocabulary* rather than a sample of real
 * workouts: one case per form, plus the combinations where two forms have to
 * agree with each other. Add a case here whenever the language grows a form,
 * and whenever a bug turns out to be a form nothing exercised.
 *
 * Regenerate the snapshot deliberately, then read the diff:
 *   node test/golden/vocabulary.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// The host, first: `parse` runs the grammar in `spec/grammar-0.1.ohm` and `src/`
// opens no files, so without this the regenerator throws on its first line.
// `test/all.ts` imports it too; importing it twice is importing it once.
import '../../node.ts';
import { parse } from '../../src/parse.ts';
import { format } from '../../src/format.ts';

/** Step lines, wrapped in a minimal block by the harness. */
export const STEP_FORMS: { group: string; lines: string[] }[] = [
  { group: 'quantity/reps', lines: [
    '10 Push-Up',
    '1 Back Squat',
    '100 Pull-Up',
    '10 reps Push-Up',
    '1 rep Snatch',
  ] },
  { group: 'quantity/calories', lines: [
    '20cal Row',
    '20 cal Row',
    '15 calories Row',
    // Spelled out and unspaced. `20cal` and `20 calories` are both amounts;
    // this one is not, and the difference is an accident of `^(\d+)\s*cal$`
    // rather than a decision. Pinned so the reading is visible either way.
    '20calories Row',
  ] },
  { group: 'quantity/distance', lines: [
    '400m Run',
    '400 m Run',
    '400 meters Run',
    '400 metres Run',
    '5km Run',
    '1mi Run',
    '1 mile Run',
    '1.5mi Run',
    '100ft Sled Push',
    '50yd Buddy Carry',
    '1000m Row',
  ] },
  { group: 'quantity/duration', lines: [
    '12min Bike',
    '12 min Bike',
    '12 minutes Bike',
    '90s Plank',
    '90 sec Plank',
    '45 seconds Hollow Hold',
    '1h Ride',
    '1min30s Plank',
    '1h30min Ride',
    '1:30 Plank',
    '2min Row',
  ] },
  { group: 'quantity/other', lines: [
    '8-12 Dumbbell Curl',
    '10-15 Cable Fly',
    // Descending, which is not a range anyone means. `parseQuantity` requires
    // min < max and otherwise leaves the digits in the movement name; the
    // grammar cannot state that constraint, so this is where the two part.
    '10-5 Squat',
    // A range wearing a unit — `8-12` says what a range is, but spec §3 gives
    // the shape to reps only. Read as `open` with the raw text held in
    // `unknown`, rather than swallowed into the movement name — item 5 of
    // docs/context/ready-to-pick-up.md, closed by making the parser say it
    // cannot read the quantity instead of generalising the range.
    '100-150ft Farmers Carry',
    '1+ Deadlift',
    'max Pull-Up',
    'max Bench Press',
    '2min max Push-Up',
    '1min max Wall Ball @ 20lb',
    'Row',
  ] },
  { group: 'quantity/threshold', lines: [
    'Bike until HR > 160bpm',
    'Bike until HR < 130bpm',
    'Row until HR < Z2',
    'Row until HR below Z2',
    'Bike until power > 250W',
    'Bike until power > Z3',
    'Run until HR above 150bpm',
    'Row until HR under 120bpm',
  ] },
  { group: 'movement/naming', lines: [
    'Clean & Jerk',
    '30 Clean & Jerk',
    '10 Chest-to-Bar Pull-Up',
    '10 Dumbbell Hang Clean to Overhead @ 50lb',
    '3/4 Sit-Up',
    '20 Sumo Deadlift High-Pull @ 95lb',
    '10 Burpee Box Jump-Over @ 24in',
  ] },
  { group: 'target/load', lines: [
    '10 Thruster @ 95lb',
    '10 Thruster @ 95 lb',
    '10 Thruster @ 95lbs',
    '10 Thruster @ 95#',
    '21 KB Swing @ 24kg',
    '21 KB Swing @ 1.5pood',
    '21 KB Swing @ 2pood',
    '200m Farmers Carry @ 2x24kg',
    '12 Dumbbell Curl @ 2x35lb',
  ] },
  // A load on a coach's scale instead of a number — a small closed vocabulary,
  // read as a `Load` in its own right (item 6) rather than falling into
  // `raw` the way `@ 95` does. It carries no kilograms, on purpose — same
  // silence a percentage of an unknown 1RM already has — but it is still
  // visible to anything asking whether a step was given a load at all.
  { group: 'target/qualitative', lines: [
    '150ft Farmers Carry @ heavy',
    '10 Thruster @ moderate',
    '20 Kettlebell Swing @ light',
    '20 Air Squat @ unloaded',
    '10 Thruster @ HEAVY',
  ] },
  { group: 'target/relative', lines: [
    '3 Back Squat @ 85% 1RM',
    '1 Deadlift @ 105% TM',
    '10min Bike @ 55% FTP',
    '3 Back Squat @ 85% of heavy-single',
    '5 Front Squat @ of heavy-single',
    '5 Press @ 75%',
  ] },
  { group: 'target/other', lines: [
    '20 Box Jump @ 24in',
    '20 Box Jump @ 24"',
    '20 Box Jump @ 60cm',
    '100 Wall Ball @ 20lb @ 10ft',
    '100 Wall Ball @ 9kg to 10ft',
    '1000m Run @ 5k pace',
    '10km Run @ marathon pace',
    '10min Run @ threshold pace',
    '2000m Row @ 1:45/500m',
    '20min Bike @ 250W',
    '20min Bike @ 90% FTP',
    '30min Run @ Z2',
    '30min Run @ 145bpm',
    '5 Back Squat @ RPE 8',
    '5 Back Squat @ RIR 2',
    // The other side of the header fix, and the reason the stop is a *parameter*
    // rather than a line added to the target rule. In a header `for time` is a
    // score and ends a target; in a step there is no such thing, so the target
    // runs to the end of its segment and this is one raw target reading
    // `95lb for time`. Written into the target rule globally it would instead
    // make this step **unreadable**, because nothing in a step line can consume a
    // leftover `for time` — a step would lose its movement and its amount over a
    // phrase that only means something one level up. Held verbatim is the better
    // of the two, and pinned so the asymmetry is a stated reading.
    '10 Thruster @ 95lb for time',
  ] },
  { group: 'flags', lines: [
    '18 Thruster @ 115lb @tiebreak',
    '21 Thruster @tiebreak',
    // Spaced, and letters — so a *target*, not a flag. The tight spelling is
    // what makes a flag, because a spaced target legitimately begins with a
    // letter (`@ Z2`, `@ RPE 8`, `@ of heavy-single`). Pinned so the asymmetry
    // is a stated reading rather than an artefact of which rule ran first.
    '21 Thruster @ tiebreak',
    'max Pull-Up, unbroken',
    '2 Front Squat, building',
    '10 Deadlift, reversed',
    '10 Deadlift, open',
    // Two of them, uncommaed, and one beside an `@` flag. The *order* they land
    // in `flags` is what these pin: `peelTrailingQualifiers` strips from the
    // end, so it reads right to left, and the `@` regex runs over the whole
    // line first so an `@` flag is always hoisted in front. Neither is a
    // decision, and a grammar reads left to right — so these are the two lines
    // that will move when the parser is swapped over.
    '10 Deadlift unbroken building',
    '10 Deadlift building @tiebreak',
  ] },
  { group: 'right-to-left', lines: [
    // The same artefact as the two flag lines above, in the two other places it
    // shows: the hand-written parser applies a step's parts *right to left*, and
    // a grammar reads left to right. Neither line is coherent input — both state
    // a laterality or a completion condition twice — but the reversal is real and
    // these are where it is visible, so they are pinned rather than left to turn
    // up as a surprise diff on the day of the swap.
    //
    // `peelTrailingQualifiers` strips `each leg` first, then the paren replace
    // overwrites `laterality` with `both`; the grammar reads the paren first and
    // `each leg` last, so `per-side` wins.
    '5 Squat (both) each leg',
    // The threshold match runs before `parseQuantity`, so `max` never leaves the
    // head and the movement is literally named `max Row`; the grammar takes `max`
    // as the leading quantity and the threshold replaces it.
    'max Row until HR < Z1',
  ] },
  { group: 'laterality', lines: [
    '10 Pistol (split)',
    '10 Pistol (both)',
    '10 Pistol (per-side)',
    '10 Pistol (total)',
    // The parenthesised per-side form, canonical since 2026-08-31 (item 13b) —
    // `(each <axis>)` names how the count is performed *and* the axis, `direction`
    // being a rotation reversed. The bare `each arm` forms below still parse and
    // pin the normalisation to the parens.
    '14 DB Curl (each arm)',
    '12 Around The Worlds (each direction)',
    '10 Pistol (each side)',
    '14 DB Curl each arm',
    '12 Dumbbell Row each arm @ 60lb',
    '10 Lunge each leg',
    '20 Sledgehammer Strike each side',
    '10 Farmers Carry each hand',
    '10 Step-Up per leg',
    '21 DB Snatch first arm',
    '21 DB Snatch second arm',
    '10 KB Press left arm',
    '10 KB Press right arm',
  ] },
  { group: 'alternating', lines: [
    '10 alternating DB Snatch @ 50lb',
    '10 alt DB Snatch @ 50lb',
    '10 DB Snatch alternating',
    '10 DB Snatch, alternating',
  ] },
  { group: 'team', lines: [
    '100 Wall Ball @ 20lb shared',
    '20 Burpee synchronized',
    '11 Clean & Jerk @ 155lb each',
    '4000m Row shared',
    '55ft Partner Barbell Carry @ 315lb shared',
  ] },
  { group: 'modifiers', lines: [
    '3 Back Squat @ 70% 1RM, tempo 33X1',
    '6 Front Squat @ 185lb, tempo 30X1',
    '1min Row, count cal',
    '1min Row, count reps',
    '1min Row, count distance',
    '1min Row, count calories',
    '1 Burpee, +1 each round',
    '3 DB Hang Clean to Overhead @ 50lb, +3 each round',
    '10 Back Squat @ 225lb, note: "pause at the bottom"',
    '10 Back Squat @ 225lb, note: pause at the bottom',
    '10min Bike, ramp 50% -> 75% FTP',
    '400m Run, wearing a 20lb vest',
    '3 Bench Press @ 80% 1RM x5',
    '3 Bench Press @ 70% 1RM x2',
    '5 Deadlift x3',
  ] },
  { group: 'alternatives', lines: [
    '1min Bike or Row',
    '10 Pull-Up or 15 Ring Row',
    '20 Push-Up | 10 Handstand Push-Up',
    '20 Push-Up / 10 Handstand Push-Up',
    '1min Bike or Row or SkiErg',
    '10 Pull-Up or 15 Ring Row or 20 Banded Pull-Down',
  ] },
  { group: 'rx-by-division', lines: [
    '30 Clean & Jerk (women 105lb / men 145lb)',
    '30 Clean & Jerk (men 145lb / women 105lb)',
    '30 Deadlift (105/145)',
    '21 Deadlift (155/225lb)',
    '30 Clean & Jerk (w 105lb / m 145lb)',
    // The two ways of writing an rx *and* a qualifier that work, kept beside
    // the way that does not (see `known-wrong`). A comma before the qualifier
    // reads; so does writing the qualifier first. A space does not.
    '10 Deadlift (105/145), unbroken',
    '10 Deadlift each arm (105/145)',
    // A split beside an ordinary target. Two loads on one step, stated two
    // different ways: `fmt` writes the split before the `@` and the cue reads
    // them in that same order, so this pins the position as well as the values.
    '30 Clean & Jerk (women 105lb / men 145lb) @ RPE 8',
    // Kilos, and a unit on one side only — the magnitude rule decides which
    // side is which, and the unit does not travel with it.
    '30 Snatch (women 35kg / men 50kg)',
    '21 Deadlift (60/100kg)',
  ] },
  { group: 'combinations', lines: [
    '10 DB Snatch each arm @ 45lb',
    '10-12 Bulgarian Split Squat each leg @ 2x40lb',
    '8-12 Dumbbell Curl each arm @ 2x35lb',
    '5 Turkish Get-Up each side @ 1.5pood',
    '100ft Walking Lunge (split), 45lb plate overhead',
    'DB Snatch (split) @ 50lb',
    'DB Snatch first arm @ 50lb',
    'max KB Snatch (split) @ 1.5pood',
    '40 Wall Ball @ 20lb shared',
    '18 Thruster @ 115lb @tiebreak, unbroken',
    '10 Thruster @ 95lb, tempo 31X1, +1 each round',
  ] },
  { group: 'stray-comma', lines: [
    // A comma with nothing after it. Written into the grammar as an *optional*
    // modifier while swapping the parser over, because required it made one
    // stray keystroke unreadable and took the movement and the amount with it —
    // a steep price on a format written by hand on a whiteboard. The old regex
    // chain pushed an empty string into `notes` here, which is the same
    // forgiveness arrived at by accident and one more nameless entry in the
    // array queue item 0d exists to clean up.
    '10 Thruster,',
    '10 Thruster, , unbroken',
  ] },
  { group: 'unreadable', lines: [
    // A line that is *only* a completion condition, with nothing to do. The
    // grammar's `movement` needs at least one character, so this is the one step
    // shape it rejects outright, and `parse` holds the text as the movement name
    // and reports it. The old regex chain read it as a step with an **empty**
    // movement — no error, nothing to do, and a cue on the board with no name.
    // Pinned so that the swap's one behaviour change here is a stated reading.
    'until HR > 160bpm',
  ] },
  { group: 'fail-open', lines: [
    // Unrecognized input, and **the shape the whole grammar exploration was for**:
    // held in the tree *as unrecognized*, round-tripped intact, and carrying no
    // meaning anywhere. Until 2026-08-15 it was held in `notes`, the same array as
    // an authored `note: "…"` — so afterwards nothing could tell them apart, and
    // notes are rendered. An unknown token silently acquired the meaning "the
    // author wrote a note", which is exactly the guess the framing forbids.
    //
    // **Closed 2026-08-15 by queue item 0d**: `Step.unknown` and `Block.unknown`.
    // The diff to read on these three is `notes` becoming `unknown` with the text
    // unchanged — nothing about what the step *does* moved, which is the claim.
    '10 Thruster @ 95lb, some phrase nobody taught the parser',
    '10 Thruster, with a band',
    '400m Run, barefoot',
    // The two on one line, which is the case the field exists for: they must stay
    // distinguishable, and the canonical form has to write each back in a spelling
    // that comes back as what it was. That is why an authored note now wears its
    // `note:` marker — a bare phrase after a comma means *unrecognized* now, so a
    // note emitted bare would come back an unknown and one `wdl fmt` would demote
    // something written for the athlete into something nothing renders.
    '10 Thruster, note: "keep the elbows up", with a band',
    '10 Thruster, with a band, note: "keep the elbows up"',
    // Beside modifiers the language does read, so it is visible that an unknown
    // costs nothing around it: the tempo, the count, the flag and the load all
    // still land, and the unknown is written back last.
    '10 Thruster @ 95lb, unbroken, tempo 30X1, wibble',
    '20cal Row, count cal, on the fan bike',
    // Two of them on one line. Their relative order is kept — it is the one thing
    // about unknown text that could carry meaning — even though their position
    // among the modifiers is not.
    '10 Thruster, with a band, then rest a bit',
    // **A plausible typo of a real keyword**, which is the case that makes silence
    // the wrong answer: `unbrokn` is one keystroke from a constraint that decides
    // whether a set counts. Held inert, so nothing acts on it, *and* reported by
    // `validate` as a `note` — not an error, because the rest of the line executes
    // exactly as written, and not a guess at what was meant.
    '10 Thruster, unbrokn',
    '10 Thruster, tempo',
    // Prose the grammar *does* read as a note, kept beside them so the line
    // between the two is visible: `ramp` and `wearing` open a note by their first
    // word, and they must not move into `unknown`.
    '10min Bike, ramp 50% -> 75% FTP',
    '5 Back Squat @ 225lb, wearing a 20lb vest',
  ] },
  { group: 'unread-parenthetical', lines: [
    // **Read wrongly until 2026-08-29** (queue item 14). A parenthetical that is
    // neither a laterality word nor an rx split matched no rule, so the `(`, the
    // `)` and the text between them fell into the movement name one character at
    // a time — resolving to no registry entry, out of muscle and volume analysis
    // — and `wdl fmt` pluralized it, an `s` on the closing paren that
    // round-trips. The `unreadableParen` production now holds the whole
    // parenthetical, parens included, in `unknown`: `validate` reports it as a
    // `note`, the movement name is clean, and canonical form writes it back after
    // the modifiers it did read — the same held-and-reported treatment
    // `100-150ft` gets under `fail-open` above, one construct over. *(As of
    // 2026-08-31, item 13b, `(each direction)` is no longer here — it reads as a
    // per-side laterality; see the `laterality` group.)*
    // A bare word, and a form with no space before the paren — both held.
    '10 Row (wibble)',
    '10 Row(wibble)',
    // A registry title that itself carries a parenthetical (15 of ~970 do, all
    // from raw imports). The parenthetical is peeled to a `note` and the step
    // resolves against the base name — a deliberate trade stated in spec §4.
    '10 Front Squat (Clean Grip)',
    // Unbalanced: the match stops at the first `)`, so `((x)` is held whole.
    '10 Foo ((x)',
    // The recognised parenthetical forms still win — kept here so the fallback's
    // boundary is visible beside it, not only under `laterality` /
    // `rx-by-division` above.
    '10 Pistol (split)',
    '10 Pistol (BOTH)',
    '30 Clean & Jerk (women 105lb / men 145lb)',
    '30 Deadlift (105/145)',
  ] },
  { group: 'was-wrong', lines: [
    // **Read wrongly until 2026-08-15, and read correctly since**, when queue
    // item 0a made `spec/grammar-0.1.ohm` the parser. The group is kept together
    // and kept named for what it was, because the point of pinning a defect is
    // that its fix arrives as a diff you can read — and this is that diff's other
    // side. What each line used to do is stated here rather than deleted: a
    // reader who does not know a road was walked will walk it again.
    //
    // `@` with no space after it was matched as a *flag* before the target split
    // ever ran, and `\w` matches digits — so the load was lost, `wdl check` still
    // said ok, and `wdl fmt` rewrote the line to `- 10 Thrusters, 95lb`, a stable
    // fixpoint of the wrong reading. The grammar states the rule the other way
    // and states it deliberately: the first character after the `@` decides, a
    // letter opens a flag and a digit opens a target.
    '10 Thruster @95lb',
    '10 Thruster @2x35lb',
    '10 Thruster @24kg',
    // No unit at all. Two things were wrong here at different times. The old
    // regex chain made a flag called `95` and lost the load. The grammar fixed
    // that in 2026-08-15 but read it as `raw` — held verbatim, meaning nothing —
    // on the reasoning that a defaulted unit is an invention. Settled the other
    // way 2026-09-01 (DEC-<RULE1-SHA>): pound is the documented default for a
    // load, so `@ 95` and `@95` read as `95lb` and `wdl fmt` writes the unit in.
    '10 Thruster @95',
    '10 Thruster @ 95',
    // Worse than a lost load: `@(\w[\w-]*)` stopped at the `%`, so `85` became a
    // flag and `% 1RM` was left in the text — the movement ended up named
    // `Thruster % 1RM`, which resolves to nothing and took the step out of muscle
    // and volume analysis too.
    '10 Thruster @85% 1RM',
    // A flag beside a tight load on one line: two flags and no target before,
    // one of each now.
    '18 Thruster @115lb @tiebreak',
    // The same load, lost a second way. `@` was only split out of the *first*
    // comma segment, so a target written after a comma never reached `targets` —
    // `applyQualifier` fell through and filed it as a note.
    '10 Thruster, @ 95lb',
    '10 Thruster, @ 24kg',
    '10 Thruster, @ 85% 1RM',
    // An rx split with a qualifier after it, space-separated: the whole paren was
    // swallowed into the *movement name*. `peelRx` only fired at the end of a
    // segment, so `Deadlift (105/145)` became the name, both loads were lost, and
    // the name resolved to no registry entry — so the step fell out of muscle and
    // volume analysis too, which is one worse than the `@95lb` family. `wdl fmt`
    // then pluralized the name it was given and wrote
    // `10 Deadlift (women 105lb / men 145lb)s each arm`, which is the whiteboard
    // constraint failing out loud. A comma instead of the space always read
    // correctly — both spellings are pinned under `rx-by-division` above.
    '10 Deadlift (105/145) each arm',
    '10 DB Snatch (50/35lb) each side',
    '10 Deadlift (women 105lb / men 145lb) each arm',
    // The same shape with a flag rather than a laterality. This one did not even
    // settle: `fmt` wrote `10 Deadlifts (105/145), unbroken`, which *reparsed* as
    // an rx — one pass of the formatter lost the loads and the next found them.
    // It was the only entry in `KNOWN_UNSETTLED`, and that list is empty now.
    '10 Deadlift (105/145) unbroken',
    '10 Deadlift (women 105lb / men 145lb) unbroken',
  ] },
  { group: 'sets-by-reps', lines: [
    // `sets x reps` written *before* the movement, which is how gyms write it and
    // how spec §1's own design rule 4 writes it: `5x5 Back Squat @ 225lb` is the
    // example given for "must stay a one-liner". Until 2026-08-15 no
    // implementation read it — `parseQuantity` matched no pattern on `5x5`, so
    // the whole thing became the movement *name*, the quantity stayed `open`, and
    // the name resolved to no registry entry, which took the step out of muscle
    // and volume analysis too. Found 2026-08-15 by widening the differential
    // test's step source to the vocabulary's whole-document forms.
    //
    // **It means what the trailing `xN` means**, which is the whole reason it can
    // be read without inventing anything: `3x10 Curl` and `10 Curl x3` are the
    // same prescription and now produce the same tree, so nothing downstream
    // learns a new concept — `timeline.ts` already expands `sets` into that many
    // identical repetitions, so rep totals come out right for free.
    '3x10 Curl',
    '5x5 Back Squat @ 225lb',
    '1x1 Snatch @ 95% 1RM',
    // The trailing twin, pinned right here rather than only under `modifiers`,
    // because "these two are the same tree" is the claim and a reader should be
    // able to see both readings without hunting for one of them.
    '10 Curl x3',
    // Both at once. The trailing one wins, because it is read later and "the
    // later qualifier wins" is the reading already settled for every other part
    // of a step stated twice (`5 Squat (both) each leg` is pinned above). Nobody
    // writes this; it is pinned because leaving it to fall out of rule ordering is
    // how a fixture ends up deciding a language question.
    '5x5 Back Squat x3',
    // The leading form beside the other things a step can carry, since a new
    // leading quantity has to leave the rest of the line alone.
    '3x10 Curl each arm',
    '3x10 Curl, unbroken',
    // **Not read, and pinned that way.** `10x` is a rep spelling spec §3's unit
    // table documents (`Reps | 10 | 10 reps, 10x`) and no implementation has ever
    // read it either — it is the same family and was found beside this one, but
    // it is a *different* form and not what queue item 0e scoped. Adding it means
    // deciding whether a bare `Nx` is reps everywhere or only here, so it is
    // recorded rather than folded in. See known-debts.md.
    '10x Curl',
  ] },
  { group: 'whitespace-and-case', lines: [
    '10   Thruster   @   95lb',
    '10 THRUSTER @ 95LB',
    '10 thruster @ 95lb',
  ] },
];

/** Whole-document forms: blocks, scoring, preamble. */
export const SOURCES: { group: string; name: string; src: string }[] = [
  // --- block headers ---
  { group: 'block/repeat', name: 'rounds', src: '3 rounds:\n  - 10 Push-Up' },
  { group: 'block/repeat', name: 'round singular', src: '1 round:\n  - 10 Push-Up' },
  { group: 'block/repeat', name: 'sets', src: '5 sets:\n  - 5 Back Squat @ 225lb' },
  { group: 'block/repeat', name: 'rounds for time', src: '3 rounds for time:\n  - 10 Push-Up' },
  // `3 RFT` is the same block said short — the third abbreviation a gym writes,
  // beside `AMRAP` and `EMOM`, and how the workout that raised queue item 0f was
  // actually written on a whiteboard. It used to be a named sequence: reported,
  // so nothing went quietly, but it ran **once** and was unscored. Canonical
  // output writes the long form, so these pin the normalisation as much as the
  // reading. The bare form is deliberately *not* read — `RFT` with no count names
  // rounds without saying how many, and there is no unbounded repeat to read it
  // as (spec §5.2) — so it stays here as a reported header, one number away from
  // a block that works.
  { group: 'block/repeat', name: 'rft', src: '3 RFT:\n  - 10 Push-Up' },
  { group: 'block/repeat', name: 'rft lowercase', src: '3 rft:\n  - 10 Push-Up' },
  { group: 'block/repeat', name: 'rft tight', src: '3RFT:\n  - 10 Push-Up' },
  { group: 'block/repeat', name: 'rft with a target and a cap', src: '3 RFT @ 95lb, cap 12min:\n  - 10 Thruster' },
  { group: 'block/repeat', name: 'rft after a comma', src: 'for time, 3 RFT:\n  - 10 Thruster @ 95lb' },
  { group: 'block/repeat', name: 'rft with no count', src: 'RFT:\n  - 10 Push-Up' },
  // The boundary of the word itself: `RFT` has to end where the kind ends, or a
  // header that merely starts with it would be read as three rounds.
  { group: 'block/repeat', name: 'rft is a whole word', src: '3 RFTX:\n  - 10 Push-Up' },
  { group: 'block/sequence', name: 'for time', src: 'for time:\n  - 10 Push-Up' },
  { group: 'block/sequence', name: 'bare sequence', src: 'sequence:\n  - 10 Push-Up' },
  { group: 'block/amrap', name: 'amrap', src: 'AMRAP 12min:\n  - 10 Push-Up' },
  { group: 'block/amrap', name: 'amrap bare minutes', src: 'AMRAP 12:\n  - 10 Push-Up' },
  { group: 'block/amrap', name: 'amrap unbounded', src: 'AMRAP:\n  - 10 Push-Up' },
  { group: 'block/amrap', name: 'for duration', src: 'for 12min:\n  - Run' },
  { group: 'block/clock', name: 'emom', src: 'EMOM 10min:\n  - 5 Power Clean @ 155lb' },
  { group: 'block/clock', name: 'e2mom', src: 'E2MOM 20min:\n  - 5 Power Clean @ 155lb' },
  { group: 'block/clock', name: 'every until failure', src: 'every 1min until failure:\n  - 5 Burpee' },
  { group: 'block/clock', name: 'every x count', src: 'every 3min x 5:\n  - 400m Run' },
  { group: 'block/clock', name: 'every bare', src: 'every 90s:\n  - 3 Deadlift @ 315lb' },
  // `every 90s for 12min` — how an interval is said out loud, and until
  // 2026-08-16 a spelling the grammar had no rule for while `headerText` wrote it
  // anyway. Pinned with the two forms that used to be written unreadably: an
  // unbounded `every`, which formatted to `every 1min30s x undefined:`, and an
  // E2MOM, which formatted to `every 2min for 20min:`. Both reparsed to a named
  // *sequence* with the clock gone — and because an unreadable header is held
  // rather than rejected, both were perfect text fixpoints of a total loss. The
  // canonical form of a bounded interval is now the gym's: `E2MOM 20min`, with
  // `EMOM` the one-minute spelling of it.
  { group: 'block/clock', name: 'every for a duration', src: 'every 90s for 12min:\n  - 3 Power Clean @ 185lb' },
  { group: 'block/clock', name: 'every for whole minutes', src: 'every 2min for 20min:\n  - 5 Power Clean @ 155lb' },
  { group: 'block/clock', name: 'work window', src: 'work 20s:\n  - Push-Up' },
  { group: 'block/clock', name: 'minute entry', src: 'min 1: 12cal Row' },
  { group: 'block/clock', name: 'minute entry long', src: 'minute 1: 12cal Row' },
  { group: 'block/ladder', name: 'dash scheme', src: '21-15-9:\n  - Thruster @ 95lb\n  - Pull-Up' },
  { group: 'block/ladder', name: 'run scheme', src: '1..10:\n  - Power Clean @ 135lb' },
  { group: 'block/ladder', name: 'pyramid', src: '1..5..1:\n  - Power Clean @ 135lb' },
  { group: 'block/ladder', name: 'descending run', src: '10..1:\n  - Burpee' },
  { group: 'block/ladder', name: 'scheme with unit', src: '250-500-750 m:\n  - Row' },
  { group: 'block/ladder', name: 'interval pyramid', src: '1..5..1 min:\n  - Bike' },
  { group: 'block/other', name: 'attempts', src: '3 attempts:\n  - 1 Snatch @ 95% 1RM' },
  { group: 'block/other', name: 'team of', src: 'team of 2:\n  - 100 Wall Ball @ 20lb shared' },
  { group: 'block/other', name: 'tally', src: 'any order:\n  - 100 Pull-Up\n  - 200 Push-Up' },
  { group: 'block/other', name: 'superset', src: 'superset:\n  - 10 Bench Press @ 135lb\n  - 10 Bent-Over Row @ 95lb' },
  { group: 'block/other', name: 'complex', src: 'complex:\n  - 1 Power Clean\n  - 1 Front Squat\n  - 1 Push Jerk' },
  { group: 'block/other', name: 'build to', src: 'build to a heavy single in 15min as heavy-single:\n  - Snatch' },
  { group: 'block/other', name: 'build to without a label', src: 'build to a heavy single in 15min:\n  - Snatch' },
  // Unrecognized *because a digit makes it a kind* — `3 rounds …` is a repeat
  // whose head the parser cannot finish reading, so it is a named sequence
  // keeping every child, plus a report. Pinned because "fail open" is a property
  // of the format and not an implementation detail — see queue item 0. Contrast
  // `block/section :: custom label`, one digit away, which is a clean section.
  { group: 'block/other', name: 'unrecognized header', src: '3 rounds of madness:\n  - 10 Push-Up' },
  // A head that *opens* with a kind-word but never completes it — `RFT` with no
  // count, `rounds` with no number — is a kind missing its parameter, not a
  // section: still a reported sequence (spec §5.2, §11.1, grammar's `kindLead`).
  { group: 'block/other', name: 'kind-word header with no parameter', src: 'rounds of madness:\n  - 10 Push-Up' },
  { group: 'block/section', name: 'warmup', src: 'warmup:\n  - 400m Run' },
  { group: 'block/section', name: 'strength', src: 'strength:\n  - 5 Back Squat @ 225lb' },
  { group: 'block/section', name: 'conditioning', src: 'conditioning:\n  - AMRAP 12min:\n      - 10 Burpee' },
  { group: 'block/section', name: 'cooldown', src: 'cooldown:\n  - 5min Bike' },
  { group: 'block/section', name: 'accessory', src: 'accessory:\n  - 3x10 Curl' },
  { group: 'block/section', name: 'skill', src: 'skill:\n  - 10min Handstand Practice' },
  // Any bare label — letters, spaces and hyphens, no digit, not opening with a
  // kind-word — is a section: the inert container the fixed words above produce,
  // for a label the author coined (spec §2, §11.1). Case is preserved where the
  // fixed vocabulary is folded to lower case. `validate` says it out loud as a
  // `note` (see validate.test.ts); it is silent in the parse errors pinned here.
  { group: 'block/section', name: 'custom label', src: '3 rounds for time:\n  - Barbell movements:\n      - 10 Deadlift @ 185lb\n      - 10 Hang Clean @ 95lb' },
  { group: 'block/section', name: 'custom label keeps its case', src: 'Barbell Movements:\n  - 10 Deadlift @ 185lb' },
  { group: 'block/section', name: 'custom label with a hyphen', src: 'single-arm work:\n  - 10 Dumbbell Press @ 40lb' },
  // Opens with a section word but is not one — `strength` alone is the fixed
  // section, `strength work` is a coined label, kept verbatim.
  { group: 'block/section', name: 'custom label past a section word', src: 'strength work:\n  - 5 Back Squat @ 225lb' },

  // --- block modifiers ---
  { group: 'block/modifier', name: 'cap', src: 'for time, cap 12min:\n  - 100 Burpee' },
  { group: 'block/modifier', name: 'carry on overrun', src: 'for time, cap 12min, carry on overrun:\n  - 100 Burpee' },
  { group: 'block/modifier', name: 'cut on overrun', src: 'for time, cap 12min, cut on overrun:\n  - 100 Burpee' },
  { group: 'block/modifier', name: 'fail on overrun', src: 'for time, cap 12min, fail on overrun:\n  - 100 Burpee' },
  { group: 'block/modifier', name: 'wearing', src: 'for time, wearing a 20lb vest:\n  - 1mi Run' },
  { group: 'block/modifier', name: 'as label', src: '3 rounds, as main:\n  - 10 Push-Up' },
  { group: 'block/modifier', name: 'inherited target', src: '3 rounds @ 95lb:\n  - 10 Thruster\n  - 10 Push Press' },
  { group: 'block/modifier', name: 'flags', src: '3 rounds, unbroken:\n  - 10 Pull-Up' },
  // A header target written after a comma. The `@` sweep in `parseHeader` runs
  // over the *first* comma segment only, so this never reaches `inherited` —
  // `applyBlockModifier` falls through and files `@ 95lb` as a flag, where
  // nothing inherits it and the children are loadless. The header-level twin of
  // `known-wrong :: 10 Thruster, @ 95lb`. The grammar reads it correctly, so it
  // is a listed exclusion in grammar.test.ts and the swap is the fix.
  { group: 'block/modifier', name: 'target after a comma', src: '3 rounds, @ 95lb:\n  - 10 Thruster' },
  // The header twin of the `stray-comma` step forms above: `3 rounds,:` is three
  // rounds, not a header nobody can read.
  { group: 'block/modifier', name: 'stray comma', src: '3 rounds,:\n  - 10 Push-Up' },
  // A target and a `for time` on the same header, both ways round. Written
  // target-first the load *and* the score used to be lost: the target text ran
  // to the end of the segment, so `95lb for time` came back one raw target and
  // the block was never scored. Written score-first both always read correctly,
  // which is what made it order-sensitivity rather than a missing form.
  // **Fixed 2026-08-15** by giving the target rule a *stop* parameter: a target
  // is prose and runs to the end of its segment, except in a header, where
  // `for time` also ends it. Both spellings now read the same, and the canonical
  // form of both is score-first.
  { group: 'block/modifier', name: 'target then for time', src: '3 rounds @ 95lb for time:\n  - 10 Thruster' },
  { group: 'block/modifier', name: 'for time then target', src: '3 rounds for time @ 95lb:\n  - 10 Thruster' },
  // The neighbours. A relative target then `for time`, because the stop has to
  // fire after text that is not a plain load; `for time` with no kind at all in
  // front of it; and a comma modifier *after* the fused score, so the stop is
  // not doing the comma's job by accident.
  { group: 'block/modifier', name: 'relative target then for time', src: '3 rounds @ 85% 1RM for time:\n  - 3 Back Squat' },
  { group: 'block/modifier', name: 'bare for time then target', src: 'for time @ 95lb:\n  - 30 Thruster' },
  { group: 'block/modifier', name: 'target, for time, then a cap', src: '3 rounds @ 95lb for time, cap 12min:\n  - 10 Thruster' },
  // The stop is the *phrase* `for time` and not the word `for`, so a target that
  // is ordinary prose is untouched. Pinned because a boundary written one word
  // too short would cut this one to `marathon` and nothing else in the suite
  // writes a header target with two words in it.
  { group: 'block/modifier', name: 'prose target on a header', src: '3 rounds @ marathon pace:\n  - 1mi Run' },
  // The same defect one position over, and the reason the fix is two lines
  // rather than one. After a comma the target is a `blockModifier`, so the stop
  // had to be applied there as well — and applied *alone* it made this header
  // strictly worse than greedy: the `for time` had nothing left to consume it
  // and the whole line became unreadable, losing the kind and the load too.
  //
  // So `headerModifier` gained trailing extras, which states something that was
  // true all along and unsaid: **whatever may qualify a header before a comma
  // may qualify it after one.** Left undone, this line was the *unsettled* case —
  // `wdl fmt` wrote the comma away, and the second pass then read the load and
  // the score the first pass had lost. That is the shape the rx-split defect had,
  // and it is the argument against stopping halfway: a half-fixed boundary turns
  // a wrong-but-stable reading into a reading that changes under the formatter.
  { group: 'block/modifier', name: 'target after a comma then for time', src: '3 rounds, @ 95lb for time:\n  - 10 Thruster' },
  // The fourth of the four spellings spec §5.0 now lists, and all four are one
  // reading — pinned together because the spec claims that outright and a
  // normative claim wants a test under it rather than a sentence.
  { group: 'block/modifier', name: 'for time then target after a comma', src: '3 rounds for time, @ 95lb:\n  - 10 Thruster' },
  { group: 'block/modifier', name: 'two targets after a comma', src: '3 rounds, @ 95lb @ 24in:\n  - 10 Box Jump' },
  // The block-level half of fail-open, found 2026-08-15 while stating the header
  // and closed the same day by queue item 0d. An unrecognized header modifier
  // used to land in `flags`, the same array as `unbroken` and `rounds` — so
  // nothing afterwards could tell a token nobody taught the language from a flag
  // the language defines, and `headerText` wrote it back among them. It has its
  // own field now, and these pin the boundary: an unknown *beside a real flag*,
  // so the two are visibly separate; a typo of a flag, which is the case that
  // must be reported rather than swallowed; and an unknown beside a cap, so a
  // modifier the grammar reads is untouched by one it does not.
  { group: 'block/modifier', name: 'unknown modifier', src: '3 rounds, wibble:\n  - 10 Push-Up' },
  { group: 'block/modifier', name: 'unknown modifier beside a flag', src: '3 rounds, unbroken, wibble:\n  - 10 Push-Up' },
  { group: 'block/modifier', name: 'a typo of a flag', src: '3 rounds, unbrokn:\n  - 10 Push-Up' },
  { group: 'block/modifier', name: 'unknown modifier beside a cap', src: 'for time, cap 12min, in the garage:\n  - 100 Burpee' },
  // And the neighbour that is **not** this: an unrecognized *kind* is a different
  // thing and stays a reported error, because the kind decides how the block
  // executes — `3 rounds of madness:` loses the three rounds — where a modifier
  // nobody taught the language costs nothing that runs. Pinned above as
  // `block/other :: unrecognized header`; this is the same head with a modifier
  // after it, so both readings are visible on one line.
  { group: 'block/modifier', name: 'unrecognized kind and an unknown modifier', src: '3 rounds of madness, wibble:\n  - 10 Push-Up' },

  // --- the kind, stated after a comma ---
  //
  // Spec §5.0's "order is free on input" is about the *whole* header and not
  // about its opening segment, and until 2026-08-16 it was true only of what
  // *qualifies* a block. What a block **is** had to come first, and everything
  // stating a kind after a comma was read as text nobody taught the language.
  //
  // `for time` is what made that expensive rather than merely wrong. It parses on
  // its own — a sequence scored by the clock is a real block — so nothing looked
  // amiss: `for time, 3 rounds:` ran **once** instead of three times, and the only
  // word said about it was a note that `3 rounds` was being kept as written. The
  // heads that do *not* parse alone (`cap 12min`, `building`) raised an error, so
  // the silence belonged precisely to the head that succeeded.
  //
  // These five are one reading with the five above them, and that is the claim
  // worth a test rather than a sentence.
  { group: 'block/order', name: 'for time then rounds', src: 'for time, 3 rounds:\n  - 10 Thruster @ 95lb' },
  { group: 'block/order', name: 'for time then a ladder', src: 'for time, 21-15-9:\n  - Thruster @ 95lb\n  - Pull-Up' },
  { group: 'block/order', name: 'for time then an amrap', src: 'for time, AMRAP 12min:\n  - 10 Burpee' },
  { group: 'block/order', name: 'for time then a team', src: 'for time, team of 2:\n  - 100 Wall Ball @ 20lb shared' },
  { group: 'block/order', name: 'for time then a clock', src: 'for time, every 3min x 5:\n  - 400m Run' },
  // The kind in the *third* segment, so nothing about the fix depends on it
  // arriving directly after the head.
  { group: 'block/order', name: 'kind after a modifier', src: 'for time, cap 12min, 3 rounds:\n  - 10 Thruster @ 95lb' },
  // A head that is not a kind at all, with the kind after it. Both of these were
  // *reported* before the fix and still are — the head is unreadable either way —
  // but the rounds are read now, and the unreadable head is written back where it
  // was written rather than dropped. Canonical output keeps it in front, which is
  // the only place it round-trips from: a `name` on a block that has a kind is not
  // the block's identity, so nothing else would write it.
  { group: 'block/order', name: 'unreadable head then rounds', src: 'cap 12min, 3 rounds:\n  - 10 Thruster @ 95lb' },
  { group: 'block/order', name: 'flag-shaped head then rounds', src: 'building, 3 rounds:\n  - 5 Back Squat' },
  // And the boundary: **a header states at most one kind.** A second is not a
  // reordering but a contradiction, so the first stands and the second is held
  // verbatim — the answer the language already gives anything it will not act on.
  // Applying the later one instead would leave the AMRAP's window on a block whose
  // type no longer writes it, which is the silent loss this whole item closes.
  { group: 'block/order', name: 'two kinds', src: 'AMRAP 12min, 3 rounds:\n  - 10 Burpee' },

  // --- a fused `for time` on a kind that is not a repeat ---
  //
  // `for time` fuses onto any kind, and until 2026-08-16 it fused onto two. A
  // score implied by `for time` is one the *author* wrote; a score implied by the
  // shape (an AMRAP's `rounds + reps`) is one the kind supplies, and only the
  // second is safe to leave unwritten because reparsing rederives it. So
  // `21-15-9 for time:` formatted to `21-15-9:` and came back unscored — a text
  // fixpoint that lost the author's word on the first `wdl fmt`.
  //
  // Found by the item above rather than by the corpus: the new `for time, 21-15-9:`
  // spelling inherits the same formatter, and the two spellings agreeing is what
  // made this visible as the *kind's* problem rather than the comma's.
  { group: 'block/order', name: 'ladder for time', src: '21-15-9 for time:\n  - Thruster @ 95lb\n  - Pull-Up' },
  { group: 'block/order', name: 'amrap for time', src: 'AMRAP 12min for time:\n  - 10 Burpee' },
  { group: 'block/order', name: 'team for time', src: 'team of 2 for time:\n  - 100 Wall Ball @ 20lb shared' },
  { group: 'block/order', name: 'clock for time', src: 'every 3min x 5 for time:\n  - 400m Run' },

  // --- scoring ---
  { group: 'score', name: 'simple', src: 'for time:\n  - 100 Burpee\nscore: time' },
  { group: 'score', name: 'rounds + reps', src: 'AMRAP 12min:\n  - 10 Burpee\nscore: rounds + reps' },
  { group: 'score', name: 'per round', src: '5 rounds:\n  - 500m Row\nscore: time per round' },
  { group: 'score', name: 'min per round', src: '5 rounds:\n  - 500m Row\nscore: min per round' },
  { group: 'score', name: 'max per round', src: '5 rounds:\n  - 3 Back Squat\nscore: max per round' },
  { group: 'score', name: 'sum per round', src: '5 rounds:\n  - max Pull-Up\nscore: sum per round' },
  { group: 'score', name: 'sum of blocks', src: 'for time:\n  - 100 Burpee\nscore: sum of blocks' },
  { group: 'score', name: 'on cap', src: 'for time, cap 12min:\n  - 100 Burpee\nscore: time\non cap: reps completed' },
  { group: 'score', name: 'tiebreak', src: 'for time:\n  - 100 Burpee\nscore: time\ntiebreak: reps at 5min' },
  { group: 'score', name: 'brace form', src: 'for time:\n  - 100 Burpee\nscore: {primary: time, tiebreak: reps at 5min}' },
  { group: 'score', name: 'on a block', src: '3 rounds:\n  - 10 Push-Up\n  score: time' },
  { group: 'score', name: 'rounds + reps per round', src: '5 rounds:\n  - 10 Burpee\nscore: rounds + reps per round' },
  // A brace with no `primary:` field. `primary` used to become the *whole brace
  // text* — `{tiebreak: reps at 5min}` — which is not a thing anything can rank
  // by, and the canonical form then stated the tiebreak twice: once inside the
  // brace it re-emitted as `raw`, and once as its own `tiebreak:` line.
  //
  // **Decided and fixed 2026-08-15: a brace with no `primary:` has no primary.**
  // An absent field is absent, so nothing is invented; the fields the author did
  // write are kept and round-trip, so nothing is refused either; and `validate`
  // reports `score-without-primary`, because "this score names nothing to rank
  // by" is a statement about a *value* and belongs where `min < max` on a rep
  // range belongs. The tiebreak is emitted once now, and the canonical `score:`
  // line carries no trailing space.
  { group: 'score', name: 'brace form without a primary', src: 'for time:\n  - 100 Burpee\nscore: {tiebreak: reps at 5min}' },
  { group: 'score', name: 'brace form with only an on cap', src: 'for time, cap 12min:\n  - 100 Burpee\nscore: {on cap: rounds completed}' },
  // Empty braces: nothing named at all. Held verbatim as the raw, since there is
  // no qualifier to re-emit, and reported by the same rule.
  { group: 'score', name: 'brace form empty', src: 'for time:\n  - 100 Burpee\nscore: {}' },
  // All three fields, which is the form the brace exists for and the one that
  // must not move: a compound score on one line.
  { group: 'score', name: 'brace form with every field', src: 'for time, cap 12min:\n  - 100 Burpee\nscore: {primary: time, on cap: rounds completed, tiebreak: reps at 5min}' },
  // The nested block form, which spec §9.5 and §9.6 both illustrated. It was
  // dropped *entirely*: `parseScore` is handed `score:` with nothing after it, so
  // `primary` was the empty string, the children were never looked at, `wdl check`
  // said ok, and `wdl fmt` wrote a bare `score:`. Found 2026-08-15 while stating
  // the score line in the grammar.
  //
  // **Decided 2026-08-15: the prose goes.** A compound score has two spellings —
  // sibling lines, and inline braces when it must be one line — and they cover
  // the two cases that exist. A nested key-and-value block is a third spelling of
  // the same three fields, in the notation the whiteboard constraint exists to
  // avoid; it is the same object the brace form is, and the project has already
  // ruled that a canonical output with braces around a compound score was a *bug*
  // rather than a formatting choice. The formatter emits sibling lines, so this
  // form could only ever have existed to be rewritten away.
  //
  // What was never acceptable is the *silence*, and that is fixed whichever way
  // the decision went: each indented line is now reported by name, and the bare
  // `score:` it leaves behind is reported by `validate` as `score-without-primary`.
  { group: 'score', name: 'nested block form', src: 'for time:\n  - 100 Burpee\nscore:\n  primary: time\n  on cap: reps' },
  { group: 'score', name: 'nested block form with a tiebreak', src: 'for time:\n  - 100 Burpee\nscore:\n  primary: time\n  tiebreak: checkpoints' },
  // The same shape on a block rather than on the workout, which is a second place
  // the children were dropped and a second call site for the report.
  { group: 'score', name: 'nested block form on a block', src: '3 rounds:\n  - 10 Push-Up\n  score:\n    primary: time' },
  // The spelling that is correct and must not move, kept beside them: this is
  // what §9.5 says now and what the formatter emits.
  { group: 'score', name: 'sibling lines, the spelling that works', src: 'for time, cap 12min:\n  - 100 Burpee\nscore: time\non cap: rounds completed\ntiebreak: checkpoints' },

  // --- preamble ---
  { group: 'preamble', name: 'title', src: '# Fran\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'directive', src: '@id fran\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'directives many', src: '@id fran\n@author chris\nfor time:\n  - 21 Thruster @ 95lb' },
  // Not one of the 190 corpus workouts writes a directive, so these five are the
  // only coverage the forms have. `@id` takes an optional `namespace:` prefix and
  // is never derived from the contents (roadmap §3.2.1); a value is otherwise
  // uninterpreted, which is what makes `@tags`' commas ordinary text and a
  // directive with no value at all legitimate.
  { group: 'preamble', name: 'version directive', src: '@wdl 0.1\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'namespaced id', src: '@id crossfit:fran\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'directive with commas', src: '@tags conditioning, benchmark\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'date directive', src: '@date 2026-08-09\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'directive with no value', src: '@draft\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'comment own line', src: '// a note about this one\nfor time:\n  - 21 Thruster @ 95lb' },
  { group: 'preamble', name: 'comment trailing', src: 'for time:\n  - 21 Thruster @ 95lb  // heavy' },

  // --- variants ---
  { group: 'variants', name: 'nested', src: 'variants:\n  women:\n    load: 65lb\n  men:\n    load: 95lb\nfor time:\n  - 21 Thruster' },
  { group: 'variants', name: 'inline brace', src: 'variants:\n  women: {load: 65lb}\n  men: {load: 95lb}\nfor time:\n  - 21 Thruster' },
  // Malformed, and *reported* as of the swap. A variant line is a name and
  // either nothing or brace fields; the old regex accepted anything after the
  // colon, ignored it, and registered the variant with no fields at all — so a
  // typo produced a variant that existed and did nothing. Now the line is named
  // in an error and the variant is not invented. Same for a field line that is
  // not `key: value`.
  { group: 'variants', name: 'unreadable variant', src: 'variants:\n  women: junk\nfor time:\n  - 21 Thruster' },
  { group: 'variants', name: 'unreadable field', src: 'variants:\n  women:\n    load: 65lb\n    junk\nfor time:\n  - 21 Thruster' },

  // --- divisions: the two spellings of one idea (spec §10) ---
  //
  // Pinned together on purpose. A step-level rx split and a `variants:` entry
  // are the *same statement* about who lifts what, and as of 2026-08-18 they
  // resolve through one function — so their canonical forms and their trees
  // belong side by side, where a change to either shows up against the other.
  //
  // The at-rest text of both is unchanged by that work: resolving is something
  // a reader asks for, never something `fmt` does. A file that states two
  // divisions still states two divisions after a round trip.
  { group: 'divisions', name: 'rx split alone', src: 'for time:\n  - 30 Clean & Jerk (women 105lb / men 145lb)' },
  { group: 'divisions', name: 'rx split unlabelled', src: 'for time:\n  - 30 Clean & Jerk (105/145)' },
  { group: 'divisions', name: 'movement-keyed table', src: 'for time:\n  - 21 Thruster @ 95lb\nvariants:\n  scaled:\n    thruster: 65lb' },
  { group: 'divisions', name: 'table swaps a movement', src: 'for time:\n  - 21 Pull-Up\nvariants:\n  scaled:\n    pull-up: Ring Row' },
  { group: 'divisions', name: 'table with a load and a height', src: 'for time:\n  - 100 Wall Ball @ 9kg to 10ft\nvariants:\n  women:\n    wall-ball: 6kg to 9ft' },
  // Both mechanisms in one file, which is the case the resolver has to order.
  { group: 'divisions', name: 'split and table together', src: 'for time:\n  - 30 Clean & Jerk (women 105lb / men 145lb)\nvariants:\n  women:\n    clean-and-jerk: 95lb' },
  // A split on a *header*, where the grammar has no rule for one. It is not an
  // rx split — it is a target whose text happens to contain a slash — and it is
  // pinned so the difference from the step form above is visible rather than
  // inferred. `check` asks which reading is meant; see validate.test.ts.
  { group: 'divisions', name: 'slash load on a header', src: '3 rounds @ 95/65:\n  - 10 Thruster' },
  { group: 'divisions', name: 'paren split on a header', src: '3 rounds (women 105lb / men 145lb):\n  - 10 Thruster' },

  // --- rest ---
  { group: 'rest', name: 'duration', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 3min' },
  { group: 'rest', name: 'seconds', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 90s' },
  { group: 'rest', name: 'bare minutes word', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 3 m' },
  { group: 'rest', name: 'as needed', src: '5 sets:\n  - 1 Snatch\n  rest as needed' },
  { group: 'rest', name: 'equal to work', src: '5 sets:\n  - 30s Bike\n  rest = work' },
  { group: 'rest', name: 'equal to work words', src: '5 sets:\n  - 30s Bike\n  rest equal to work' },
  { group: 'rest', name: 'after last', src: '5 sets:\n  - 30s Bike\n  rest 1min after last' },
  { group: 'rest', name: 'active recovery', src: '5 sets:\n  - 400m Run\n  rest 400m Jog' },
  { group: 'rest', name: 'threshold', src: '5 sets:\n  - 500m Row\n  rest until HR < 120bpm' },
  { group: 'rest', name: 'threshold zone', src: '5 sets:\n  - 500m Row\n  rest until HR < Z2' },
  // A rest line is the one place a duration's internal spacing is free, because
  // no movement name follows it for the spaces to be confused with —
  // `parseDuration` strips whitespace before matching. Pinned so that licence is
  // a stated property rather than a side effect of one `replace`.
  { group: 'rest', name: 'loose spacing', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 1 min 30 s' },
  { group: 'rest', name: 'bare minutes', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 3' },
  { group: 'rest', name: 'clock', src: '5 sets:\n  - 5 Back Squat @ 225lb\n  rest 1:30' },
  // `after last` on **every** spelling of every bound, and that breadth is the
  // point rather than thoroughness for its own sake. All of these always parsed
  // correctly and four of them were then **lost by the formatter**: `restText`
  // returned early for `as needed`, `= work`, active recovery and a threshold,
  // so only a plain duration ever had ` after last` appended. `wdl fmt` quietly
  // turned "rest only after the last round" into "rest between every round",
  // which is a different workout, and `wdl check` said ok. Invisible to the
  // fixpoint check, because the *second* format of the shortened line is stable —
  // one more way a round trip proves stability and not correctness. Found
  // 2026-08-15 by writing these permutations while stating the rest line in the
  // grammar; **fixed 2026-08-15** by appending `after last` once, outside the
  // branch on the bound, because it is a fact about *which* rest and not about
  // how long it is. The alternate spellings are here because the defect was one
  // branch missing a line: a fix that reaches four branches and not the fifth
  // spelling of one of them is the same bug wearing different clothes.
  { group: 'rest', name: 'as needed after last', src: '5 sets:\n  - 1 Snatch\n  rest as needed after last' },
  { group: 'rest', name: 'equal to work after last', src: '5 sets:\n  - 30s Bike\n  rest = work after last' },
  { group: 'rest', name: 'equal to work words after last', src: '5 sets:\n  - 30s Bike\n  rest equal to work after last' },
  { group: 'rest', name: 'active recovery after last', src: '5 sets:\n  - 400m Run\n  rest 400m Jog after last' },
  { group: 'rest', name: 'threshold after last', src: '5 sets:\n  - 500m Row\n  rest until HR < 120bpm after last' },
  { group: 'rest', name: 'threshold zone after last', src: '5 sets:\n  - 500m Row\n  rest until HR < Z2 after last' },
  { group: 'rest', name: 'seconds after last', src: '5 sets:\n  - 30s Bike\n  rest 90s after last' },
  { group: 'rest', name: 'clock after last', src: '5 sets:\n  - 30s Bike\n  rest 1:30 after last' },
  { group: 'rest', name: 'bare minutes after last', src: '5 sets:\n  - 30s Bike\n  rest 3 after last' },
  { group: 'rest', name: 'loose spacing after last', src: '5 sets:\n  - 30s Bike\n  rest 1 min 30 s after last' },
  // No bound at all, only `after last`. Legal — `restBody` is optional — and the
  // one form where the fix could have left a double space behind, which is why
  // the pieces are joined rather than concatenated.
  { group: 'rest', name: 'after last with no bound', src: '5 sets:\n  - 30s Bike\n  rest after last' },
  // Spelled-out duration words, which worked in a *step's* quantity position and
  // in none of these. `45 seconds Plank` was 45 seconds; `rest 45 seconds` was an
  // `unreadable rest duration` error **and** a rest with no bound at all, which
  // reads as unbounded — so the line meant the opposite of what it said. Spec §3
  // says these spellings are accepted "wherever a duration is expected", and a
  // rest is a duration position, so the prose was right and the parser was wrong.
  // Found 2026-08-15 by typing lines into the browser; **fixed 2026-08-15** by
  // folding the spellings inside `parseDuration`, where a duration means the same
  // thing in every position, rather than in the one caller that happened to know.
  //
  // Every spelling of every unit is here, singular and plural and abbreviated,
  // because the defect was exactly a list that reached one caller: a fix that
  // covers `seconds` and not `secs` is the same bug with a shorter list.
  { group: 'rest', name: 'spelled-out seconds', src: '5 sets:\n  - 30s Bike\n  rest 45 seconds' },
  { group: 'rest', name: 'spelled-out second singular', src: '5 sets:\n  - 30s Bike\n  rest 1 second' },
  { group: 'rest', name: 'spelled-out secs', src: '5 sets:\n  - 30s Bike\n  rest 30 secs' },
  { group: 'rest', name: 'spelled-out sec', src: '5 sets:\n  - 30s Bike\n  rest 45 sec' },
  { group: 'rest', name: 'spelled-out minutes', src: '5 sets:\n  - 30s Bike\n  rest 2 mins' },
  { group: 'rest', name: 'spelled-out minutes long', src: '5 sets:\n  - 30s Bike\n  rest 3 minutes' },
  { group: 'rest', name: 'spelled-out minute singular', src: '5 sets:\n  - 30s Bike\n  rest 1 minute' },
  { group: 'rest', name: 'spelled-out hours', src: '5 sets:\n  - 30s Bike\n  rest 1 hour' },
  { group: 'rest', name: 'spelled-out hours plural', src: '5 sets:\n  - 30s Bike\n  rest 2 hours' },
  // Compound, which is what makes the fold global rather than anchored to the end
  // of one token: anchored, this would read the hours and drop the minutes.
  { group: 'rest', name: 'spelled-out compound', src: '5 sets:\n  - 30s Bike\n  rest 1 hour 30 minutes' },
  { group: 'rest', name: 'spelled-out seconds after last', src: '5 sets:\n  - 30s Bike\n  rest 45 seconds after last' },
  // And the neighbour that must **not** move: a spelled-out duration with a
  // movement after it is still active recovery, not a bound with a name left
  // over. `looseDuration` is tried first and `~moreRest` is what hands this back.
  { group: 'rest', name: 'spelled-out active recovery', src: '5 sets:\n  - 400m Run\n  rest 45 seconds Plank' },

  // --- overlays and nesting ---
  { group: 'structure', name: 'interrupt overlay', src: 'AMRAP 20min:\n  - 10 Burpee\n  every 1min: 5 Push-Up' },
  // The overlay's interval states the same bound a clock-driven block header does
  // (spec §5.5, §5.8) — count, window, failure, or nothing — read off the
  // grammar's own `every` production and carried on the `Interrupt` in the field
  // names `Block` uses for a clock. Until 2026-08-29 a bespoke one-token regex in
  // `parseNode` could not see past the first token, so `every 90s x 5: …` fell
  // into the "`<header>:` opens a block" diagnostic and the bounded overlay was
  // unwritable on one line. The unbounded twin stays beside them so the contrast
  // is pinned.
  { group: 'structure', name: 'interrupt overlay unbounded', src: 'for time:\n  - 100 Thruster @ 135lb\n  every 1min: 5 Burpee' },
  { group: 'structure', name: 'interrupt overlay until failure', src: 'for time:\n  - 100 Thruster @ 135lb\n  every 1min until failure: 5 Burpee' },
  { group: 'structure', name: 'interrupt overlay x count', src: 'for time:\n  - 100 Thruster @ 135lb\n  every 90s x 5: 3 Power Clean @ 185lb' },
  { group: 'structure', name: 'interrupt overlay for a window', src: 'for time:\n  - 100 Thruster @ 135lb\n  every 90s for 12min: 3 Power Clean @ 185lb' },
  { group: 'structure', name: 'choice block', src: 'for time:\n  choice:\n    - 1000m Row\n    - 800m Run\n    - 2000m Bike' },
  { group: 'structure', name: 'inline brace body', src: '8 rounds: { work 20s: Pull-Up, rest 10s }' },
  // A nested block written with a leading `- `. These four were pinned as
  // *correct* while dropping everything under the dashed line: `- AMRAP 3min:`
  // matched the step branch of the dispatch before anything looked at the colon,
  // so it became a movement literally named `AMRAP 3min:` and its children — a
  // whole block's worth of work — went nowhere, with `wdl check` reporting ok.
  // `deep nesting` was the visible one: it formatted to `conditioning:\n  - 3
  // rounds:s`, the pluralizer putting an `s` on a name ending in a colon, in the
  // same family as the `)s` the rx-split defect used to write. **Fixed
  // 2026-08-15** by stating which of spec §2's two rules wins: the colon.
  { group: 'structure', name: 'nested blocks', src: '3 rounds:\n  - AMRAP 3min:\n      - 10 Burpee\n  rest 1min' },
  { group: 'structure', name: 'deep nesting', src: 'conditioning:\n  - 3 rounds:\n      - AMRAP 2min:\n          - 5 Pull-Up' },
  { group: 'structure', name: 'many top-level blocks', src: 'warmup:\n  - 400m Run\nstrength:\n  - 5 Back Squat @ 225lb\nconditioning:\n  - AMRAP 10min:\n      - 10 Burpee' },
  // The dashless spelling beside it, which is what the corpus, the spec and
  // `format` all write, so the two are pinned as producing the same tree.
  { group: 'structure', name: 'nested blocks, no dash', src: '3 rounds:\n  AMRAP 3min:\n    - 10 Burpee\n  rest 1min' },

  // --- partner rotation (spec §5.11.1) ---
  // Two athletes, two pieces of work at once, then they swap. Its own kind
  // rather than a `team of 2` qualifier, because §5.11 declines a team
  // `alternating` on the grounds that it does not generalise to a team of N —
  // an argument a block that is two athletes by definition never has to answer.
  { group: 'partner', name: 'partner rotation', src: 'partner rotation:\n  - 150ft Sled Rope Pull\n  - 1 Dead Hang' },
  { group: 'partner', name: 'partner rotation inside rounds', src: '3 rounds:\n  - 8-12 Toes-to-Bar\n  partner rotation:\n    - 150ft Sled Rope Pull\n    - 1 Dead Hang' },
  // Loads, notes and laterality behave as they do anywhere else — the block
  // changes who does the work and when, not how a step is written.
  { group: 'partner', name: 'partner rotation with a load and a note', src: 'partner rotation:\n  - 100ft Farmers Carry @ 2x24kg\n  - 1 Dead Hang, note: "hang while your partner walks"' },
  // Three is a reported error, not a longer rotation: with two athletes the
  // third has nobody to work alongside, so the block's claim would be false.
  { group: 'partner', name: 'partner rotation with three', src: 'partner rotation:\n  - 150ft Sled Rope Pull\n  - 1 Dead Hang\n  - 10 Burpee' },
  // The neighbour that must not move: `team of 2` still means what it meant,
  // and its qualifiers are untouched by any of this.
  { group: 'partner', name: 'team of 2 beside it', src: 'team of 2:\n  - 100 Wall Ball @ 20lb shared\n  - 40 Burpee each' },

  // --- lines that were never indented (spec §2) ---
  // Forgiveness at the input edge: a container adopts what was written flat under
  // it, and `wdl fmt` writes the indentation back. Before 2026-08-15 every one of
  // these read as an **empty block followed by loose steps** — `wdl check` said
  // only "amrap block is empty", and one `wdl fmt` then indented the steps under
  // it and produced a different workout. Wrong *and* unsettled.
  { group: 'adoption', name: 'flat block', src: 'AMRAP 12min:\n5 Pull-Up\n10 Push-Up\n15 Air Squat' },
  { group: 'adoption', name: 'flat block, blank line between', src: 'AMRAP 12min:\n\n5 Pull-Up' },
  // A rest is not a container either, so it is adopted like any other line.
  { group: 'adoption', name: 'flat block with a rest', src: '5 sets:\n30s Bike\nrest 1min' },
  // The terminator: a container line closes a populated one *if it is flat too*.
  // A step never can, which is what makes the block above hold three steps.
  { group: 'adoption', name: 'a container ends a flat block', src: 'AMRAP 12min:\n5 Pull-Up\nfor time:\n21-15-9 Thruster' },
  // And the half-indented file, which is the shape a real workout turned out to
  // have: the AMRAP indents its own body but was never indented under the
  // `for time:`, so it is *in* the flat run rather than beside it. **The first
  // version of this rule had every container line terminate**, and read this as
  // three top-level things — a for-time holding one run, a loose AMRAP, and a
  // loose row. Found 2026-08-15 by typing it into the builder; no test saw it.
  { group: 'adoption', name: 'a half-indented block is inside the run', src: 'For time:\n- 800m Run\nAMRAP 20min:\n  - 10 Push Press\n  - 30 Air Squat\n- 30cal Row' },
  // The cost of that rule, pinned rather than left to be discovered: in a
  // half-indented file nothing returns to the outer level, so `cooldown:` lands
  // inside `conditioning:`. Indent `conditioning:`'s body to say otherwise.
  { group: 'adoption', name: 'a half-indented file does not come back out', src: 'conditioning:\nAMRAP 12min:\n  - 5 Pull-Up\ncooldown:\n  - 5min Walk' },
  // The cascade: an empty container cannot be anyone's sibling, so a container
  // arriving directly under one is its child rather than its terminator.
  { group: 'adoption', name: 'an empty container adopts a container', src: 'conditioning:\nAMRAP 12min:\n5 Pull-Up' },
  // Both rules at once, and the case the terminator is decided by: `cooldown:`
  // closes the AMRAP *and* the section that adopted it, landing where its own
  // indentation says. A section holding two blocks is the shape that costs —
  // it needs indentation, because this rule sends the second one to the root.
  { group: 'adoption', name: 'flat sections in order', src: 'warmup:\n500m Row\nconditioning:\nAMRAP 12min:\n5 Pull-Up\ncooldown:\n5min Walk' },
  // A score is not work, so adoption does not move it: an unindented `score:` is
  // at the top level, because that is where an unindented line is. It was
  // absorbed onto the block for half a day, which measured harmless here and was
  // *destructive* on a `for time:` — that header is stored as a sequence with an
  // implied `time` score, so a `score:` landing on it overwrote the header's own
  // kind and the block came back out as `sequence:`. Indent a score to put it on
  // a block.
  { group: 'adoption', name: 'a flat score is the workouts', src: 'AMRAP 12min:\n5 Pull-Up\nscore: rounds' },
  { group: 'adoption', name: 'a flat score and tiebreak together', src: 'For time:\n- 800m Run\nscore: rounds\ntiebreak: time' },
  // And what must **not** move: a file that *did* indent. A dedented line there
  // is a deliberate one and still leaves the block, which is the only reason
  // `score: time` under Fran stays the workout's and not the round's.
  { group: 'adoption', name: 'a deliberate dedent still leaves', src: 'AMRAP 12min:\n  - 5 Pull-Up\n- 10 Push-Up' },
  { group: 'adoption', name: 'a deliberate dedent still leaves, score', src: 'for time:\n  21-15-9:\n    - Thruster @ 95lb\n    - Pull-Up\n\nscore: time' },
];

/** Compare ASTs ignoring source position and comment placement. */
export function strip(v: any): any {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') {
    const o: any = {};
    for (const k of Object.keys(v).sort()) {
      if (k === 'line' || k === 'comments') continue;
      const s = strip(v[k]);
      if (s !== undefined && !(Array.isArray(s) && s.length === 0)) o[k] = s;
    }
    return o;
  }
  return v;
}

/** Wrap a bare step line in the smallest block that can hold it. */
export const wrap = (line: string) => `for time:\n  - ${line}`;

/**
 * Two different properties, and conflating them is how a wrong reading survives.
 *
 * `ast` pins what the input *means* — the correctness half. Only a pinned
 * interpretation catches a misreading: `10 Thruster @95lb` is a perfect text
 * fixpoint and a perfectly stable canonical form, and it is still wrong,
 * because the load became a flag. Nothing about round-tripping can see that.
 * A human reading `flags: ["95lb"]` in this snapshot's diff can.
 *
 * `fixpoint` pins that the canonical form is settled — the stability half.
 * Formatting once may legitimately change the tree (`Push-Up` is pluralized to
 * `Push-Ups`); formatting *twice* must not change anything.
 */
export function digest(src: string) {
  const first = parse(src);
  const canonical = format(first.workout).trim();

  const second = parse(canonical);
  const again = format(second.workout).trim();
  const third = parse(again);

  return {
    canonical,
    errors: first.errors.map((e) => `L${e.line} ${e.message}`),
    ast: strip(first.workout),
    fixpoint: canonical === again
      && JSON.stringify(strip(second.workout)) === JSON.stringify(strip(third.workout)),
  };
}

export function allCases(): { key: string; src: string }[] {
  const out: { key: string; src: string }[] = [];
  for (const { group, lines } of STEP_FORMS) {
    for (const line of lines) out.push({ key: `${group} :: ${line}`, src: wrap(line) });
  }
  for (const { group, name, src } of SOURCES) {
    out.push({ key: `${group} :: ${name}`, src });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const here = dirname(fileURLToPath(import.meta.url));
  const out: Record<string, unknown> = {};
  for (const { key, src } of allCases()) out[key] = digest(src);
  writeFileSync(join(here, 'vocabulary.json'), JSON.stringify(out, null, 1) + '\n');
  const cases = Object.values(out) as { errors: string[]; fixpoint: boolean }[];
  console.log(`snapshot written for ${cases.length} forms`);
  console.log(`  ${cases.filter((c) => c.errors.length).length} produce a parse error`);
  console.log(`  ${cases.filter((c) => !c.fixpoint).length} whose canonical form is not a fixpoint`);
  void readFileSync; // keep the import honest when the snapshot is only written
}
