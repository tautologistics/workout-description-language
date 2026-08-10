# Adversarial Review of the Planning Documents

Self-review, 2026-08-09, covering [workout_description_spec_development_plan.md](workout_description_spec_development_plan.md), [product_vision_and_roadmap.md](product_vision_and_roadmap.md), [prior_art.md](prior_art.md), and [movement_registry_design.md](movement_registry_design.md).

**Caveat:** written by the author of three of the four documents. Treat the "unverified claims" section especially skeptically.

**Meta-finding first.** Four planning documents, zero lines of code, zero real workouts encoded, zero evidence anyone wants this. Every finding below is downstream of that. The next artifact should produce evidence, not prose.

> **Update:** §E was carried out — see [falsification-corpus.md](../examples/falsification-corpus.md). A2 and A4 are **confirmed**; A3 is **confirmed** and generalizes into a broader expression mechanism. The corpus also found two gaps this review missed entirely: an **interrupt-overlay container** (Kalsu) and, more seriously, **workouts that are not timelines at all** (Murph, Hyrox Doubles) — see §D below. Section D's verdict stands, sharpened: the topology claim held 40/40; the sufficiency claim failed 16/40. Model corrections are folded into roadmap §2.

---

## A. Defects — decide before building

### A1. Content-hash identity breaks on formatter changes 🔴 — ✅ RESOLVED

> **Resolved** in roadmap §3.2.1. The fix is one rule: **an id is never derived from content.** An id is any unique string with an optional `namespace:` prefix (`crossfit:fran`, `hyrox:open-2026`), unique only within a repository — the format prescribes no generator and cannot enforce global uniqueness. Results embed a snapshot of the workout text, which makes them self-contained and doubles as the version record, so no revision numbering is needed. A semantic digest for dedup and benchmark recognition is an advisory tool feature, not a format concept.
>
> *An earlier draft of this resolution specified four identifiers, a ULID generator, and revision numbering. That was over-prescribed — snapshots make revisions unnecessary, and a human-writable namespaced string does the work of both opaque id and slug.*

The roadmap says results reference workouts by "content hash of the canonical form." But canonical output changes whenever the formatter changes — a bugfix, a spacing decision, any spec minor version that alters emission. When it does, **every hash changes and every historical result record's reference breaks.**

Content-hash identity is only stable if canonical output is frozen forever, which directly contradicts an evolving spec that isn't reaching 1.0 until several hundred workouts are encoded.

Options, roughly in order of preference:

1. **Assign a stable opaque ID at first publish** (UUID or short slug); use content hashing only for *dedup at import time*, never as the durable reference. Results reference the ID.
2. Hash a **normalized semantic AST** with a defined canonicalization independent of text formatting. Better than hashing text, but still breaks when the AST schema evolves.
3. Accept hash migration with a recorded chain of equivalences. Most work, most fragile.

Recommend option 1. This is cheap to fix now and very expensive after the first real result records exist.

### A2. The step model is missing at least one completion condition 🔴

§2.1 of the roadmap lists reps, distance, calories, duration, open. Real workouts need at least two more:

- **"Remainder of the enclosing container."** `Every 3 minutes: 400m run, then max-rep pull-ups in the time remaining.` This is extremely common in both CrossFit and interval training. It's not `open` — it has a hard end determined by the parent.
- **"Until failure."** Death-by / ascending EMOMs, AMRAP-to-failure, "build to a heavy single." The container's repeat count is *unbounded* and terminates on athlete failure, which also determines the score.

Both are structural, not cosmetic. `until failure` in particular means containers need dynamic exit conditions, which the current container taxonomy doesn't have.

### A3. No cross-block references 🟠

"Build to a heavy single, then 3×3 at 85% of today's single." A value established in one block is referenced by a later block. The model has no mechanism for this, and it's standard strength programming. Related: percentage loads referencing a stored 1RM (the spec plan flags this in §18 validation, but neither doc says where the reference max lives).

Probably needs an athlete-profile record plus intra-workout named values. Cheaper to design in now than to bolt on.

### A4. EMOM overflow is unspecified 🟠

What happens when the work in an EMOM minute isn't finished when the next minute starts? Every real implementation must answer this (cut off? bleed over? mark failed?), the answer differs by gym convention, and the display runtime cannot be built without it. Neither document addresses it. Same class of question: behavior at a time cap, and behavior when a capped for-time isn't completed.

### A5. Comment reattachment can silently lose data 🟠

Roadmap §3.1 says comments attach to AST nodes and survive re-emission. It doesn't say what happens when a GUI action deletes the node a comment was attached to. Silent comment loss from a button click is a bad first impression in a tool whose pitch is "your text, structured." Needs a defined orphan policy — hoist to parent, or refuse and warn.

### A6. Gym-local dialect has no home 🟠

The registry says `Erg` should be an ambiguity error listing rower/SkiErg/BikeErg. But in any specific gym there *is* a right answer, and the gym display product is precisely a gym-local context. There's currently no notion of a dialect or context file that resolves local defaults (`erg → rower`, bare `Thruster → barbell`, default box height). Without it, the ambiguity-is-an-error rule will be experienced as pedantry.

### A7. AST and result records have no versioning story 🟡

The spec plan versions the *language* (§20). But the AST is declared "the semantic contract" between core, adapters, builder, and display, and result records must survive years. Neither has a compatibility policy. If the AST changes shape at 0.4, what happens to a builder pinned to 0.3, or to stored results?

---

## B. Strategic risks

### B1. The plan tests format expressiveness, never demand 🔴

Milestones A–D are all format and tooling. The existential question isn't "can we express Fran" — it's "will anyone write workouts in a structured text format when every gym already types free text into SugarWOD, BTWB, or Wodify?"

The plan has no demand test and produces nothing usable for months.

Cheapest possible test, and arguably the real product: **the paste-in path, standalone.** Take whiteboard text people already write, parse it, show structure. The value proposition is "paste what you already have, get something useful," not "learn our syntax." If structure inference on real pasted text is good enough to be delightful, everything else follows. If it isn't, the format doesn't matter.

This argues for pulling a thin slice of Milestone C ahead of a complete Milestone B.

### B2. Scope is multi-year; no milestone is a stopping point 🔴

The documents collectively describe: a language, parser, formatter, validator, timeline compiler, a governed community movement registry, a web builder, a mobile app, a Raspberry Pi runtime, six adapters including a binary format, a sharing platform with accounts and leaderboards, and an analysis engine. Nothing acknowledges who is building this or in what time.

More importantly, **no milestone is defined as "stop here and it's still valuable."** A plan with no viable exits is a plan that fails all at once. Each milestone should name what it's worth on its own.

### B3. The registry has a chicken-and-egg problem 🟠

A "clearinghouse" with governance, community contribution, and permanence guarantees presumes adoption. Nobody contributes movement definitions to a format nobody uses. For a long time this will be one curated file maintained by one person — which is fine, but the doc's framing (governance, PR review, contribution funnel) overstates the near-term reality and risks over-engineering the tooling around it.

### B4. Adapters before scaling serves the segment that needs us least 🟠

Milestone D (adapters) precedes F (scaling and variants). But the endurance world is already well served — FIT, Zwift, intervals.icu, WorkoutKit all exist and work. The genuinely underserved case is CrossFit/Hyrox, where scaling and variants are central to how workouts are programmed and shared, and where nothing exists at all.

Building the FIT exporter first serves the audience with the most alternatives. Recommend swapping D and F, keeping only the cheapest importer (intervals.icu text, or `.zwo`) early as a corpus source.

### B5. "Forgiving input" and "deterministic semantics" are in unbounded tension 🟠

The spec plan's principle 2 demands unambiguous semantics; the roadmap promises to accept whiteboard shorthand including `95/65`, which the spec plan itself lists as ambiguous (§26). Every accepted shorthand widens the ambiguity surface, and there's no stated rule for where to stop.

There is already a good principle buried in the registry doc — *never guess, always ask* — applied to movement misspellings. It should be promoted to a global design principle covering loads, rep schemes, and structure inference alike: when input is ambiguous, the parser surfaces a question rather than picking. In the paste-in flow that becomes a feature ("we read this as Rx/scaled — correct?").

---

## C. Unverified claims

These were written confidently from search-result summaries rather than primary sources. Verify before planning around them.

- **FIT strength support.** The interop table calls `exercise_category` "limited." Garmin ships strength training on its watches, so rep-based workout steps may be considerably better supported than claimed. This materially changes the value of FIT export. Check the FIT SDK profile directly.
- **WorkoutKit has no reps/load concept.** If true, "export to Apple" is much weaker than the roadmap implies and should be demoted. Check `CustomWorkout` and iOS 26's workout builder against primary Apple docs.
- **The `.zwo` element list and intervals.icu syntax** came from a GitHub reference repo and a forum thread respectively. Fine for orientation, not for building a parser.
- **The prior-art conclusion "nothing covers metcons"** rests on web search. It's probably right, but a direct GitHub code search and a check of Wodify/SugarWOD/BTWB import documentation would harden it. A missed prior art here would be embarrassing and cheap to avoid.

---

## D. The one that undermines everything else

**The universal core model was never tested — it was constructed.** 🔴

Roadmap §2.3 presents a table mapping every modality onto a shared container set, and concludes the modalities "differ in which containers they favor, not in kind." But the table was written by deriving cases from the model, not by encoding real workouts and seeing what fit. That's circular: of course a model explains the examples chosen to illustrate it.

The claim is plausible and probably ~85% right. Its honest status is **hypothesis**, and the documents present it as a finding. Defects A2, A3, and A4 were all found by spending twenty minutes actively attacking it — which suggests more attacking would find more.

---

## E. Recommended next action

**Falsify the core model before building anything.** One day of work, no code:

Hand-encode 20 deliberately hostile workouts against the current model — not representative ones, hostile ones:

1. Build to a heavy single, then 3×3 at 85% of it *(A3)*
2. Death by burpees *(A2, until-failure)*
3. E3MOM: 400m run, then max-rep pull-ups in the remainder *(A2, remainder)*
4. Tabata, scored on the lowest round *(per-round scoring)*
5. A full Hyrox race including roxzone transitions
6. An EMOM where the work plausibly exceeds the minute *(A4)*
7. A 5/3/1 wave referencing a training max
8. Fight Gone Bad (rotating stations, continuous clock, shared rest)
9. A partner WOD with synchronized reps and a shared total
10. A zone-2 run with a mid-session ramp and pace targets
11. A chipper with a buy-in, a time cap, and a tiebreak time
12. A complex where load carries across movements without dropping the bar
13. …plus 8 more drawn from real whiteboard photos, chosen for messiness

For each: does it encode? What broke? What did you have to invent? Every failure is either a missing primitive or a genuine carve-out — and the count of carve-outs is the actual test of the universality thesis.

Then, in order: fix A1 (identity) since it's nearly free now and expensive later; settle A2 and A4 from what the corpus shows; and pull a thin paste-in prototype forward to test B1 before committing to the full Milestone B.
