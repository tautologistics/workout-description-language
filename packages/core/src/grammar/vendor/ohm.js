/**
 * `ohm-js`, as something a browser can import.
 *
 * `ohm.min.js` beside this file is ohm-js 17.5.0 verbatim — see README.md for
 * where it came from and how to replace it. It is a UMD bundle, so loaded as an
 * ES module it finds no `exports` and no `define`, falls to its third branch,
 * and hangs everything off `globalThis.ohm`, exactly as a `<script>` tag would.
 * This file is the dozen lines that turn that back into named exports, so
 * everything above it imports ohm the ordinary way.
 *
 * Why a relative path at all: `packages/core/src/` ships to a browser as plain
 * files, and `scripts/build-web.mjs` does no module resolution — a bare
 * `import … from 'ohm-js'` survives into `build/` and the browser refuses it.
 * A relative path needs nothing to resolve it, which is what makes "src/ has no
 * bare specifiers" a rule a test can state.
 *
 * The one cost, stated rather than hidden: importing this leaves `ohm` on
 * `globalThis`. That is the UMD's doing and not worth unpicking — the same
 * would happen from a script tag — but a page that loads its own ohm would find
 * this one there.
 */
import './ohm.min.js';

const ohm = globalThis.ohm;

export const {
  _buildGrammar,
  grammar,
  grammars,
  makeRecipe,
  ExperimentalIndentationSensitive,
  ohmGrammar,
  pexprs,
  version,
} = ohm;
