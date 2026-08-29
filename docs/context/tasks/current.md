# Current tasks

Open, in-progress, and soon-actionable queue items — self-contained enough for
their own session, kept in the numbering the full queue used. Closed items are
in [completed.md](completed.md); items declined or postponed on purpose are in
[deferred.md](deferred.md). Load this file when starting a session with no
task named. When one lands, move it into `completed.md` and update
[what-exists.md](../topics/what-exists.md).

## Open

- **10 — Collapse the builder's Outline and Text panes into one tabbed pane.**
  *High priority (Chris, 2026-08-29).* The builder's `<main>` is a four-column
  grid — palette | **Outline** | **Text** | "What it reads as" (see
  `apps/builder/index.html`, `.pane` sections; grid in `apps/builder/builder.css`
  `main { grid-template-columns: … }`). The Outline (the GUI/structural editor,
  `#outline`) and the Text pane (the raw `#textarea`, `#text`) sit side by side
  and each take a full column, but a user only edits in one mode at a time. Put
  them in **one grid cell** with a tab strip / toggle (Outline ⇄ Text) that
  switches which is visible; the other is hidden, not removed.

  **This is a pure display change — no data migration.** `lines` (an array of
  raw text lines) is already the single source of truth in `builder.js`;
  `text()` joins it, and every `render()` repaints both `#text` and `#outline`
  from it, while the `#text` `input` handler re-splits `lines` from the
  textarea. So both views are always consistent with `lines` — switching a tab
  is show/hide only, and an edit made in either mode is already reflected in the
  other the moment you switch. Nothing about parse, format or the "What it reads
  as" pane changes.

  **Scope:**
  - `apps/builder/index.html` — wrap `.outline-pane` and `.text-pane` in one
    container `.pane` (one grid cell); add a tab control (two buttons, or a
    segmented toggle) in that pane's `<h2>` row. Keep the existing `<h2>`
    text ("Outline" / "Text") and the `#dirty` "edited" badge — the badge
    belongs to the Text tab and should still show when text drifts from
    canonical even while the Outline tab is active (so a user knows there are
    hand edits waiting).
  - `apps/builder/builder.css` — `main` grid goes from 4 to 3 columns (and the
    `@media (max-width: 1180px)` / `900px` breakpoints adjust: the 1180px rule
    currently drops to 3 columns, so it becomes 2 + full-width palette; check
    both breakpoints by driving it). Style the tab strip; the inactive view
    gets `display: none` (not `visibility`) so it does not reserve height.
  - `apps/builder/builder.js` — a few lines to toggle a class / `hidden` on the
    two views and mark the active tab. Persist the choice in `localStorage`
    (`wdl.editor-tab` or similar) the way the body-map mode and goals are
    persisted, so a reload keeps the mode. Default to **Outline** (the pitch of
    the builder is that it is a GUI, not a text editor — see the `index.html`
    top comment and the "Nothing tells you what a line can take next" item in
    [../topics/builder-ux.md](../topics/builder-ux.md)).
  - No core changes; no test changes expected (the suite does not drive the
    builder DOM). Verify by **driving the builder**: `node scripts/build-web.mjs`
    then `node scripts/serve.mjs 8081`, open `http://localhost:8081/`, and
    check: (a) the two tabs switch and only one shows; (b) an edit in the
    Outline appears in the Text tab after switching and vice versa; (c) the
    "edited" badge still lights on hand text edits; (d) the layout holds at
    desktop, ~1100px and ~800px widths; (e) the choice survives a reload.

  **Land it / docs:** fresh branch off `origin/main`
  (`git checkout -b <name> origin/main`; `main` is checked out elsewhere so you
  cannot `git checkout main`); push with `git push origin <branch>:main` and
  confirm the SHA moved via `git ls-remote origin main`. Commit message body
  ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. When it
  lands: move this item to [completed.md](completed.md), update the **Apps** row
  in [../topics/what-exists.md](../topics/what-exists.md) (the builder now has a
  tabbed editor rather than side-by-side panes), add a
  [../topics/builder-ux.md](../topics/builder-ux.md) "## Layout" entry recording
  what shipped, and add a dated line to
  [../current/recent-changes.md](../current/recent-changes.md).

- Every earlier numbered item — the whole 0-series, 1, 1a, 2, 3, 4, 5, 6, 7, 8,
  8a and 9 — is closed; see [completed.md](completed.md).

Nobody has run a session off the board yet. Everything is verified by tests
and by driving the UI — every defect Chris has caught by *looking* was
invisible to the suite. A real session will likely surface the next item.
