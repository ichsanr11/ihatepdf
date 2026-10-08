import { classifyWord, type WordClass } from "./classify";

export interface Token {
  id: number;
  text: string; // original substring, original casing
  isWord: boolean;
  cls?: WordClass; // only set when isWord
}

// A "word" is a run of letters, optionally with internal apostrophes or
// hyphens ("don't", "well-known", "meng-italic-kan"). Everything else
// (whitespace, punctuation, digits) is captured as its own token so the
// original text can be reconstructed byte-for-byte from the token list.
const TOKEN_RE = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’-][A-Za-zÀ-ÖØ-öø-ÿ]+)*|[^A-Za-zÀ-ÖØ-öø-ÿ]+/g;

export function tokenize(text: string): Token[] {
  const matches = text.match(TOKEN_RE) ?? [];
  return matches.map((t, i) => {
    const isWord = /[A-Za-z]/.test(t);
    return isWord
      ? { id: i, text: t, isWord: true, cls: classifyWord(t) }
      : { id: i, text: t, isWord: false };
  });
}
