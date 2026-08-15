# Running it

```bash
npm --prefix packages/core test     # 1494 tests, nothing to install to run them
node scripts/build-canonical.ts     # rebuild registry/ from its sources
node scripts/build-web.mjs          # emit the core as browser modules
node scripts/serve.mjs 8081         # then open http://localhost:8081/
```

The CLI: `wdl fmt | check | timeline | export | goals | generate | program`.
The server must be rooted at the repository — the apps reach `build/` and
`registry/` from there.

A change to the apps needs `build-web.mjs` before the browser sees it, and the
board and builder are verified by driving them, not only by the suite — see
*Tests do not read* in [lessons-learned.md](lessons-learned.md).
