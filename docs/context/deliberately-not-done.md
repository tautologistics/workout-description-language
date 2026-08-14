# Deliberately not done

Not holes — decisions. Each of these looks like an obvious improvement, and each
has a reason it is not one here. Check this before proposing one of them.

- **Conformance suite, third-party implementations.** These matter for a format
  seeking adoption. This one is not. Revisit only if someone outside actually
  wants to implement it.

  **Corrected 2026-08-14.** This entry originally read *"Tree-sitter grammar,
  conformance suite, third-party implementations"* and declined all three
  together on the adoption argument. That lumped in the wrong thing. A formally
  specified grammar is not an adoption feature — it is a maintainability
  requirement, and it holds regardless of whether anyone outside ever reads it.
  Declining it here was reasoning from "no outside implementers" to "no rigorous
  spec needed", which does not follow. The grammar is severed from this entry and
  is now queue item 0; conformance suites and third-party implementations stay
  declined for the reason given. See the clarification in [README.md](README.md).
- **A field per property in the builder.** It would always lag the grammar, and
  the grammar is the interesting part.
- **Reps → load conversion.** Would need a 1RM and a physiological model.
  Inventing one would make every number look more authoritative than it is.
- **A file format for palette "sets".** A working preference, not something a
  workout depends on. `localStorage` until it earns more.

What is missing but *wanted* is in [not-built.md](not-built.md).
