# Vendored: ohm-js

The parser engine, checked in rather than installed. This is the escape hatch
[settled-decisions.md](../../../../../docs/context/settled-decisions.md) named
when it accepted a runtime import inside `packages/core/src/`: *"if the
no-imports line ever has to be absolute, `ohm.min.js` can be vendored into the
core outright."* It had to be, and this is it.

| File | What it is |
|---|---|
| `ohm.min.js` | ohm-js **17.5.0**, `dist/ohm.min.js`, byte for byte. 95,683 bytes, `sha256 c1422e1154c9e46e6873f2f6c24175de693dcc51c6d07eb1edf093c65338c7df`. |
| `ohm.d.ts` | ohm-js 17.5.0, `index.d.ts`, byte for byte. Types only; nothing emits it. |
| `ohm.js` | **Not** ohm. Twelve hand-written lines turning the UMD bundle into named ES exports. The only file here to read. |
| `LICENSE` | ohm-js is MIT, © 2014-2022 Alessandro Warth and the Ohm project contributors. Kept because the copy above is a redistribution. |

Import `./ohm.js`. Nothing should reach for `ohm.min.js` directly.

## Why it is here rather than in `node_modules`

`scripts/build-web.mjs` strips types and rewrites `.ts` to `.js`; it does no
module resolution, and that triviality is deliberate. So a bare
`import * as ohm from 'ohm-js'` reached `build/web/core/` intact and a browser
answered *"Failed to resolve module specifier"*. Vendoring makes the specifier
relative, which needs no resolver anywhere — in Node, in a browser, or in
whatever loads these files next — and makes **"src/ has no bare specifiers"**
literally true again, so `test/portable.test.ts` can state it as a rule instead
of listing the ways it can be broken.

`ohm-js` is no longer a dependency in `packages/core/package.json`. Two copies
of one library is how versions drift, and with the import relative the installed
one would never have been the one running. The repo needs no `npm install`
again, which is where it was before the grammar arrived.

The loss, so it is not a surprise: the editor's ohm types now come from
`ohm.d.ts` rather than from the package. They are the same file; they will stop
being the same file if the copy here is ever refreshed carelessly.

## Replacing it

```bash
npm pack ohm-js@<version>            # or npm install, then read node_modules/
tar -xzf ohm-js-<version>.tgz
cp package/dist/ohm.min.js  packages/core/src/grammar/vendor/ohm.min.js
cp package/index.d.ts       packages/core/src/grammar/vendor/ohm.d.ts
cp package/LICENSE          packages/core/src/grammar/vendor/LICENSE
shasum -a 256 packages/core/src/grammar/vendor/ohm.min.js   # record it above
```

Then check `ohm.js` still exports what the bundle defines — the export list is
`index.mjs` from the same version — and run `npm --prefix packages/core test`.
The grammar suite parses 746 real step lines through it, so a bad copy does not
get far.

**Do not edit the vendored files.** They are verifiable against npm only for as
long as they are untouched; that is most of what vendoring buys.
