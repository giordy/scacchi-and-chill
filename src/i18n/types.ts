// Types of the translation files (src/i18n/messages/*.ts).
//
// A translation file is a tree of sections. Its leaves are:
// - a string, with {param} placeholders: "{winner} wins against {loser}"
// - a plural: { one: "{count} game", other: "{count} games" }, chosen with Intl.PluralRules from the
//   `count` param. Categories are the CLDR ones of the language (zero, one, two, few, many, other;
//   "other" is required), plus exact matches like "=0": "no games".
// - a list of variants: ["Round {round} is over!", "…"], for the phrases the group messages rotate.
// A section never has a key named "other": that is how a plural is told from a section.

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type Plural = { other: string } & Partial<Record<Exclude<PluralCategory, 'other'>, string>> & { [exact: `=${number}`]: string };
export type Variants = readonly string[];
export type Leaf = string | Plural | Variants;
export interface MessageTree {
  [key: string]: Leaf | MessageTree;
}

// The shape of the reference file (English) with its literal texts widened, so that every other
// language must have the same keys with its own texts
export type Widen<T> = T extends string
  ? string
  : T extends readonly string[]
  ? Variants
  : T extends { other: string }
  ? Plural
  : { [K in keyof T]: Widen<T[K]> };

export type DeepPartial<T> = T extends string | readonly string[] | { other: string } ? T : { [K in keyof T]?: DeepPartial<T[K]> };

// Dot paths of the leaves of a tree, by kind
type Join<K extends string, P extends string> = `${K}.${P}`;
export type PathsOf<T, L> = {
  [K in keyof T & string]: T[K] extends L ? K : T[K] extends Leaf ? never : T[K] extends object ? Join<K, PathsOf<T[K], L>> : never;
}[keyof T & string];

export type Params = Record<string, string | number>;
