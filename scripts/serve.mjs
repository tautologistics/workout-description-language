#!/usr/bin/env node
/**
 * A static server for the repository root.
 *
 *   node scripts/serve.mjs [port]      # or PORT=1234 node scripts/serve.mjs
 *
 * The web apps import the core from `build/web/` and fetch registry data from
 * `registry/`, so they need one origin over the whole tree rather than a server
 * rooted at the app. No dependencies: `node:http` is enough for serving files to
 * one person on one machine, and a dev server is not where this project's
 * complexity should go.
 */
import { createServer } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { createMockApi } from './mock-api.mjs';

const root = process.cwd();

// The mock `/api` (DEC-020, task M7). In production the apps talk to a
// co-located PocketBase at `/api/*`; under this dev server there is none, so
// auth, saved workouts and DB-backed movements would 404. The mock answers the
// `apps/shared/pocketbase.js` surface from `fixtures/` + `registry/movements.json`.
// On by default; `WDL_MOCK_API=0` opts out and `/api/*` falls through to the
// normal 404 / static handling.
const mockApi = process.env.WDL_MOCK_API === '0' ? null : createMockApi(root);
// An argument wins, then PORT, then a default. The environment variable is how
// a harness that assigns ports gets to choose one.
const port = Number(process.argv[2] ?? process.env.PORT ?? 8081);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  // The grammar is fetched by the web apps and read by people, and both want it
  // as text: `src/` opens no files, so a browser hands `spec/grammar-0.1.ohm`
  // to `makeParser` the same way Node does.
  '.ohm': 'text/plain; charset=utf-8',
  '.wdl': 'text/plain; charset=utf-8',
  '.wdlg': 'text/plain; charset=utf-8',
  '.wdlp': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const APPS = { '/apps/builder/': 'Builder — write a workout', '/apps/display/': 'Board — run one' };

/** A directory, as a page. The apps are named at the top so `/` is a way in. */
async function listing(dir, at) {
  const names = (await readdir(dir, { withFileTypes: true }))
    .filter((d) => !d.name.startsWith('.'))
    .map((d) => d.name + (d.isDirectory() ? '/' : ''))
    .sort();
  const link = (href, text) => `<li><a href="${href}">${text}</a></li>`;
  const apps = at === '/'
    ? `<h2>Apps</h2><ul>${Object.entries(APPS).map(([h, t]) => link(h, t)).join('')}</ul>`
    : '';
  return `<!doctype html><meta charset="utf-8"><title>${at}</title>
<style>body{font:15px/1.6 ui-monospace,monospace;margin:2rem auto;max-width:40rem;padding:0 1rem}
h1{font-size:1rem;opacity:.6;font-weight:400}h2{font-size:1rem}ul{padding-left:1.2rem}a{color:inherit}</style>
<h1>${at}</h1>${apps}<h2>Files</h2><ul>${names.map((n) => link(at + n, n)).join('')}</ul>`;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    // The mock `/api` gets first refusal on any `/api` path. It returns `true`
    // once it has written a response; `false` (an unmocked `/api` path, or the
    // mock disabled) falls through to static handling, which 404s as before.
    if (mockApi && (url.pathname === '/api' || url.pathname.startsWith('/api/'))) {
      if (await mockApi(req, res, url)) return;
    }
    // `normalize` after stripping the leading slash keeps `..` from climbing out
    // of the tree. Serving one person on localhost is still no reason to hand out
    // arbitrary files.
    let path = join(root, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
    if ((await stat(path)).isDirectory()) {
      const index = join(path, 'index.html');
      // A directory with no index of its own gets one listed for it. The root of
      // the repository is the case that matters: the server has to be rooted
      // there for the apps to reach the core and the registry, so `/` is where
      // you land, and answering it with a raw ENOENT for a file nobody wrote is
      // no way to be met.
      if (!(await stat(index).catch(() => null))) {
        res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' });
        return res.end(await listing(path, url.pathname));
      }
      path = index;
    }
    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': TYPES[extname(path)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain' });
    res.end(String(e.message));
  }
}).listen(port, () => {
  console.log(`serving ${root} on http://localhost:${port}`);
  if (mockApi) console.log('  mock /api on — auth + workouts + movements  (WDL_MOCK_API=0 to disable)');
});
