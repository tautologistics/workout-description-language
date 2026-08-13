#!/usr/bin/env node
/**
 * A static server for the repository root.
 *
 *   node scripts/serve.mjs [port]
 *
 * The web apps import the core from `build/web/` and fetch registry data from
 * `registry/`, so they need one origin over the whole tree rather than a server
 * rooted at the app. No dependencies: `node:http` is enough for serving files to
 * one person on one machine, and a dev server is not where this project's
 * complexity should go.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const root = process.cwd();
const port = Number(process.argv[2] ?? 8081);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wdl': 'text/plain; charset=utf-8',
  '.wdlg': 'text/plain; charset=utf-8',
  '.wdlp': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    // `normalize` after stripping the leading slash keeps `..` from climbing out
    // of the tree. Serving one person on localhost is still no reason to hand out
    // arbitrary files.
    let path = join(root, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
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
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
