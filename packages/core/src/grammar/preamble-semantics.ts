/**
 * What the preamble lines *mean*: directives, the title, and variants.
 *
 * Small on purpose, and the reason is worth stating: a directive's value is never
 * interpreted. An `@id` is any unique string with an optional `namespace:` prefix
 * and is never derived from the file's contents (roadmap §3.2.1), so there is
 * nothing for a grammar to say about it beyond where it begins and ends. The same
 * goes for a variant's field values, which are read by whatever resolves variants
 * and not here.
 *
 * What is *not* here: which variant a field line belongs to. That is a question
 * about several lines, and this is a grammar over one — the same division that
 * leaves `on cap:` attaching to its score in the caller.
 *
 * Every action spells out one parameter per child, ignored ones included: Ohm's
 * arity check reads `fn.length` and a rest parameter reports zero.
 */

import type { Semantics } from './vendor/ohm.js';

export interface Directive { key: string; value: string }
export interface VariantField { key: string; value: string }
/** A variant's name, plus its fields when they were written inline in braces. */
export interface Variant { name: string; fields?: VariantField[] }

export function installPreamble(semantics: Semantics): void {
  semantics.addOperation<Directive>('directive()', {
    directiveLine(_at, key, value) {
      return {
        key: key.sourceString,
        value: value.numChildren ? value.child(0).child(1).sourceString.trim() : '',
      };
    },
  });

  semantics.addOperation<string>('title()', {
    titleLine(_hashes, _s, text) {
      return text.numChildren ? text.child(0).sourceString.trim() : '';
    },
  });

  semantics.addOperation<VariantField[]>('fields()', {
    inlineFields(_open, _s1, first, tails, _s2, _close) {
      return [first, ...tails.children.map((t) => t.child(2))].map((f) => f.field());
    },
  });

  semantics.addOperation<VariantField>('field()', {
    inlineField(key, _colon, _s, value) {
      return { key: key.sourceString, value: value.sourceString.trim() };
    },
    fieldLine(key, _colon, _s, value) {
      return { key: key.sourceString, value: value.sourceString.trim() };
    },
  });

  semantics.addOperation<Variant>('variant()', {
    variantLine(name, _colon, _s, inline) {
      return {
        name: name.sourceString,
        ...(inline.numChildren ? { fields: inline.child(0).fields() } : {}),
      };
    },
  });
}
