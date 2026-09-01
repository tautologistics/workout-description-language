# Next Steps

## Immediate

**The active epic is *Movements in the database — Phase 1 (M1–M6)*** (Chris,
2026-08-31): move the curated `registry/movements.json` layer into a PocketBase
`movements` collection edited through an in-app widget, with ingestion in and a
reviewable dump back out. Suggested order **M0 (design note) → M2 (admin bool) →
M1 (collection) → M3 (ingest) → M5 (editor widget) → M4 (dump)**; **M6 (nightly
VPS DB backup cron)** is independent and can go anytime — it is a pre-existing
gap that was never set up. Phase 1 is global (admin-edited) movements only;
Phase 2 (user-scoped) is in [../tasks/deferred.md](../tasks/deferred.md). Full
write-ups: [../tasks/current.md](../tasks/current.md) "Movements in the
database".

Everything before this is closed: the whole 0-series through 21, the deployment
epic (18–20, landed 2026-08-30) and the builder layout redesign (R1–R10, landed
2026-08-31) — see [../tasks/completed.md](../tasks/completed.md). The loose
unscheduled bullets (the `»`-panel `@ 2x` clarity task, a full laterality
curation sweep, the post-redesign account/ID/layout rethinks) are in
[../tasks/current.md](../tasks/current.md) after the epic section.

## Later

- The remaining gaps in [../tasks/deferred.md](../tasks/deferred.md): a history
  view over `.wdlr` results; whiteboard photo → WDL (a separate project). A
  *platform* beyond the small hosted instance (public signup, discovery,
  scale) stays off the roadmap.
