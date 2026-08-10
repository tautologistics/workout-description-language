/** Entry point: every check, one summary. Run with `npm test`. */
import './units.test.ts';
import './lines.test.ts';
import './semantics.test.ts';
import './corpus.test.ts';
import './timeline.test.ts';
import './accepted.test.ts';
import './errors.test.ts';
import { report } from './lib.ts';
process.exit(report());
