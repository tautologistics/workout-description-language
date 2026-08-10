/** Entry point: every check, one summary. Run with `npm test`. */
import './units.test.ts';
import './fold.test.ts';
import './lines.test.ts';
import './semantics.test.ts';
import './corpus.test.ts';
import './corpus2.test.ts';
import './timeline.test.ts';
import './accepted.test.ts';
import './errors.test.ts';
import './validate.test.ts';
import './truth.test.ts';
import './golden.test.ts';
import { report } from './lib.ts';
process.exit(report());
