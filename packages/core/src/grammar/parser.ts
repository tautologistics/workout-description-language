/**
 * The grammar, compiled, with every area's semantics on it.
 *
 * `spec/grammar-0.1.ohm` is one grammar with several start rules, and this is the
 * one place that compiles it and attaches meaning: the shared lexical layer from
 * `lexical-semantics.ts`, the step line from `step-semantics.ts`, the block header
 * from `block-semantics.ts`. They are separate files and a single semantics object
 * on purpose — Ohm scopes an operation to a semantics, so an operation two areas
 * both need (`unit()`) has to live on one object rather than be copied onto two.
 *
 * The grammar source is **handed in** rather than read, for the same reason the
 * movement registry is (see `../env.ts`): nothing under `src/` opens a file or
 * knows a path. A Node host reads `spec/grammar-0.1.ohm`; a browser fetches it.
 *
 * `makeParser` takes the text; `wdl()` below is the one `parse.ts` uses, which
 * asks `env.ts` for it and keeps the compiled result.
 */

// Vendored, and imported by relative path on purpose: nothing under `src/`
// resolves a bare specifier, because the browser emit has no resolver to do it
// with. See `vendor/README.md`.
import * as ohm from './vendor/ohm.js';
import { required } from '../env.ts';
import type { Step, Block, Rest, Score } from '../ast.ts';
import { installLexical, origin, type Origin } from './lexical-semantics.ts';
import { installStep } from './step-semantics.ts';
import { installBlock } from './block-semantics.ts';
import { installRest } from './rest-semantics.ts';
import { installScore, type ScoreQualifier } from './score-semantics.ts';
import {
  installPreamble, type Directive, type Variant, type VariantField,
} from './preamble-semantics.ts';

export type { Origin };

/** A match, reported rather than thrown. */
export type Attempt<T> = { ok: true; value: T } | { ok: false; message: string };

export interface WdlParser {
  /** One step line — the text after the `- `. Throws if the grammar rejects it. */
  parseStep(text: string, o?: Origin): Step;
  /** One block header — the text before the `:`. Throws if the grammar rejects it. */
  parseHeader(text: string, o?: Origin): Block;
  /** One `rest …` line, keyword included. */
  parseRest(text: string, o?: Origin): Rest;
  /** One `score: …` line, keyword included. */
  parseScore(text: string, o?: Origin): Score;
  /** One `on cap:` or `tiebreak:` line — what it contributes to the score above it. */
  parseQualifier(text: string, o?: Origin): ScoreQualifier;
  /** One `@key value` directive line. */
  parseDirective(text: string, o?: Origin): Directive;
  /** One `# Title` line. */
  parseTitle(text: string, o?: Origin): string;
  /** One variant's opening line, with its fields when they are inline in braces. */
  parseVariant(text: string, o?: Origin): Variant;
  /** One `key: value` line indented under a variant. */
  parseField(text: string, o?: Origin): VariantField;
  /** The same, reporting a failure instead of throwing. */
  tryStep(text: string, o?: Origin): Attempt<Step>;
  tryHeader(text: string, o?: Origin): Attempt<Block>;
  tryRest(text: string, o?: Origin): Attempt<Rest>;
  tryScore(text: string, o?: Origin): Attempt<Score>;
  tryQualifier(text: string, o?: Origin): Attempt<ScoreQualifier>;
  tryDirective(text: string, o?: Origin): Attempt<Directive>;
  tryTitle(text: string, o?: Origin): Attempt<string>;
  tryVariant(text: string, o?: Origin): Attempt<Variant>;
  tryField(text: string, o?: Origin): Attempt<VariantField>;
}

export function makeParser(grammarSource: string): WdlParser {
  const grammar = ohm.grammar(grammarSource);
  const semantics = grammar.createSemantics();
  installLexical(semantics);
  installStep(semantics);
  installBlock(semantics);
  installRest(semantics);
  installScore(semantics);
  installPreamble(semantics);

  /**
   * One shape for every start rule: match, then walk.
   *
   * `startRule` is Ohm's own mechanism for "parse this as a header, not as a
   * step" — which is how the grammar gets away with never stating the `- ` or the
   * `:`. `21-15-9` is a ladder here and `8-12` is a rep range there, and no rule
   * has to tell them apart.
   */
  const at = <T>(startRule: string, walk: (node: never, o: Origin) => T) =>
    (text: string, o?: Origin): Attempt<T> => {
      const m = grammar.match(text, startRule);
      if (m.failed()) return { ok: false, message: m.shortMessage ?? 'no match' };
      return { ok: true, value: walk(semantics(m) as never, origin(o)) };
    };
  const orThrow = <T>(what: string, attempt: (t: string, o?: Origin) => Attempt<T>) =>
    (text: string, o?: Origin): T => {
      const got = attempt(text, o);
      if (!got.ok) throw new Error(`grammar: ${what}: ${got.message}`);
      return got.value;
    };

  const tryStep = at<Step>('step', (n, o) => (n as { toStep(o: Origin): Step }).toStep(o));
  const tryHeader = at<Block>('blockHeader', (n, o) => (n as { toBlock(o: Origin): Block }).toBlock(o));
  const tryRest = at<Rest>('restLine', (n, o) => (n as { toRest(o: Origin): Rest }).toRest(o));
  // A score has no origin of its own: it is a field on a workout or a block, not
  // a node with a line of its own in the AST.
  const tryScore = at<Score>('scoreLine', (n) => (n as { toScore(): Score }).toScore());
  const tryQualifier = at<ScoreQualifier>('scoreQualifierLine',
    (n) => (n as { qualifier(): ScoreQualifier }).qualifier());
  const tryDirective = at<Directive>('directiveLine',
    (n) => (n as { directive(): Directive }).directive());
  const tryTitle = at<string>('titleLine', (n) => (n as { title(): string }).title());
  const tryVariant = at<Variant>('variantLine', (n) => (n as { variant(): Variant }).variant());
  const tryField = at<VariantField>('fieldLine', (n) => (n as { field(): VariantField }).field());

  return {
    tryStep,
    tryHeader,
    tryRest,
    tryScore,
    tryQualifier,
    tryDirective,
    tryTitle,
    tryVariant,
    tryField,
    parseStep: orThrow('step', tryStep),
    parseHeader: orThrow('block header', tryHeader),
    parseRest: orThrow('rest', tryRest),
    parseScore: orThrow('score', tryScore),
    parseQualifier: orThrow('score qualifier', tryQualifier),
    parseDirective: orThrow('directive', tryDirective),
    parseTitle: orThrow('title', tryTitle),
    parseVariant: orThrow('variant', tryVariant),
    parseField: orThrow('variant field', tryField),
  };
}

/**
 * The parser `parse.ts` runs, built from the grammar the host provided.
 *
 * Compiling a grammar is the expensive part — Ohm builds a matcher out of the
 * source text — and `parse` is called once per document, so the result is kept.
 * Keyed on the source itself rather than on "have I done this once", so a host
 * that hands over a different grammar (a test, an editor holding an unsaved
 * spec) gets a parser for the grammar it handed over and not the previous one.
 * `required('grammar')` returns the same string identity until a provider is
 * replaced, so the check below is a pointer comparison in the ordinary case.
 */
let compiled: { source: string; parser: WdlParser } | undefined;

export function wdl(): WdlParser {
  const source = required('grammar');
  if (!compiled || compiled.source !== source) compiled = { source, parser: makeParser(source) };
  return compiled.parser;
}
