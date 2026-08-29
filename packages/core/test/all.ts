/**
 * Entry point: every check, one summary. Run with `npm test`.
 *
 * The node entry comes first because it is what hands the core its data. Nothing
 * under src/ reads a file, so without this the first test to consult the
 * movement registry throws.
 */
import '../node.ts';
import './portable.test.ts';
import './units.test.ts';
import './fold.test.ts';
import './lines.test.ts';
import './semantics.test.ts';
import './corpus.test.ts';
import './corpus2.test.ts';
import './timeline.test.ts';
import './run.test.ts';
import './edit.test.ts';
import './accepted.test.ts';
import './errors.test.ts';
import './validate.test.ts';
import './variants.test.ts';
import './truth.test.ts';
import './golden.test.ts';
import './workouts-canonical.test.ts';
import './vocabulary.test.ts';
import './grammar.test.ts';
import './block-affordances.test.ts';
import './interop.test.ts';
import './export.test.ts';
import './connect.test.ts';
import './muscles.test.ts';
import './goals.test.ts';
import './generate.test.ts';
import './program.test.ts';
import './result.test.ts';
import { report } from './lib.ts';
process.exit(report());
