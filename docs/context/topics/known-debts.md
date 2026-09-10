# Known debts

Things that are wrong, known to be wrong, and left that way for now. Check here
when something looks odd before treating it as a discovery.

## Security-audit findings (2026-09-10, `b76deb8`)

From the hardening sweep — full context, exploitability and recommended fixes
in [security-audit.md](security-audit.md). Every one below needs a PocketBase
migration + `make deploy:db` against the VPS, which a session does not do, so
all are **Chris's call**. The one fix that did land (H-2, `filter=` injection
in `apps/shared/pocketbase.js`) is not a debt — it is in commit `b76deb8`.

- **CRITICAL — the `users` collection has no access rules in version control.**
  No `deploy/pocketbase/pb_migrations/*.js` file sets `users` list/view/create/
  update/delete rules or any field-level guard on the M2 `admin` / L1 `org` /
  L1 `handle` fields; the live rules are PocketBase's auth-collection defaults
  plus a box-only snapshot (`1788125462_updated_users.js`) that is not in the
  repo. On the stock defaults a signed-in user can `PATCH` their own row
  `{ admin: true }` and gain write to `movements` / `equipment` / `patterns` /
  the `global` goals tier; if `createRule` is also stock-open and password auth
  is on, an anonymous `POST users/records { email, password, admin: true }`
  mints an admin outright. Fix: a migration that sets the `users` rules
  explicitly with `@request.body.admin`/`org` "can't change" guards, **and**
  commit the box's `1788125462_updated_users.js` snapshot so the schema is
  reviewable. Verify current box behaviour first (admin UI → `users` → API
  rules + Options).
  *Touches: `deploy/pocketbase/pb_migrations/` (a new migration),
  `deploy/README.md` §7a. DEC-020 / DEC-025 / DEC-028 assume admin is not
  self-assignable.*

- **HIGH — namespace keys (`wdlId` / `setId` / `goalId`) are client-forced
  only.** The `<owner-handle>:<slug>` rule (DEC-021 / DEC-027 / DEC-028) is
  enforced only in `apps/shared/pocketbase.js`; no collection rule constrains
  the value on write, and `workouts.wdlId` is a non-unique index. A raw
  `POST`/`PATCH` can set `wdlId: "crossfit:fran"` on an attacker-owned public
  row, which then appears in the builder's **Libraries** listing and can shadow
  the real row for `?w=crossfit:fran`. Content/attribution spoofing, not data
  theft. Fix: bind the key to `@request.auth.handle` in the create/update rule,
  or recompute it in a `pb_hooks` `onRecordCreate`/`onRecordUpdate`.
  *Touches: `1756600000_create_workouts.js`, `1757200000_create_movement_sets.js`,
  `1757400000_harden_goals_rules.js`. DEC-021 / DEC-027 / DEC-028 —
  implementation diverges, model is fine.*

- **MEDIUM — no mutating rule guards which fields change; `owner`/`user` can be
  reassigned on update.** `workouts` / `movement_sets` / `goals` update rules
  check *who* writes, never *what*. A user can `PATCH` their own row
  `{ owner: <org id> }` (compounds the HIGH above), and a `goals`
  `scope:"user"` owner may be able to `PATCH { scope: "global", user: null }`
  to inject into the ownerless `global` list — **needs a runtime check on the
  box** (pre- vs post-change rule evaluation). Fix: append
  `&& (@request.body.owner:isset = false || @request.body.owner = owner)`
  (and `user` / `scope` for `goals`) to each update rule.
  *Touches: the three create/harden migrations. DEC-028 (goals scope tiers).*

- **MEDIUM — handle shape / reserved-word validation is client-only.** The
  server enforces only the unique index and `max: 63`; `validateHandle` in
  `apps/shared/handle.js` (`^[a-z0-9-]+$`, 3–63, not all-digits, no `-` ends,
  reserved `api`/`admin`/`_`) has no server mirror. A raw `PATCH` can claim
  `handle: "admin"` (platform impersonation), a 1-char handle, an all-digits
  handle, or one containing `:` (poisons `<handle>:<slug>` parsing —
  `getByAnyId` splits on the first colon). Fix: regex + reserved-word guard in
  the same `users` migration as the CRITICAL, or a `pb_hooks` validator.
  *Touches: `apps/shared/handle.js` (client) + the absent `users` rule.
  DEC-021 says "rejected client- and server-side"; the server half was never
  built.*

- **LOW — `movement_sets` create rule relies on field validation, not an
  explicit `!= ""` guard.** `createRule = "@request.auth.id = owner"` is safe
  only because `owner` is `required` — the same shape that bit `goals` at G1
  when `user` was nullable. One schema change reopens it silently. Fix: align
  with `workouts` / `goals` — `@request.auth.id != "" && @request.auth.id =
  owner`.
  *Touches: `1757200000_create_movement_sets.js`. DEC-027.*

(The port-8090 plaintext exposure is a pre-existing entry — see
`deploy/README.md` "Known issue" and [what-exists.md](what-exists.md); the
audit confirms it still holds. Two Informational items — permissive default
CORS, `updateMovement` passing the patch body through under admin trust — are
in the audit doc only, not filed here.)

- Three singular/plural duplicates remain in the registry's long tail
  (`Hindu Push-up`, `Rack Pull`, `Squat with Bands`). Pinned by a test so the
  count cannot grow; none used by the corpus.
- **Fourteen names in the canonical merge are claimed by two records, and none
  of the pairs is a duplicate.** Decided 2026-08-23 by queue item 8, which
  fixed *who wins* rather than merging them: an explicit alias now outranks a
  record's own id, so the curator's claim on a contested spelling beats an
  imported record that merely happens to be named after it. `Squat` is
  `air-squat`, not the barbell `squat`; `Air Bike` was `bike`, and that pair was
  the trap — the imported `air-bike` record was the abdominal exercise, not the
  machine, so ranking was answering rightly for the wrong reason. *Corrected
  2026-08-23: the trap is gone. The abdominal exercise was split out into
  `Bicycle Crunch` and the machine merged into `Bike`, so one record now answers
  and it is the right one. One of the fourteen is left contested —
  `assaultbike`.* `node scripts/check-aliases.mjs` prints what is left with
  which record wins and why.

  What is still owed is the **curation** half: each pair needs a written verdict
  saying whether the two records are the same movement, and `dumbbellbicepscurl`
  — `Dumbbell Bicep Curl` against `Dumbbell Curl` — is the one no rule can
  answer, because both records hold it only as an alias and neither as a name.
  It resolves `ambiguous`, which is correct and is also what it did before, and
  it is the only member of the list that does. Ranking cannot decide whether two
  records are one movement; only a curator can.
  *Touches: `registry/movements.json`, `scripts/dedupe-movements.mjs`.*
- ~~`Quad Stretch` scored into the 178 core movements on source agreement.~~
  **Fixed 2026-08-23** by queue item 4. It was never a threshold problem: raising
  the bar to 5 would have dropped `Sumo Deadlift`, `Face Pull` and `Pistol` and
  kept `Smith Machine Squat`, because the two are not ordered on the same axis.
  `commonality` says how well *attested* a record is, which is what dedup needs;
  the pool asks whether anyone has treated it as *work*, and catalogue agreement
  cannot answer that. So the pool now takes only the three signals that are a
  judgement — a corpus workout writes it, the curator wrote a record for it, a
  vendor tracks a 1RM for it — and the threshold is gone with them, because at +3
  against a bar of 4 curation could never carry a record on its own. **178 → 129.**
  The score is untouched and still cuts dedup. What the old rule let in is the
  argument: all 77 records it admitted on catalogue evidence alone had **no
  `pattern`**, so `? squat` could not reach them — they were reachable only by
  being picked blind. See [what-exists.md](what-exists.md) and the header of
  `scripts/mark-core.mjs`.
- ~~The board cannot have a division *chosen* on it.~~ **Fixed 2026-08-20** by
  queue item 1a. A workout that offers a division shows a picker in the footer,
  built from `divisions()`; choosing one re-cues from `resolve()` **from where
  the reader stands**, keeping the cursor, the clocks and the lap count. The
  choice rides in the hash beside the workout, so it survives a reload and
  travels with the share link. *The builder is still deliberately not part of it:
  a split says both sides are the prescription, and hiding one while authoring is
  a way to write a split and never look at it.*
- The board fetches the whole 1.7MB canonical merge to answer one question.
  `resolve()` proves a `variants:` value that is a **movement to swap in** against
  the registry, and `Ring Row` — spec §10's own example — is only in the merge, so
  without it the board reported a real movement as *not a movement in the
  registry*: a false statement, not merely a missed swap. Raised and half-fixed
  2026-08-20 by queue item 1a. The fetch is lazy and narrowly triggered — only
  once the resolver has actually said it could not read a value, so a table of
  loads like the HYROX file never pays, and it happens at most once per board —
  but a board that does hit it downloads 1.7MB for a **name lookup**. What the
  resolver wants from that file is titles and aliases; a slim name index built
  beside it in `build-canonical.ts` would answer the same question for a fraction
  of the bytes, and would let the board simply fetch it up front.
  *Touches: `scripts/build-canonical.ts`, `apps/display/board.js`,
  `packages/core/src/registry.ts`.*
  *Correction 2026-08-23: `Ring Row` is a curated record now — queue item 4 wrote
  one so the pool could reach a horizontal pull — so the example above no longer
  reproduces. The debt is unchanged; only the movement that demonstrated it is.*
  *Correction 2026-08-23: queue item 7's body map needs a muscle attribution for
  every cue of every workout, not one name lookup, so "lazy and narrowly
  triggered" stopped being true of the whole file that day — the board now
  fetches the 1.7MB merge (and `registry/muscles.json` beside it) unconditionally,
  though still not awaited, so the map fills in a moment after the board is
  otherwise usable rather than holding anything up. `wantCanonical()` is
  unchanged and still exists for the case this entry describes; it is now
  usually a no-op because the eager fetch already landed first. The slim
  name-index fix below would still shrink both call sites, and now has two
  reasons to happen instead of one.*
- A `variants:` value that is a **rep or distance override** is reported and not
  applied. Spec §10 says a variant may override reps or distance; `resolve()`
  reads a load, a load-plus-height, or a movement to swap, and says so by name
  for anything else. Deliberate as of 2026-08-18 — a quantity override needs the
  quantity grammar in a value position, which is a grammar change, not a
  resolver one.
- **A result's loads are keyed by movement, so one number covers every step of
  that movement.** `- Back Squat @ 100kg` applies to all of them, and a session
  that ramped 60 → 80 → 100 can only record the one figure. This is exactly the
  information loss `variants.ts` refused when it kept an rx split on the *step*
  rather than lowering it into the movement-keyed table — and here it is
  unavoidable in the same way it was avoidable there, because a result has no
  step to hang a number on: it names a movement, not a position in a file. The
  fix, if it is ever wanted, is for a `loads:` entry to be able to say *which*
  one — by line, by set, or by writing several. Nobody has asked yet, and
  inventing the spelling before somebody has recorded a real build is how the
  wrong one gets in. Raised 2026-08-23 with queue item 2.
  *Touches: `packages/core/src/result.ts`, `spec/results-0.1.md`.*
- **The board decides a step is loaded by looking for an `@` in the cue's
  label.** It offers a commented `loads:` skeleton for movements the file
  prescribes a weight for, and a `Cue` carries `movement`, `quantity` and
  `label` but not `targets` — so the honest question cannot be asked without a
  core change, and a regex over rendered display text is standing in for it. The
  cost is bounded: a false positive is one extra comment line in a record, and a
  false negative is one missing hint. But it is precisely the shape this project
  removed from `parse.ts`, sitting in an app instead. Raised 2026-08-23.
  *Touches: `packages/core/src/run.ts`, `apps/display/board.js`.*
- Templates and workouts share the `.wdl` extension, so `wdl fmt` on a template
  is easy to do by accident. *The other three record types no longer are: as of
  2026-08-23 each verb states what its file arguments are, and `wdl fmt -w` on a
  `.wdlr` refuses instead of parsing a training log as steps and writing the
  mangling back. The extension is the whole of the check, because sniffing the
  contents would be a fifth grammar guessing at the other four — which leaves a
  template, whose extension is honest, exactly where it was.*
- ~~`state.window` in `apps/display/board.js` is assigned and never read.~~
  **Closed 2026-08-23** by queue item 9: deleted rather than kept beside the cap
  that replaced it — `state.cap` is what `tick()` reads now.
- ~~A capped for-time workout reports `duration: 12:00` in the builder.~~
  **Closed 2026-08-23** by queue item 3. `Timeline.cap` and `Run.cap` hold the
  bound, `estimatedSeconds` and `totalSeconds` hold the length, and neither
  stands in for the other; the builder and `wdl timeline` say `duration:
  athlete-paced` and `cap: 12:00 at most` on two rows. See
  [what-exists.md](what-exists.md).
- **A cap that bounds only part of the workout surfaces as nothing at all.**
  `spineCap()` counts a cap only where it and every group above it is an only
  child, the same rule `window` follows, so `for time, cap 12min:` beside a
  five-minute run reports no cap — and that workout genuinely is *at most
  seventeen minutes*. The competing branch closed on 2026-08-23 argued the rule
  is wrong for this fact: a window and a loop do not compose, because putting a
  20-minute AMRAP beside a run gives no clock covering both, but an at-most
  **aggregates** — every sum a ceiling feeds into is a ceiling. Its conclusion
  was that the general rule is *whatever composition the fact actually has*, and
  that the spine is merely what that comes to for facts which cannot compose.
  Recorded rather than acted on: the spine rule is what the merged code does and
  what its tests pin, and changing it means deciding what a partial bound should
  say on a surface that today has one row for the whole workout. The argument is
  the expensive half and would have been lost with the branch.

- ~~**An unrecognized `measure:` in a goal file was silently swapped for the
  default.**~~ **Closed 2026-08-19.** `DIMENSIONS[written] ?? fallback` meant
  every unread spelling became the default, so `measure: load` parsed with no
  error and produced a **rep** check — a rule asking to ramp weight quietly asked
  to ramp repetitions, and `measure: repss` did the same. Now an unread measure
  is reported by name, lists what the language does measure, and the rule is
  dropped rather than run against something else: a rule answering a question
  nobody asked is worse than a missing one. A *missing* `measure:` still takes
  the default, since that is the author declining to choose. Found 2026-08-19
  while checking whether the goal report changes under a division — it does not,
  and [settled-decisions.md](settled-decisions.md) says why that is right.

- ~~**Step-level `rx` and workout-level `variants:` are two mechanisms for one
  idea, and an `rx` split shows no weight in either app.**~~ **Closed
  2026-08-18** by queue item 1. `divisions()` and `resolve()` in
  `packages/core/src/variants.ts` are the one place both are read, `--variant`
  reaches `fmt`, `check`, `timeline` and `export` through a single hook, and the
  cue renders an unresolved split so a step always says a weight. Two things the
  debt as written did not predict. **The lowering went into the resolver, not
  into the table** — a `variants:` entry is keyed by *movement*, so rewriting a
  split into one would collapse two Thruster steps at different splits into
  whichever was written last; see [settled-decisions.md](settled-decisions.md).
  And **the display fix was not a free consequence of resolving**: the apps never
  choose a division, so "the load arrives through `targets`" never happens there
  and the cue needed its own branch after all.

- ~~**`@` with no space after it silently destroys the load.**~~ **Closed
  2026-08-15** by queue item 0a, the swap. `- 10 Thruster @95lb` used to read
  `95lb` as a *flag*: `/@(\w[\w-]*)/g` ran over the whole line before the `@`
  split and `\w` matches digits, so the load never reached `targets` — invisible
  to muscle and volume analysis, to the builder and to the board — while
  `wdl check` reported `ok` and `wdl fmt` rewrote the line to
  `- 10 Thrusters, 95lb`, a stable fixpoint of the wrong reading. No corpus file
  writes `@` without a space, which is why 1257 tests never saw it; the grammar
  exploration found it.

  **The rule, stated in `spec/grammar-0.1.ohm` and now the only reading there
  is:** the first character after the `@` decides. A letter opens a flag, a digit
  opens a target. So `@95lb`, `@ 95lb`, `@95` and `@ 95` all read the same way,
  and the presence of a unit has nothing to do with it — the earlier phrasing of
  the fix ("a flag is `@` not followed by a space") was half of it and would have
  left `@95` a flag called `95`. The flag form does still require the `@` tight
  against the word, because a *spaced* target legitimately begins with a letter —
  `@ Z2`, `@ RPE 8`, `@ of heavy-single` — so `@ tiebreak` is a target, stated
  rather than left to rule ordering. `spec-0.1.md` §7 says all of this too.

  Six forms were pinned as `known-wrong` and are now `was-wrong` in
  `test/golden/vocabulary.ts` — `@95lb`, `@2x35lb`, `@24kg`, `@95`, `@85% 1RM`
  and `18 Thruster @115lb @tiebreak` — with what each used to do kept beside what
  it does now. Two of them were worse than a lost load: `@85% 1RM` stopped the
  flag at the `%` and left `% 1RM` in the movement name, formatting to
  `10 Thruster % 1RMs, 85`. The rule itself is asserted directly in
  `test/grammar.test.ts`, because with one implementation left there is no
  disagreement to read it off.

- **Resolved 2026-09-01 (`6829052`): a unitless load magnitude is pounds.**
  `parseTarget` now fills `unit: 'lb'` for a bare `@ <number>`, so `@ 95` parses
  to `{kind: 'load', load: {kind: 'absolute', unit: 'lb', value: 95}}` and
  `wdl fmt` rewrites it to `@ 95lb`. The reasoning below (a defaulted unit is an
  invention) was the holding position for ten months; Chris overrode it —
  pound is the dominant convention for a load that omits its unit, which by
  design rule 3 makes it a documented default rather than a guess. Recorded here
  as a correction, not by deleting the original argument. Distance still requires
  its unit. Full decision: [settled-decisions.md](settled-decisions.md) DEC-022.
  *The rest of this entry is the pre-resolution record.*

- **Open: what a target with no unit means — decided 2026-09-01, implementation
  queued.** `@ 95` parses to `{kind: 'raw', text: '95'}` — held verbatim,
  meaning nothing. That was deliberate as of 2026-08-15 and pinned as a
  vocabulary case, on the reasoning that a defaulted unit would be an invention
  (`@95` is 95lb in one gym and 95kg in another). **Chris has now settled it:
  the default is `lb`** — `@ 95` reads as `95lb`, pound being the default for
  any movement that carries a load. (A unitless magnitude on a machine/aerobic
  non-load movement is *not* silently defaulted — the **builder** shows a
  suggesting diagnostic ("did you mean `15cal`?") and the **board stays
  agnostic**; Chris's call, 2026-09-01.) The `@ 95` → `95lb` implementation
  (spec §3/§7, grammar, parser, `Load` handling, golden files, the six pinned
  `was-wrong` vocabulary forms) is the **"unit defaults" standalone task** in
  [../tasks/current.md](../tasks/current.md). Until it lands, `@ 95` is still
  `raw` in the code — this entry is the record that the *reading* is decided,
  not the reason it stays raw.

- ~~**A target written after a comma is filed as a note.**~~ **Closed 2026-08-15**
  by the swap. `- 10 Thruster, @ 95lb` used to put `@ 95lb` in `notes`, not
  `targets`: the `@` split ran over the *first* comma segment only, so
  `applyQualifier` never saw a target and fell through to its catch-all. Same
  consequence as the `@95lb` entry above — the load invisible to analysis, the
  builder and the board, `wdl check` saying `ok`, and the wrong reading a perfect
  fixpoint. Found 2026-08-15 by `test/grammar.test.ts`, which read it as a target
  the same day. The grammar reads an `@` group wherever it appears; three forms
  are pinned under `was-wrong`.

- ~~**The browser cannot resolve `ohm-js`.**~~ **Closed 2026-08-15**, before item
  0c rather than with the swap, because there was one import site to change and
  0c adds more. `ohm-js` is vendored into `packages/core/src/grammar/vendor/` and
  imported by relative path; the grammar module now loads and parses in both
  apps, confirmed by loading it. The guardrail that missed it — `portable.test.ts`
  looked for `node:` imports, and this was a bare specifier — now fails on any
  non-relative specifier, and so does `build-web.mjs`. See
  [settled-decisions.md](settled-decisions.md).

- ~~**An rx split with a space-separated qualifier after it is swallowed into the
  movement name.**~~ **Closed 2026-08-15** by the swap, and it was the worst of
  the three. `- 10 Deadlift (105/145) each arm` used to parse to a movement
  literally named `Deadlift (105/145)`, because `peelRx` only fired at the end of
  a comma segment so the paren never left the name. Both loads were lost, and the
  name matched no registry entry — so unlike the `@95lb` family the step also
  dropped out of muscle and volume analysis, and the builder showed an
  unregistered movement. `wdl fmt` then pluralized the name it was handed and
  wrote `10 Deadlift (women 105lb / men 145lb)s each arm`, a `)s` on the
  whiteboard. With a *flag* rather than a laterality it did not even settle:
  `10 Deadlift (105/145) unbroken` formatted to
  `10 Deadlifts (105/145), unbroken`, and the comma spelling reparsed *as an rx*
  — one pass of the formatter lost the loads and the next found them, which is
  why it was the only entry in `KNOWN_UNSETTLED`. Found 2026-08-15 by parsing a
  line in the browser while checking the vendored engine. Five forms pinned under
  `was-wrong`, two correct neighbours under `rx-by-division`, and
  `KNOWN_UNSETTLED` is empty.

- ~~**A header target written after a comma is filed as a flag.**~~ **Closed
  2026-08-15** by the swap. `3 rounds, @ 95lb:` used to put `@ 95lb` in `flags`,
  not `inherited`, so nothing under the block inherited the load. The `@` sweep in
  `parseHeader` ran over the *first* comma segment only, exactly as the
  step-level one did, and `applyBlockModifier` fell through to its catch-all. The
  header twin of the `10 Thruster, @ 95lb` entry above, with the same
  consequences and the same fix: the grammar reads an `@` group as an inherited
  target wherever it appears. Found 2026-08-15 by stating the block header in the
  grammar; it was the one header exclusion, and that list is empty now.

- ~~**`5x5 Back Squat @ 225lb` parses to a movement named `5x5 Back Squat`.**~~
  **Closed 2026-08-15** by queue item 0e. Leading `sets x reps` — the way gyms
  write it, and the way **spec §1's own design rule 4 writes it**, as the example
  for "must stay a one-liner" — was read by neither implementation.
  `parseQuantity` matched no pattern on `5x5`, so the whole thing fell through
  into the movement name, the quantity stayed `open`, the name resolved to
  nothing — which took the step out of muscle and volume analysis, one worse than
  a lost load — and `wdl fmt` wrote it straight back. The *trailing* spelling
  worked (`3 Bench Press @ 80% 1RM x5`), which is what hid it. Found 2026-08-15 by
  widening the differential test's step source to the vocabulary's whole-document
  forms.

  **The decision was small because the form says nothing new.** `3x10 Curl` is
  `10 Curl x3`: sets, then reps, in the order every gym writes them. It sets
  `sets` and the rep count and adds no third concept, so nothing downstream
  changes — `sets` reaches exactly two consumers, `format` (which writes ` x3`)
  and `timeline.ts` (which expands it into that many identical repetitions), so
  rep totals come out right for free. The two spellings now produce the same tree,
  and that is pinned rather than described. Written *both* ways
  (`5x5 Back Squat x3`) the trailing one wins, because it is read later and "the
  later qualifier wins" is already the settled reading for every other part of a
  step stated twice; it is pinned because leaving it to fall out of rule ordering
  is how a fixture ends up deciding a language question.

- ~~**Found while closing the one above: `10x Curl` is not read.**~~ **Closed
  2026-09-03.** Spec §3's unit table documents `10x` as a rep spelling (`Reps |
  10 | 10 reps, 10x`) and no implementation had ever read it — it fell into the
  movement name exactly as `3x10` used to. It was deliberately not folded into
  that fix because reading it meant deciding whether a bare `Nx` is reps
  everywhere or only in a leading position, and `Nx` sits one character from
  `NxM`. **Chris settled it 2026-09-03: a *leading* `Nx` reads as the plain
  number** — `10x Curl` is `10 Curl`, no `sets` (`NxM` is the sets-by-reps form
  and is matched first, so `10x5` is unaffected); a *trailing* `x3` stays a set
  count. `leadQuantity` in `spec/grammar-0.1.ohm` grew an `xReps` alternative,
  `leadQuantity_xReps` in `step-semantics.ts` maps it to `{kind:'reps'}`, spec
  §3's prose (§ "SxR before the movement") updated, the `sets-by-reps :: 10x
  Curl` vocabulary golden re-pinned to the right reading and its `KNOWN_WRONG`
  entry removed — `make test` **2064/2064, 0 pending** (was 1). A trailing bare
  `10x` (`Curl 10x`, no movement after) is still left in the name: degenerate,
  and out of the leading-position scope Chris named. No corpus movement, so
  `interpretations.json` / `registry/workouts.canonical.json` did not move.

- ~~**`for time, 3 rounds:` drops the three rounds in silence.**~~ **Closed
  2026-08-16** by queue item 0f's second half. It used to parse to a plain
  `sequence` — no count and a stable fixpoint — so the workout ran once instead of
  three times, and it generalised past rounds: `for time, 21-15-9:` lost the whole
  ladder, `for time, AMRAP 12min:` the window, `for time, team of 2:` the team.
  Spec §5.0 promised the opposite in as many words: *"Order is free on input"*.

  **The fix is the general rule, not `for time`.** A block's kind may be stated in
  any comma position: `blockKind` was split out of `headerKind` (leaving the
  match-anything `headerName` behind, so `unknown` stays reachable after a comma)
  and is now reached from `blockModifier` as well. `for time` was only the head
  that made the loss *quiet* — it parses alone, so nothing looked wrong — and
  special-casing it would have left the hole open for the next head that does.

  **Two things it forced that were not in the queue item.** A header states **at
  most one** kind: applying a later one over an earlier left the AMRAP's window on
  a `repeat`, whose formatter writes no window, so `AMRAP 12min, 3 rounds:` would
  have gone from *reported* to *silently mangled* — the first kind stands and the
  second is held verbatim. And a head that is not a kind at all (`cap 12min`,
  `building`) now leaves a `name` on a block that has a kind, which the old report
  condition (`type === 'sequence' && name`) no longer caught and `headerText` no
  longer wrote: both were widened, so those headers stay reported and round-trip
  in front of the kind. *Corrected while working it: the item said "silent", and
  since queue item 0d landed the day before it was in fact reported as a `note` —
  a severity that claims nothing, against the `error` its unreadable-head
  neighbours got. The distinction the table drew was real; the word was wrong.*

  The corpus did not move at all — no example file states a kind after a comma —
  so `interpretations.json` and `registry/workouts.canonical.json` both
  regenerated to no change. Ten `block/order` forms pinned, 1677 tests became
  1689. *Touched: `spec/grammar-0.1.ohm`, `grammar/block-semantics.ts`,
  `parse.ts`, `format.ts`, `spec/spec-0.1.md` §5.0 and §11.1,
  `test/golden/vocabulary.ts`, `test/grammar.test.ts`.*

- ~~**`wdl fmt` writes two clock headers no rule reads.**~~ **Closed 2026-08-16.**
  `every 90s:` formatted to `every 1min30s x undefined:` — an unbounded `every`
  has no `count` and `headerText`'s last branch wrote one anyway — and `E2MOM
  20min:` formatted to `every 2min for 20min:`, a spelling the grammar had no rule
  for at all. **Both were worse than a formatting defect and worse than the entry
  above first said.** An unreadable header is *held* as a named sequence rather
  than rejected, so each output reparsed to a sequence with the clock gone, then
  formatted back to itself: a perfect text fixpoint of a total loss, with only
  `wdl check` saying a word. That is the `@95lb` shape from lessons-learned.md
  exactly — a round trip proving stability while the reading is wrong — arriving
  this time from the *formatter's* side.

  Fixed on both sides. `headerText` grew the missing branch (no count, no window →
  `every 1min30s:`) and now writes the gym's spelling for a bounded interval, so
  `E2MOM 20min` survives instead of being normalised into something unreadable —
  `EMOM` is the one-minute case of it rather than a separate form. And the grammar
  learned `every <dur> for <dur>`, which is how the interval is said out loud and
  is what the fallback branch writes when a window is not whole minutes; that
  shape is unreachable from parsing today, but a formatter with a branch no rule
  reads is the defect, not the reachability. Spec §5.5. Found 2026-08-16 while
  working item 0f, pre-existing, and fixed in a commit of its own.

- ~~**A fused `for time` is dropped by `wdl fmt` on every kind except `repeat` and
  `sequence`.**~~ **Closed 2026-08-16.** `21-15-9 for time:` formatted to
  `21-15-9:` and came back **unscored**; the same for `AMRAP 12min for time:`,
  `team of 2 for time:` and `every 3min x 5 for time:`. `headerText`'s
  `fusedForTime` tested the block's *type* as well as its score, so an author's
  chosen score was dropped on the first format everywhere but two kinds.

  The type test was never the right guard: a score implied by `for time` is one
  the author **wrote**, and a score implied by the *shape* (an AMRAP's
  `rounds + reps`, a build's `max load`) is one the kind supplies and reparsing
  rederives. Only the second is safe to leave unwritten, and no kind supplies
  `time` — so testing the primary is the whole of it. Found 2026-08-16 because the
  new `for time, 21-15-9:` spelling inherits the same formatter: the two spellings
  agreeing is what made this visible as the kind's problem rather than the
  comma's.

- ~~**`3 RFT:` is not read.**~~ **Closed 2026-08-16** by queue item 0f's first
  half. It used to be held as a named sequence and **reported**, so nothing was
  lost quietly — but the rounds and the score went with it, leaving a block that
  ran once and was unscored. `3 RFT:` is now `3 rounds for time:` exactly (Chris
  confirmed the reading), one grammar production fusing the round word and the
  score because the `for time` is inside the abbreviation. Canonical output writes
  the long form; the short one is read, not preserved. A **bare** `RFT:` is
  declined on purpose and stays reported — it names rounds without saying how
  many, and there is no unbounded repeat to read it as. Spec §5.2. *`TABATA`
  remains unread and is not the same question: it names a structure to define
  rather than a header to abbreviate.*

- ~~**Open: a qualitative load (`@ heavy`) is held verbatim and means
  nothing.**~~ **Closed 2026-08-23** by queue item 6. `heavy`, `moderate`,
  `light` and `unloaded` are now a `Load` kind (`qualitative`) alongside
  absolute, percent, multiple and reference — `- 150ft Farmers Carry @ heavy`
  parses to `{kind: 'load', load: {kind: 'qualitative', value: 'heavy'}}`
  rather than falling into `raw`. It still carries no kilograms — `loadKilograms`
  returns `undefined` for it, the same silence a percentage of an unknown 1RM
  already has — so volume, `progress` and export are unchanged. What moved is
  that the step now reads as *loaded* to anything checking for one, where a raw
  target did not. Spec §7, §3. Related but distinct from the unitless-number
  question below: that one is a missing unit, this one is a load on a different
  scale altogether. Found 2026-08-15 while encoding a carry circuit.

- **Open: whether the leading `NxM` spelling should be the *canonical* one.**
  Deliberately not decided while closing the parse defect above, because it is a
  question about `format` rather than about `parse` and it applies just as much to
  steps that already parsed. *Chris confirmed the **semantic** 2026-09-03 —
  `NxM` before the movement is sets × reps, same reading as the trailing `xN` —
  but explicitly deferred the canonical-`format` question ("the rest we'll
  discuss again later"). So this entry stays open: only the output spelling is
  undecided.* Today `5x5 Back Squat @ 225lb` reads correctly and
  then formats to `5 Back Squats @ 225lb x5` — lossless, a fixpoint, and *not what
  anybody writes*. The whiteboard constraint is the argument for changing it:
  `5x5 Back Squat @ 225lb` is the gym standard and is the exact string spec §1
  uses to illustrate a readable one-liner, so the canonical form is currently
  further from a whiteboard than the input it replaces.

  **The recommendation is to switch, conditionally**: emit `NxM` when a step has
  `sets` *and* a plain rep quantity, and keep the trailing ` xN` otherwise —
  because the leading spelling only works for reps. `500m Row x3` has no sensible
  leading form (`3x500m Row` reads as an interval, not as sets of a distance) and
  `max Pull-Up x3` has none at all. That conditional is the reason this is worth
  deciding deliberately rather than in passing: a canonical form with an exception
  in it needs the exception stated in the spec, and *"which spelling is canonical"*
  is exactly the kind of question that should not be settled by whichever branch
  someone wrote first. **Blast radius is small and measured**: no corpus file uses
  either spelling, and the only pinned forms affected are the handful under
  `sets-by-reps` and `modifiers`.

- ~~**`wdl fmt` drops `after last` from four of the five kinds of rest.**~~
  **Closed 2026-08-15** by queue item 0e. `restText` *used to* return early for
  `as needed`, `= work`, active recovery and a threshold, so only a plain duration
  ever had ` after last` appended. `rest as needed after last` formatted to
  `rest as needed` — "rest only after the last round" became "rest between every
  round", which is a different workout, and `wdl check` said ok. Invisible to the
  vocabulary's fixpoint check, because the *second* format of the shortened line
  is stable: one more way a round trip proves stability and not correctness. Found
  2026-08-15 while writing rest permutations for the grammar.

  **The fix is where the fact lives, not a fifth branch.** `after last` says
  *which* rest rather than how long it is (spec §5.2, N1), so it is appended once,
  outside the branch on the bound — the branch computes a bound and nothing else.
  Written as a fifth early return it would have been the same bug waiting for the
  sixth kind of bound. Eleven forms are pinned now rather than four: every bound
  crossed with `after last`, including the *alternate spellings* of bounds that
  already worked (`rest equal to work after last`, `rest 1:30 after last`,
  `rest 1 min 30 s after last`) and `rest after last` with no bound at all, which
  is the one that would have shown a double space.

- ~~**The nested `score:` block that spec §9.5 and §9.6 both document is dropped
  entirely.**~~ **Closed 2026-08-15** by queue item 0e, *by correcting the spec*.
  Written as the spec used to write it —

  ```wdl
  score:
    primary: time
    on cap: reps
  ```

  — `parseScore` was handed `score:` with nothing after it, `primary` became the
  empty string, the children were never looked at, `wdl check` reported ok, and
  `wdl fmt` wrote a bare `score:`. Found 2026-08-15 while stating the score line
  in the grammar.

  **The decision, and it was made on the whiteboard constraint rather than on
  cost.** A compound score has two spellings — sibling lines, and inline braces
  when it has to be one line — and those cover the two cases that exist. A nested
  key-and-value block is a *third* spelling of the same three fields, and it is
  the same object the brace form is in the notation the format exists to avoid;
  this project has already ruled once that a canonical output which grew braces
  around a compound score was a **bug** rather than a formatting choice, and an
  indented block fails that test identically. It also could never have been more
  than an input form, since the formatter emits sibling lines and would rewrite it
  away on the first pass. So §9.5 and §9.6 now show the sibling spelling, with the
  correction recorded in §9.5.

  *That it was the cheap answer is not why it was chosen, and it is worth saying
  so: the expensive answer would have been justified if the form bought any
  expressiveness. It buys none — the same three fields, one more way to write
  them.*

  **The silence was the real defect, and it is fixed either way.** A line indented
  under `score:` is now reported by name at both call sites — the workout's score
  and a block's — and the bare `score:` it leaves behind is reported by `validate`
  as `score-without-primary` (see the entry above). Declining a form is not a
  licence to drop what somebody wrote. Four forms pinned where one was, including
  the block-level twin and the sibling spelling kept beside them.

- ~~**A brace score with no `primary:` field makes the whole brace text the
  primary.**~~ **Closed 2026-08-15** by queue item 0e.
  `score: {tiebreak: reps at 5min}` used to give
  `primary: "{tiebreak: reps at 5min}"`, which nothing can rank by, and the
  canonical form then stated the tiebreak twice — once inside the `raw` it
  re-emitted and once as its own `tiebreak:` line.

  **The decision: a brace with no `primary:` has no primary.** Not the raw text,
  which was nonsense; not a default, because `@95` is not 95lb and a defaulted
  primary is the same invention one layer up; and not a parse failure, because the
  author *did* write a tiebreak and it is worth keeping. So the fields written are
  kept and round-trip, `primary` is empty, and `validate` reports
  `score-without-primary` — "this names nothing to rank by" being a statement
  about a value, which puts it exactly where `min < max` on a rep range was put on
  the day of the swap. A bare `score:` with nothing after it reaches the same rule
  from the other direction, so the two spellings of an unnamed score are one
  complaint. Stated in spec §9.1. Four forms pinned where one was.

- ~~**A spelled-out duration word is a step quantity and not a rest.**~~
  **Closed 2026-08-15** by queue item 0e. `45 seconds Plank` was 45 seconds;
  `rest 45 seconds` was an `unreadable rest duration` error **and** a rest with no
  bound at all, which everything downstream reads as unbounded — so the line meant
  the *opposite* of what it said, which is worse than not reading it. Same for
  `2 mins`, `1 hour`, `45 sec`, `3 minutes`. Spec §3's unit table says these
  spellings are accepted "wherever a duration is expected", and a rest is a
  duration position, so the prose was right and the parser was wrong; no decision
  was needed, only the transcription. Found 2026-08-15 by typing lines into the
  browser.

  **The fix is where a duration is read, not where a rest is.** `parseDuration`
  folds the spelled-out spellings onto the compact ones itself now; they used to
  live in `parseQuantity`, anchored to the end of a single token, and the rest
  path never went through that caller. Global rather than anchored, so
  `rest 1 hour 30 minutes` folds both halves instead of only the last. The grammar
  gained `minuteWords`/`secondWords`/`hourWords` — one named list per unit, shared
  by `durWord` and by the rest line's `looseDuration`, since stated twice they
  would drift. Fourteen forms pinned where three were: every spelling of every
  unit, a compound, one with `after last`, and `rest 45 seconds Plank`, which must
  stay *active recovery* and not a bound with a name left over.

  *The three were the first entries in `grammar.test.ts`'s rejects list, which
  existed because a line **neither** implementation read was the one thing a
  differential test could not see. That list is empty again, and its rationale has
  been restated: with one implementation it is simply "the lines no rule reads",
  which is the honest half of the coverage count.*

- ~~**A target and a `for time` on one header, written in that order, lose
  both.**~~ **Closed 2026-08-15** by queue item 0e. `3 rounds @ 95lb for time:`
  used to hand `95lb for time` to `parseTarget` whole, because `@\s*([^,@]+)` is
  greedy to the end of the segment — so it came back a raw target and the score
  never happened, leaving the children with no real load and the block unscored.
  Written the other way round (`3 rounds for time @ 95lb:`) both always read
  correctly, which is what made this order-sensitivity rather than a missing form,
  and it round-trips as byte-identical text, so nothing but a pinned reading could
  see it. The grammar inherited the same greed, since its target text stopped at a
  comma or an `@` and not at a `for time`.

  **The fix is the parameterized rule the entry above said it would need.**
  `targetGroup<stop>` takes the boundary as a parameter: `never` in a step, where
  a target is prose and legitimately runs to the end of its segment, and `forTime`
  in a header, where `for time` is a score that may be fused onto any kind. One
  rule read to two boundaries, rather than a header-local copy of five rules that
  could drift.

  **What it cost that was not expected, and it is the interesting half.** The
  comma spelling (`3 rounds, @ 95lb for time:`) is the same target one position
  over, so the stop had to apply there too — and applied *alone* it made that line
  strictly **worse** than greedy: with the target stopping short, the `for time`
  had nothing left to consume it, so the whole header became unreadable and the
  kind and the load went down with it. Half-applied, it also turned a
  wrong-but-stable reading into an *unsettled* one, the shape the rx-split defect
  had: `wdl fmt` wrote the comma away and the second pass then read what the first
  had lost. So `headerModifier` gained trailing extras, which states out loud
  something that was true and unsaid — **whatever may qualify a header before a
  comma may qualify it after one**. Eight forms pinned where two were, including
  `3 rounds @ marathon pace:` to prove the boundary is the phrase `for time` and
  not the word `for`, and `10 Thruster @ 95lb for time` to pin that the step side
  is deliberately unchanged.

- ~~**An unrecognized step modifier is pushed into `step.notes`, the same array
  as an authored `note: "…"`.**~~ **Closed 2026-08-15** by queue item 0d, along
  with its block-level twin. What it used to do: `- 10 Thruster, with a band` put
  `with a band` in `notes`, so afterwards the two could not be told apart — and
  notes are *rendered*, so an unknown token silently acquired the meaning "the
  author wrote a note". The header twin put an unrecognized modifier in
  `block.flags`, beside `unbroken` and `rounds`. *The swap on the same day left
  both deliberately alone, because until there was somewhere else for unknown to
  live, changing where it landed was 0d's job and not the swap's; one nameless
  entry did go, a stray trailing comma that used to push an empty string in.*

  **It was worse than untidy, and this is the part the original entry did not
  say.** `notes` is read for *meaning* by two exporters: `flatten.ts` and
  `garmin-connect.ts` classify a step as warmup or cooldown by searching its
  notes, and read a power ramp's bounds out of one. So `- 10min Bike, warmup
  pace` — a phrase the grammar does not read — exported as a **warmup segment**,
  which is unknown text carrying meaning for execution on a device. Nothing
  reaches those exporters from `unknown`.

  **Now:** `Step.unknown` and `Block.unknown`, held verbatim, written back by
  `format` after the modifiers that were understood, absent from `timeline.ts` so
  no cue and no exporter can see them, and reported by `validate` as a `note`.
  Four corpus workouts moved and their *interpretation* digest — structure,
  totals, pacing — did not change at all. 14 forms pinned where three were.
- **Open, and found while closing the one above: an `@`-flag with a name the
  language does not define degrades to `unknown` on the first `wdl fmt`.**
  `10 Thruster @foo` parses to a *flag* called `foo` — `targetGroup_flag` accepts
  any word — and the formatter has no `@name` spelling to write a flag back in,
  so it emits `, foo`, which reparses as unrecognized text. Not a regression:
  before 2026-08-15 the same line degraded from a flag to a **note**, which was
  worse, since a note is rendered and read by two exporters. The named flags are
  all safe in both positions (`unbroken`, `building`, `reversed`, `shared`,
  `synchronized`, and `@tiebreak`, which `format` writes back in the `@` form).

  It is the same family as item 0d and deliberately not folded into it, because
  it needs a **decision**: either flags are an open vocabulary, in which case
  `format` needs an `@name` spelling for one it cannot write as a bare word, or
  they are closed, in which case an undefined name is unknown at parse time and
  should never become a flag at all. The second is the smaller change and the
  more honest reading — "a flag the language defines" is what `flags` means
  everywhere else — but it takes a form that parses today and stops it, so it is
  written down rather than guessed at. Nothing in the corpus writes one.

- ~~**A nested block written `- AMRAP 3min:` becomes a movement named `AMRAP
  3min:` and its contents are dropped.**~~ **Closed 2026-08-15** by queue item
  0b. `parseNode` tested `/^-\s+/` before anything looked at the trailing colon,
  so the whole block was read as a step, its children — a block's worth of work —
  went nowhere, and `wdl check` reported no error. Spec §2 states both rules and
  never said which wins; it now says the colon does. Found 2026-08-15 because the
  adoption rule turned the stable loss into an *unsettled* one: the step it
  produced formats back as `- AMRAP 3min:` with nothing under it, which phase 1
  then reads as an empty container, so each `wdl fmt` pass ate one more sibling.

  **The inline-body twin was closed 2026-08-28.** That fix keyed on a line
  *ending* in `:`; `- work 20s: Pull-Up` / `- min 1: 12cal Row` /
  `- every 1min: 5 Burpee` carry their body on the same line, still hit the
  `/^-\s+/` step branch first, and lost the block the same silent way. `parseNode`
  now strips the dash from those three forms too. See
  [settled-decisions.md](settled-decisions.md) "A line that is both a step and a
  block header". A *general* inline block body (`AMRAP 3min: 10 Push-Up`,
  `for time: 50 Burpee`, `21-15-9: Thruster`) has no rule and is still a step —
  but as of 2026-08-28 it is **reported** rather than silent: `parseNode` probes
  the text before the colon and, if it is a recognized block kind, says the
  header opens a block whose body belongs on the next line or in braces. Same
  file, "Extended again 2026-08-28".

  **It was pinned as correct, which is the part worth remembering.** Four
  `structure` vocabulary forms — `nested blocks`, `deep nesting`, `many top-level
  blocks`, `block/section :: conditioning` — were written to pin nesting and were
  all written with the dash, so the snapshot recorded the *loss* as the canonical
  form and the fixpoint check passed on it. `deep nesting` had been sitting there
  as `conditioning:\n  - 3 rounds:s`, the pluralizer putting an `s` on a name
  ending in a colon, in the same family as the `)s` the rx-split defect wrote.
  Nothing in the corpus, the spec or any template writes the dashed form, so
  those four fixtures were the only witnesses and they had been taught to agree.

- ~~**The one-line interrupt overlay cannot state its grammatical bounds.**
  `parseNode` reads the overlay (`every 1min: 5 Burpee` on one line, spec §5.8)
  with a bespoke regex, `/^every\s+(\S+):\s*(.+)$/i` — one token before the
  colon. The `every` grammar rule's bound tails — `every … for <dur>`,
  `every … until failure`, `every … x <n>` — all fail that regex, so
  `every 1min until failure: 5 Burpee` fell through to a garbage step with no
  diagnostic. As of 2026-08-28 that falls into the general "`<header>:` opens a
  block" diagnostic instead.~~ **Closed 2026-08-29.** The bound lives on
  `Interrupt` in the field names `Block` already uses for a clock — `count?`,
  `duration?`, `untilFailure?` — one spelling, not a parallel vocabulary. And
  `parseNode` reads the head before the colon by handing it to the grammar's
  own `every` production via `tryHeader` (the block path's reader) rather than
  growing a second bound regex; the bound it lands on the block is copied onto
  the `Interrupt`. `format` spells it the way a clock header does (minus `EMOM`
  sugar), and `timeline` carries it onto `group.interrupt` and into the outline
  though not into `estimate()` — an overlay is bounded by the work beside it.
  Design decision recorded in [settled-decisions.md](settled-decisions.md),
  "The one-line interrupt overlay states its bound the way a clock header does".
  Tests: `test/golden/vocabulary.ts` (overlay twins of `block/clock`),
  `test/corpus2.test.ts`, `test/timeline.test.ts`. The builder's per-block `»`
  caret on overlay rows is now *unblocked* but not wired — see
  [builder-ux.md](builder-ux.md).
  *Touched: `packages/core/src/{parse,ast,format,timeline}.ts`,
  `packages/core/test/golden/generate.ts`.*

- **Open, and the one place the adoption rule is weaker than its argument.** The
  rule that an empty block adopts the next line rests on "an empty block is not
  something anyone writes", and `validate` half-disagrees: `empty-block` is raised
  for every kind *except* `tally`. So an empty `any order:` with a block header
  after it will adopt that header rather than sit beside it. Left alone
  deliberately — phase 1 cannot know a block's kind without the keyword list the
  two-phase split exists to avoid, and the real question is whether the `tally`
  exemption in `validate` is justified at all, which is a question about a warning
  and not about parsing. Nothing in the corpus writes a childless `any order:`.

- ~~**A team qualifier never reaches the board.** `shared`, `each` and
  `synchronized` survive parse and canonical output, and `timeline.ts` drops all
  three: `- 40 Burpee each` cues as `40 Burpees`. Spec §5.11 requires canonical
  output to state the qualifier *always*, for the stated reason that **"40
  burpees" in a team context is exactly the kind of thing a reader guesses wrong
  about** — and the board is where a reader actually reads it. Same shape as the
  `rx` entry above: `stepCue` builds from a subset of the step. Found 2026-08-15
  while encoding a partner circuit; no corpus workout uses a team block.~~
  **Closed 2026-08-28.** `compileStep` in `packages/core/src/timeline.ts` now
  appends `s.team` after the targets — the position `format` puts it (§5.11: it
  qualifies the whole prescription, so it trails the load). The bare `each` team
  word does **not** collide with per-side `each <limb>` laterality: the grammar
  consumes `each arm` as the `trailingQualifier_limb` production before
  `_team` can see it, so `s.team` is only ever set by an explicit second word,
  and `- 40 Dumbbell Snatch each arm` in a team block still cues as
  `40 Dumbbell Snatches each arm` with no doubled `each`. Written explicitly
  together (`each arm each`) both render, matching `format` line for line — the
  two coexist rather than contradict. Verified by driving the board with a
  hand-written `team of 2:` workout through all three qualifiers. Test:
  `packages/core/test/timeline.test.ts` (`timeline: desugaring`) pins the cue
  label for each of the three plus an unchanged non-team step and the
  no-double-up case. `format` round-trip untouched — this was a timeline/cue
  change only.

- ~~**A distance range is not a form, and it fails the way `5x5` used to.**~~
  **Closed 2026-08-23** by queue item 5. `- 100-150ft Farmers Carry` no longer
  lands in the movement name: the grammar now catches a range wearing a unit
  ahead of the movement, reads it the way an unrecognized comma modifier already
  reads (`open` quantity, raw text in `Step.unknown`), and `validate.ts` reports
  it as a note. The movement resolves and `wdl fmt` no longer pluralizes the
  digits. Full decision, and why the range itself was not taught a unit, in
  [settled-decisions.md](settled-decisions.md).

- **The builder's outline disagrees with the workout about an unindented
  `score:`, until you canonicalise.** The outline is built from `readLines`
  directly and deliberately — it is a view of the file's *shape* — so a flat
  `score:` still draws inside the block it was written under, while spec §2's
  rule 4 has already put it on the workout. "What it reads as" is right, the
  outline is a line-tree, and `wdl fmt` makes them agree. Not worth fixing by
  teaching phase 1 what a score is, which is the only way to fix it *there*;
  worth fixing in the builder if the outline ever starts drawing from the AST.
  Found 2026-08-15 while verifying queue item 0b in the builder.

- ~~**`registry/workouts.canonical.json` is not rebuilt by anything that runs.**~~
  **Closed 2026-08-29.**
  Found 2026-08-15 while regenerating it for item 0d: it was stamped
  `2026-08-13`, so it had sat through the parser swap and two rounds of defect
  fixes. Six workouts differed by **JSON key order only** (`buildTarget` before
  `duration`, `perRound` before `aggregate`) — no reading had changed — but that
  is luck rather than a guarantee, and a stale generated file is a wrong answer
  waiting for someone to read it. `scripts/build-canonical.ts` regenerates it and
  the suite does not check it, unlike `interpretations.json` and
  `vocabulary.json`, which have a test that fails when they drift.

  Rebuilt 2026-08-16 while fixing the stamp's timezone, and all three generated
  registry files came back byte-identical apart from the stamp — so nothing had
  drifted this time either. The debt was unchanged then: nothing ran the rebuild
  and nothing checked the result, so "it was fine twice" was still luck.

  **Closed by approach A** — `scripts/build-workouts.mjs` now exports
  `buildWorkoutsDoc()`, the pure core of its derivation, with the CLI (write +
  summary, now behind a `import.meta.url` main guard) byte-identical.
  `packages/core/test/workouts-canonical.test.ts` re-runs that in process and
  asserts equality against the committed `registry/workouts.canonical.json`, one
  `it()` per workout keyed by id plus an envelope check, ignoring the `generated`
  stamp — the same shape as `golden.test.ts` and `vocabulary.test.ts`. Its
  failure message points at `node scripts/build-canonical.ts`. Verified it bites
  by reversing the movements sort in the deriver: the test failed and named each
  drifted workout. *The separate `describe-corpora.mjs` prose-vs-table debt
  lower in this file is untouched — different debt.*

- ~~The builder's Indent allows a first-in-document top-level line to be
  indented, orphaning it and invalidating the file.~~ **Fixed 2026-08-24.**
  `shift` in `packages/core/src/edit.ts` now also refuses to increase indent
  when the line has no preceding sibling to become its parent. See
  [builder-ux.md](builder-ux.md).

- **~~Twelve aliases in the canonical corpus are claimed by two records, and the
  registry has no way to say which is meant.~~ Curated 2026-08-23: eight merged,
  two withdrawn, two open and pinned.** Found 2026-08-22 during the alias pass
  over the core, by running `Registry.validate()` on `canonicalRegistry()` for
  the first time — the suite had only ever validated the *curated* file, and
  analysis reads the other one. Reported by `scripts/check-aliases.mjs`, which
  goes from 13 problems to 2.

  Every one was the same shape. A curated record carried an alias that is
  another record's *title*: `shoulder-press` claims `overhead press`, and the
  merged corpus also holds `Overhead Press` from wger. **The registry had no way
  for a curator to say "these two records are the same thing"** — an alias
  attaches a string to one record, it does not merge the other into it — so an
  assertion of sameness landed as a collision. `lookup()` tries `byKey` before
  `byAlias`, so the name resolved to whichever record owned the matching *id*
  and the curator's claim was silently discarded, without even reaching the
  `ambiguous` branch.

  **`sameAs` is the missing mechanism**, and it is one field on a curated
  record naming the ids it is one movement with. See
  [settled-decisions.md](settled-decisions.md) for why it is written down
  explicitly rather than inferred from the alias that is already there.

  **The verdicts, one per pair.** Each was checked against what the two records
  actually say, not against how alike the names look:

  | Pair | Verdict |
  |---|---|
  | `overhead-press` / `shoulder-press` | **One movement.** Merged. Two names for the same barbell press; the corpus writes both. |
  | `strict-press` / `shoulder-press` | **One movement.** Merged. `Strict` names what it is *not* — a push press — rather than a different lift. Brings Garmin's traps and upper-chest claim with it. |
  | `farmer-s-walk` / `farmers-carry` | **One movement.** Merged. Garmin lists `CARRY/FARMERS_WALK` and `CARRY/FARMERS_CARRY` as separate exercises; that is Garmin carrying two spellings, not two lifts. |
  | `l-sit` / `l-sit-hold` | **One movement.** Merged. An L-sit is a hold; the curated title says so twice. |
  | `pistol-squat` / `pistol` | **One movement.** Merged, and it puts `Pistol` back in the core — see the entry below, which this closes. |
  | `bodyweight-squat` / `air-squat` | **One movement.** Merged. `Air Squat` is the CrossFit name for it and already carried `bodyweight squat` as an alias. |
  | `dumbbell-bicep-curl` / `dumbbell-curl` (twice) | **One movement.** Merged. Two collisions, one pair: `dumbbellbicepcurl` and `dumbbellbicepscurl` are the singular and plural of the same claim. **This is the pair no rule could have fixed** — see below. |
  | `block-deadlift` / `rack-pull` | **Not one movement.** Alias withdrawn. A rack pull is off the pins of a power rack, a block deadlift off blocks under the plates; the bar starts at a different height off a different surface. Every gym conflates them and the registry should not. Withdrawing the alias also cleared the plural shadow, where `Rack Pulls` depluralized onto `block-deadlift` and made `rack-pull` unreachable by its own plural. |
  | `american-swing` / `kettlebell-swing` | **Not one movement.** Alias withdrawn. The American swing finishes overhead; that is the whole difference and it is what the name is for. It is a *variant*, and `russian swing` — which really is the standard swing under another name — stays an alias, which is the distinction the two spellings exist to draw. |
  | `assault-bike` / `bike` | **Open, and pinned.** See below. |
  | `air-bike` / `bike` | **One movement.** Merged 2026-08-23, once the split below left `Air Bike` holding only the fan bike. See below. |

  **Both were `Bike`, and they were never the same finding.** `Bike` is not a
  movement but a *modality* — a curated lump over the erg, the fan bike and the
  road, with `air bike`, `airdyne`, `assault bike`, `bike erg`, `echo bike` and
  `fan bike` all aliases of it on purpose. Absorbing one machine into a lump
  spreads that machine's muscles over all of them: merging `Assault Bike` put
  Garmin's `chest` claim onto six corpus workouts, a 40km ride among them.
  Today the claim is correctly confined to whoever writes `Assault Bike`, and
  the merge would have leaked it. That one stays open.

  *Corrected 2026-08-23: `Air Bike` was filed here as "the same finding, and
  worse". It was not the same finding at all. It was a false merge wearing a
  modality collision's clothes, and once the split below took the bicycle crunch
  out, what was left was Garmin's fan bike claiming `quads` primary with
  `hamstrings`, `glutes` and `calves` assisting — **the same claim, muscle for
  muscle, that `Bike` already carries from Garmin and from the curator.** There
  was nothing left to leak, so `sameAs` on `Bike` absorbed it and the collision
  closed. `Bike`'s derived muscles and its per-source `support` counts came out
  byte-identical; it kept `BIKE_OUTDOOR/BIKE` as its Garmin mapping, which is
  what "Air Bike" already exported before the merge, since the alias outranked
  the record. The difference between the two machines is Garmin's, not ours: it
  gives the assault bike a `chest` claim and the air bike none, and the registry
  does not use identity to correct a source.*

  `assault bike` is correct English that people write, so the alias is not
  withdrawn. **That collision is the price of a lump the registry cannot
  express**, and what is actually missing is a way to say "these names are one
  modality, and each keeps its own muscles". Pinned in `fold.test.ts` rather
  than argued away.

  **What the merges cost, stated because it is not free.** Eight corpus files
  move in muscle attribution — and *only* in muscle attribution: the golden
  interpretation snapshot regenerated byte-identical, so no structure, total or
  pacing moved anywhere. *That last sentence was true of the digest as it stood
  and is no longer how this would be found: `muscles` joined the digest later
  the same day, and regenerating against the pre-merge registry now moves these
  eight files and no others. See queue item 8.* Six of the eight gain something right (a loaded carry
  works the glutes; a strict press works the traps; an L-sit works the lats and
  triceps). **Two do not: `11-mary` and `55-maggie` now attribute `biceps` and
  `shoulders` to a pistol squat**, because wger claims them and merging brought
  wger's claim into the record Mary resolves to. wger is simply wrong about a
  pistol, and the merge is still right — identity is not the lever for fixing a
  bad source claim, and `support` records it as one source out of three so a
  caller asking for consensus never sees it. But there is no way to *correct* a
  source's claim today, and this is the first place it has cost something.

- **~~`Dumbbell Biceps Curl` resolved `ambiguous`, and no rule could have
  ranked it.~~ Fixed 2026-08-23, and it is the case that justified `sameAs`.**
  Eleven of the twelve collisions resolved to *something*: `lookup()` tries ids
  before aliases, so the name landed on whichever record owned the matching id —
  the wrong answer, but a single one. `dumbbellbicepscurl` was held **only as an
  alias by both** `Dumbbell Bicep Curl` and `Dumbbell Curl`, and as the name of
  neither, so there was no id to prefer and nothing to rank. It reached the
  `ambiguous` branch, and `musclesFor` treats that exactly like an unregistered
  movement: the step drops out of muscle attribution, out of volume and out of
  every goal rule, while `wdl check` says nothing.

  **No tie-breaking rule fixes this**, and that is the point. Prefer the record
  with more sources, or the curated one, or the shorter title, and each is a
  guess dressed as a policy — the two records were the same movement, and any
  rule that picks one *record* has still thrown the other's four sources away.
  The only thing that closes it is a person saying they are one record, which is
  what `sameAs` is for. Pinned by name in `fold.test.ts`, because a resolution
  that goes from `ambiguous` to correct leaves no other trace.

- **~~`Air Bike` is one record holding two different exercises.~~ Fixed
  2026-08-23, by the first *split* the pipeline has ever had.** Found
  2026-08-22. Garmin's `INDOOR_BIKE/AIR_BIKE` is the fan bike;
  free-exercise-db's `Air_Bike` and everkinetic's `0284` are the *bicycle
  crunch* — "lie flat on the floor with your lower back pressed to the ground".
  The result claimed `abs` and `quads` as primaries and scored `3-sources` for
  it — a signal that reads as three catalogues agreeing when it is three
  catalogues being merged by their spelling. `Bicycle Crunch` was separately a
  record of its own.

  This is the failure mode the merge was built to avoid, arriving from the
  direction nobody guarded: the veto lists in `find-duplicates.mjs` and
  `dedupe-movements.mjs` stop *similar* names from merging, and nothing stops
  *identical* ones. A title match is treated as proof, and for a name this
  generic it is not.

  *Corrected 2026-08-23: this was written as a `dedupe-movements.mjs` bug and it
  is not one. That script never saw the pair — the record has no `mergedFrom`.
  All three sources are named "Air Bike", so they land in the same record inside
  `add(fold(e.name), …)` in `build-movements.mjs`, before dedup runs at all. The
  fix is a way to say "this source's record is not the one that name already
  means", which is a different mechanism in a different script from `sameAs`,
  and `sameAs` cannot express it: it merges records, and this needs one split.*

  **What landed.** `NOT_WHAT_THE_NAME_MEANS` in `build-movements.mjs`, keyed on
  `source:upstream-id` — the entry, not the record, because the name is the
  thing that is wrong — and valued by the title of the record the entry actually
  belongs to. `free-exercise-db:Air_Bike` and `everkinetic:0284` now say
  `Bicycle Crunch`. `origin` still records the name each source used, so the
  correction reads as a correction rather than as tidied-away history:
  `bicycle-crunch` carries `free-exercise-db: { id: Air_Bike, name: "Air Bike" }`
  in plain sight. It lives in the script and not in `registry/movements.json`
  because it is not a fact about a movement and has no record to hang off — it
  is a correction to a source, and that script is where the sources are read.
  A directive that matches no entry, or names a record no source produced, exits
  the build with a message, for the reason an unresolved `sameAs` does: the
  symptom of a dead directive is the false merge still sitting there.

  `Bicycle Crunch` went from two sources to four (`abs` now [4,0] in `support`);
  `Air Bike` went to Garmin alone, and was then absorbed into `Bike` — see the
  collision table above for why that was safe and why `Assault Bike` still is
  not. Both ends are pinned in `fold.test.ts`.

  **The corpus consequence this was carrying was already gone, and the entry did
  not say so.** *Corrected 2026-08-23: "`Air Bike` in a workout gets an
  abdominal exercise's muscles" stopped being true the day `resolve` learned to
  rank an explicit alias above a record's own id — `Bike`'s curated `air bike`
  outranked the `air-bike` record from then on, and `check-aliases.mjs` had been
  printing the `*` on `bike` ever since. No corpus file writes the name in any
  case. Regenerating the golden digest after the split moved **nothing**, which
  is the right answer and not a sign the split did nothing: what it fixed was a
  false `3-sources` agreement signal and a merge the collision was blocking.
  The cost of the wrong sentence was that this sat at the top of the queue as
  the oldest item "with a corpus consequence" when it had none.*

- **`scripts/find-duplicates.mjs` cannot see a near-duplicate inside our own
  registry, by construction.** Established 2026-08-22 by checking the pairs it
  misses against its own rules, rather than by treating each miss as a bug. It
  is a *cross-source, same-shape* detector, and every one of these fails a gate
  it applies on purpose:

  - `if (A.sources.some((s) => B.sources.includes(s))) continue` — a pair
    sharing any source is skipped as deliberate. `Pec Deck` and
    `Machine chest fly` were both wger-only, so they were never compared;
    `Butterfly` shared wger with both, so it was never compared with either.
    (That specific trio was merged by hand 2026-08-29 — see below — but it is
    still the shape of the blind spot.) wger is the largest single catalogue,
    which makes this the widest one.

  Surfaced from the other side too, on 2026-08-22, by matching an external alias
  vocabulary against the registry — 52 collisions. That is the framing worth
  keeping: **an alias list is the only thing that bridges two names sharing no
  tokens**, so alias coverage and duplicate detection are the same problem seen
  from two sides. Not every pair is a duplicate — folding `Back Squat` into
  `Squat` would be wrong, since the registry holds both and they are different
  lifts — so the list is a lead, not a work order.
  - A veto token present in one name and absent from the other rules the pair
    out entirely. That is the whole "generic versus qualified" class:
    `Curl`/`Barbell Curl`, `Leg Curl`/`Seated Leg Curl`,
    `Star Jump`/`Jumping Jacks`, `Hyperextensions`/`Back Extension`.
  - `if (idxs.length > 300) continue` drops any blocking token that common, so a
    pair whose only shared non-veto token is `press` or `curl` is never even
    proposed.
  - It reads `title` and never `aliases` — so the twelve collisions above, where
    a curator has already written down that two records are the same, are
    invisible to it. *2026-08-23: those twelve are now answered by `sameAs`
    rather than by this script, which is the right division — the curator's
    answer was never a thing to detect. What remains missing is the pairs where
    nobody has written anything down yet.*
  - Its Jaccard runs on raw tokens with no lemmas, unlike `dedupe-movements.mjs`.
    `Hyperextensions` and `Back Extension` share no token at all and score zero.

  So the 52 collisions an external alias set turned up are not a failure of the
  script — they are outside what it looks for. **Three of the five pairs
  suspected of being near-duplicates are not duplicates**, and checking beat
  guessing every time: `Curl`, `Leg Curl` and `Squat` are family bases with
  `variantOf` links already pointing at them, and `Star Jump` is a plyometric
  squat jump ("squat down halfway and explode back up... spreading your legs and
  arms") while `Jumping Jacks` is a standing cardio jack.

  **`Pec Deck`/`Butterfly`/`Machine chest fly` were one machine under three
  names, and that one is decided. Merged 2026-08-29.** The evidence agreed on
  every point checked: all four descriptions (wger's Pec Deck, Machine chest
  fly and Butterfly, free-exercise-db's Butterfly) are a seated machine, back
  on the pad, upper arms parallel to the floor, handles or elbow-pads brought
  together in an arc squeezing the chest, slow return — and wger's own
  Butterfly entry names the apparatus the *"Peck deck"* machine in its Spanish
  text. A fourth record, everkinetic's `Butterfly Machine` (already
  `variantOf: butterfly`, and the same movement described the same way), was
  folded in too. A curated `pec-deck` record in `registry/movements.json`
  carries `sameAs: [butterfly, butterfly-machine, machine-chest-fly]`; wger's
  own `Pec Deck` merges into it on the shared name. `cable-crossover` stays
  separate and is right to — four sources, `force: push`, cable equipment, a
  standing movement. **3112 → 3109 records; core pool 128 → 129** (the curated
  record makes a real claim about the movement — chest, machine,
  horizontal-push — so it lands in the pool, net +1 over the three absorbed).
  The `butterfly` variation family survives under the new base id `pec-deck`;
  `butterfly-narrow-grip` and `butterfly-reverse` keep the `family` link but
  lose their derived `variantOf: butterfly` (the base they pointed at no longer
  exists as its own record). Golden interpretation snapshot regenerated to no
  change — no corpus workout writes any of these names.

  What is still missing is a general *within-registry* duplicate pass with
  different rules — starting from aliases, which is where the answer is already
  written down. This pair was curated by hand; the next same-source near-dup
  with nobody's verdict on it will still be invisible to `find-duplicates.mjs`.

- **~~`Pistol` fell out of the core, correctly, and should probably be put back
  by hand.~~ Closed 2026-08-23 without a hand, by merging `Pistol Squat` into
  it.** The two sources that record came with take `Pistol` from one source to
  three and its score from 3 to 8, so it is core again on the same threshold
  that dropped it. Worth keeping the entry: nothing about the threshold changed,
  and the argument below for queue item 4 is unaffected by the fact that this
  particular movement stopped being an example of it. 2026-08-22. `Air Squat` carried the alias `squat`, which is a movement
  in its own right; `link-families.mjs` indexes aliases before titles in id
  order, so wger's squat variation group resolved its member "Squat" to
  `air-squat`, and the family was then named after its shortest member —
  `Pistol`. The squat family was called `pistol`. Dropping the overreaching alias
  names the family `Squat`, which is right, and costs `Pistol` the `family-base`
  point that was holding it at the threshold: 4 → 3, and core goes 178 → 177.

  Nothing about Pistol changed. This is `mark-core`'s threshold behaving as
  documented — "a threshold, not a truth" — and it is an argument for queue item
  4, where pool membership is decided by judgement instead of by score.
- **`describe-corpora.mjs` regenerates the table row and leaves the prose
  beside it to rot.** The generator writes `SOURCES.json` and the `SOURCES.md`
  table, which is why those were right after the registry merge while six
  figures in the same file's prose were not: the corpus size in two places, the
  cross-source caveat, the `variantOf` count in two more. Fixed by hand on
  2026-08-23, which is the third time this file has been corrected by hand and
  the second time a generator existed while it happened.

  One of the six was **not** drift and is the sharper finding: *"178 records
  have this"* about disagreeing `muscleClaims` measured **262** before the merge
  and 263 after. It was wrong when written and outlived two separate passes that
  corrected the figures on either side of it, because nothing generates it and
  nothing counts it. The fix is to widen the generator to the prose figures it
  can derive, rather than to keep correcting them.

- **Two curated records for the barbell bent-over row, and no verdict on which
  survives.** Surfaced 2026-08-23 by the merge itself, visible from no single
  branch: one session curated `barbell-row` into the generation pool (a
  garmin-only record, one muscle source) while another gave
  `bent-over-row-barbell` a curated alias (four sources, three muscle sources,
  and `mid-back` that the other lacks). Both then claimed `bent over row`, which
  `Registry.validate()` refuses. The **collision** is resolved — the alias was
  withdrawn from the thinner claim, so the name reaches `barbell-row` alone —
  but the **merge** is not, and the two are different questions. Nothing in
  `examples/corpus` writes either, so the cost today is confined to the pool and
  the palette showing one lift twice. Deciding it means choosing which record's
  muscles the corpus should read, which is a curator's call and is exactly what
  `sameAs` exists to record once made.
- ~~**`registry/duplicate-candidates.json` is a 694-item backlog nobody has
  triaged.** Generated 2026-08-12 and untouched since. Two of the pairs the alias
  comparison surfaced — `GHD Back Extensions` / `Hyperextensions & Back
  Extensions`, and `Seated Leg Curl` / `Leg Curl` — **are already in it**. So for
  those the finder is not the problem; nothing reads its output. A report that
  runs, writes 694 rows and is never opened costs the same as not running.~~
  **Fixed 2026-08-29** by **retiring the artefact** (option A of three). The
  committed file was deleted and `find-duplicates.mjs` now writes its JSON to
  stdout — a run-on-demand report, exactly how `check-aliases.mjs` is already
  treated: not a pipeline step, no committed output. `node
  scripts/find-duplicates.mjs > pairs.json` captures a fresh list when a curator
  wants one to triage. **Why not wire it into `build-canonical.ts` and pin it
  with a drift test:** that needs a downstream consumer and there is none — the
  script never merges, and the pipeline's own `dedupe-movements.mjs` step carries
  its own veto logic. A generated file nothing reads is the rot the "every
  pipeline step must be in the pipeline" lesson exists to stop, and committing it
  fresh every run would just automate the rot. The `barbell-row` /
  `bent-over-row-barbell` merge question above and the near-duplicate blind spots
  (~line 890) are untouched — separate debts.
  *Touched: `scripts/find-duplicates.mjs`, `registry/duplicate-candidates.json`
  (deleted).*

- **Open, deferred on purpose: renaming an account handle strands its
  workouts' `@id`s.** Raised 2026-09-01 with *The workout library* epic
  ([../tasks/current.md](../tasks/current.md)), which makes `users.handle` the
  `@id` namespace for the workouts an account creates (`chris:fran`,
  `crossfit:fran`) and lets the user edit that handle. When they change it,
  every existing `<oldhandle>:<slug>` `@id`, every `workouts.wdlId` built on it,
  and every share link goes stale. **Phase 1 does not solve this** — Chris's
  call ("we can revisit that"). Options to weigh when it is picked up: rewrite
  `wdlId` + the `@id` line in the text across all the user's workouts on rename;
  keep old handles as resolvable aliases; or forbid the rename once a workout
  exists under the handle. Recorded so the first session to hit a broken share
  link knows it is expected, not a bug.

  **Extended 2026-09-02 (DEC-027) — `movement_sets.setId` shares this debt.** The
  movement-sets database epic (S0,
  [decisions.md](../decisions.md) DEC-027) makes a set's `setId` the same kind of
  key: `<owner-handle>:<slug(name)>`, forced on save and **re-slugged on rename**
  like `workouts.wdlId`. So renaming an account handle re-slugs every
  `user`-scoped set's `setId` too, stranding any link built on the old one — the
  identical failure mode, with the identical options above. S0 does not solve it;
  it is recorded here so the first session to hit a stale `setId` after a handle
  change knows it is expected.

  **Extended 2026-09-03 (DEC-028) — a `user`-scoped `goals.goalId` shares this
  debt too.** The goals database epic (G0,
  [decisions.md](../decisions.md) DEC-028) moves saved goal rulesets into a
  `goals` collection whose `user` rows are keyed `<owner-handle>:<slug(title)>`,
  forced on save and **re-slugged on rename** like `workouts.wdlId` and
  `movement_sets.setId`. So renaming an account handle re-slugs every
  `user`-scoped ruleset's `goalId` as well, stranding anything built on the old
  one — the same failure mode, the same options. `global` goal rows
  (`wdl:<slug>`) carry no handle and are unaffected. G0 only records it here
  alongside the workout and set cases; it is not solved in that epic.

The ones with a plan attached are queued in
[tasks.md](../tasks.md); the ones found by driving the
builder are in [builder-ux.md](builder-ux.md).
