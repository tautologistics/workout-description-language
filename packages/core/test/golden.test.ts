/** Every corpus file must still be interpreted the way the snapshot records. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, eq } from './lib.ts';
import { digest, CORPUS } from './golden/generate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(readFileSync(join(here, 'golden/interpretations.json'), 'utf8'));

describe('golden interpretations', () => {
  for (const [file, expected] of Object.entries(snapshot)) {
    it(file, () => eq(digest(readFileSync(join(CORPUS, file), 'utf8')), expected));
  }
});
