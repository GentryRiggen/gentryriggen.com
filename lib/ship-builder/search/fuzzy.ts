/**
 * Small in-house fuzzy matcher for the parts search box.
 *
 * A query is split into words; every word must match somewhere in the
 * searchable fields, and the scores add up. A word matches a field word by
 * (best first) equality, prefix, substring, subsequence (name-like fields
 * only) or a single typo (one insert, delete, substitute or swap).
 */

export interface SearchField {
  text: string;
  /** Multiplier for matches in this field, e.g. name 1, description 0.4. */
  weight: number;
  /**
   * Allow loose subsequence matches ("fnl" for "funnel"). Too noisy for
   * long free text, so descriptions leave this off.
   */
  allowSubsequence?: boolean;
}

const EXACT = 100;
const PREFIX = 80;
const SUBSTRING = 60;
const SUBSEQUENCE = 40;
const TYPO = 30;
/** Shorter words are too ambiguous to forgive a typo in. */
const MIN_TYPO_LENGTH = 4;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function isSubsequence(needle: string, haystack: string): boolean {
  let next = 0;
  for (let i = 0; i < haystack.length && next < needle.length; i++) {
    if (haystack[i] === needle[next]) next++;
  }
  return next === needle.length;
}

/** True when a and b differ by at most one insert, delete, substitute or swap. */
export function isWithinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const lengthGap = Math.abs(a.length - b.length);
  if (lengthGap > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (lengthGap === 0) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // substitution
    return (
      a[i] === b[i + 1] &&
      a[i + 1] === b[i] &&
      a.slice(i + 2) === b.slice(i + 2)
    ); // adjacent swap
  }
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  return shorter.slice(i) === longer.slice(i + 1); // insertion / deletion
}

function scoreWord(
  word: string,
  target: string,
  allowSubsequence: boolean
): number {
  if (word === target) return EXACT;
  if (target.startsWith(word)) return PREFIX;
  if (target.includes(word)) return SUBSTRING;
  if (allowSubsequence && word.length >= 2 && isSubsequence(word, target)) {
    return SUBSEQUENCE;
  }
  if (word.length >= MIN_TYPO_LENGTH) {
    // Compare against the whole word and against a same-length prefix, so a
    // half-typed, slightly wrong word ("lifebo") still finds its target.
    if (
      isWithinOneEdit(word, target) ||
      isWithinOneEdit(word, target.slice(0, word.length)) ||
      isWithinOneEdit(word, target.slice(0, word.length + 1))
    ) {
      return TYPO;
    }
  }
  return 0;
}

function scoreQueryWord(word: string, fields: readonly SearchField[]): number {
  let best = 0;
  for (const field of fields) {
    for (const token of tokenize(field.text)) {
      const score =
        scoreWord(word, token, field.allowSubsequence ?? false) * field.weight;
      if (score > best) best = score;
    }
  }
  return best;
}

/**
 * Score of `query` against `fields`, or null when any query word fails to
 * match. An empty query matches everything with score 0.
 */
export function fuzzyScore(
  query: string,
  fields: readonly SearchField[]
): number | null {
  const words = tokenize(query);
  let total = 0;
  for (const word of words) {
    const score = scoreQueryWord(word, fields);
    if (score === 0) return null;
    total += score;
  }
  return total;
}

interface Scored<T> {
  item: T;
  index: number;
  score: number;
}

/**
 * Items matching `query`, best first (ties keep their original order). An
 * empty query returns every item unchanged.
 */
export function fuzzyFilter<T>(
  query: string,
  items: readonly T[],
  getFields: (item: T) => readonly SearchField[]
): T[] {
  if (tokenize(query).length === 0) return [...items];
  const scored: Scored<T>[] = [];
  items.forEach((item, index) => {
    const score = fuzzyScore(query, getFields(item));
    if (score !== null) scored.push({ item, index, score });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
