# Deferred tasks

Real holes — valid work, deliberately postponed. Not the same as
[deliberately-not-done.md](../topics/deliberately-not-done.md), which is the
list of things that will *stay* unbuilt and why. The piece of this that is
ready to start, with what it touches, is in [current.md](current.md).

## Deferred

- ~~**Results.**~~ **Built 2026-08-23** (queue item 2). A `.wdlr` record, the board
  that writes one, and `measure: load` over a series of them. See
  [what-exists.md](../topics/what-exists.md). What is *still* missing from it is
  narrower than the hole was: **structured modifications** — a movement swapped
  on the day goes in `notes:`, because whether they want structure is an open
  question (roadmap §3.2) and reading one would have settled it by accident.
- **A history view.** Results exist and nothing draws them. `wdl result --goals`
  answers "did the load go up"; nothing answers "show me this workout over the
  last three months", and neither app knows a `.wdlr` exists once it has been
  downloaded.

- **Board: record the actual target values at setup.** *Captured 2026-09-02
  (Chris).* When a board is loaded and the workout has targets or a scaled /
  division prescription, an **individual** running the board for themselves
  (not a class) should be able to enter the **actual** loads / calories / values
  they will use — during setup, before starting — so the post-workout summary
  (`.wdlr`) already carries them instead of the prescription. Doesn't apply to a
  class board. Sits beside the board's footer division picker
  (`divisions()` / `resolve()`); the entered values ride into the `.wdlr` the
  board already writes at session end. Ties into the `Rx+` question and the
  history view below.
- ~~**Sharing, accounts, a platform.**~~ **Reactivated 2026-08-30** as queue
  items 18–20 (a hosted instance on Chris's DreamHost VPS with PocketBase for
  Google sign-in and saved/shared workouts). This was a Non-Goal gated on "the
  goal itself changes"; it did — see [../goals.md](../goals.md) "## Pivots" and
  [DEC-016](../topics/settled-decisions.md#dec-016-a-hosted-instance-with-pocketbase-for-auth-and-storage).
  What stays off the roadmap is a *platform* — public signup, discovery, scale.
- **Whiteboard photo → WDL.** Interesting, separate project.
- **User-scoped movements (Movements-in-DB Phase 2).** Movements a user creates
  under their own account — viewable by anyone when published, editable only by
  the creator — the way workouts already work. Deferred behind Phase 1 (global,
  admin-edited movements: M1–M6 in [current.md](current.md)), whose `movements`
  collection already ships the `scope` and nullable `user` fields Phase 2 needs.
  Ties into account **namespacing** (see
  [../topics/builder-ux.md](../topics/builder-ux.md) "Accounts, IDs and layout")
  — a user-scoped movement needs a namespaced id and a cross-viewer resolution
  story, the same problem the workout-id namespace has.

- **`Rx+` as a division.** *Captured 2026-09-02 (Chris).* Targets today carry a
  men's / women's / `rx` split (spec §10.1 `variants:` / the step-level `rx`
  split, `divisions()` / `resolve()`, the board's footer picker). Some workouts
  also publish an **`Rx+`** — a *harder-than-Rx* prescription (heavier load, more
  reps, a harder movement variant). **Open question: how it is expressed.** Is
  `Rx+` just another named entry in `variants:` (uniform with `women` / `men` /
  `scaled`), or is it a distinct axis (an *intensification* of Rx rather than a
  peer division)? Whichever, the board picker, `wdl --variant`, the "what it
  reads as" pane and the goal analysis all need to know it exists. No format
  change should be made until the shape is decided — see
  [../topics/settled-decisions.md](../topics/settled-decisions.md) for the rx →
  variant history this extends.

- **A `warmup:` (and maybe `skills:`) top-level section.** *Captured 2026-09-02
  (Chris).* A workout file has one main scored/timed container (`for time`,
  `AMRAP`, rounds, …). Wanted: an **optional top-level section that is not the
  workout** — a *warm-up*, or a *skills* block (a set of exercises that prepares
  you for the piece, effectively a mini-workout but **not scored and not timed**,
  and **not counted in the workout's duration / volume / score**). Distinct from
  [DEC-018](../topics/settled-decisions.md) (a bare-label block header is an
  inert `section`): this is a *named semantic* section the analysis and the board
  treat specially — excluded from scoring and the clock, shown as its own labelled
  region, possibly its own body-map contribution line. Needs: a grammar rule
  (`spec/grammar-0.1.ohm`, spec §5), an AST node kind, `run` / `timeline` /
  `score` all skipping it, and both apps rendering it as a preamble region. A
  real format addition — scope it before building.

- **Richer workout search.** *Captured 2026-09-02 (Chris) — "doesn't need to be
  done now, not enough workouts yet".* Extend the builder's *Workouts* search
  (`searchWorkouts` in `apps/shared/pocketbase.js`, the L4 panel) beyond a
  title / `wdlId` substring: filter by **score kind** (for-time / AMRAP / load /
  …) and **duration** (range or cap), and **include / exclude a given movement**,
  and **include / exclude given equipment**. So a curator can find "AMRAPs under
  12 min with no barbell" or "everything with muscle-ups" as the corpus grows.
  Depends on the equipment vocab being real data (V6–V8 in [current.md](current.md))
  and on there being enough workouts to be worth filtering (the scouring pass
  below). PocketBase can filter on indexed columns, so some of this wants
  derived columns on the `workouts` collection (score kind, duration, a movement
  id list, an equipment id list) written at save time.

- **A WOD-library scouring pass — grow the corpus past CrossFit / Hyrox / Tabata.**
  *Captured 2026-09-02 (Chris).* Extract workouts from other public libraries into
  the same `examples/workouts/<org>/<slug>.wdl` + DB shape the L-series built.
  Starter sources Chris named:
  - `https://wodwell.com/wods/?sort=popular` — has a JSON API:
    `https://wodwell.com/wp-json/wodwell/v2/pages/filters/?sort=newest&paged=0`
  - `https://tryformd.com/blog/free-hyrox-workouts`
  - `https://www.wodlib.com/`
  - `https://www.getevox.fit/wod-library`
  - `https://wodcat.com/wod`
  - `https://www.reddit.com/r/crossfit/comments/1nd9ux1/collection_of_all_com_wods_since_2001/`
  - `https://www.crossfit.com/workout/2001` (the crossfit.com main-site WOD archive
    from 2001 onward — a per-day URL scheme)
  Also do a broader search for more WOD/WOD-library sources. Each source needs a
  small extractor → normaliser to WDL → `wdl check` gate, like the L5 authoring
  pass but scraped rather than hand-written; licensing / attribution per source
  needs checking before anything is republished. This is an L-series-style epic,
  not a single task.

## Reconsider when

- **A history view** becomes worth building once results accumulate enough
  that "did the load go up" from `wdl result --goals` stops being enough — i.e.
  once someone actually wants to look back over more than one series at a time.
- **Sharing, accounts, a platform** — the goal changed 2026-08-30 and the
  hosted-instance slice (items 18–20) is now active; a *platform* beyond that
  (public signup, discovery, scale) is still not on the roadmap and would need
  another goal change.
- **User-scoped movements** become worth building once Phase 1 (global movements
  in the DB, edited in-app) has landed and Chris is regularly creating movements
  while building workouts — at which point "this one is just mine" is the
  natural next ask.

- **`Rx+` as a division** and the **`warmup:` section** become worth building
  when a workout being captured actually needs them — likely surfaced by the
  scouring pass below (many published WODs carry an Rx+ line; many carry a
  warm-up). Decide the format shape at that point, not before.

- **Richer workout search** becomes worth building once the scouring pass has
  grown the corpus enough that a title substring is no longer enough to find
  what you want, and once equipment is real data (V6–V8).

- **The WOD-library scouring pass** is worth starting whenever corpus size is
  the bottleneck — for generation quality, for search being useful, or just for
  coverage. No dependency; it can run in parallel with the V-series.
