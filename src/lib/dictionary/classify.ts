import idWords from "@/data/dict/id-common.json";
import enWords from "@/data/dict/en-common.json";

const ID_SET = new Set<string>(idWords as string[]);
const EN_SET = new Set<string>(enWords as string[]);

export type WordClass = "id" | "en" | "unknown";

/**
 * Classify a single word as Indonesian, English, or unknown, using two
 * frequency-ranked 10k word lists. Indonesian is checked first and wins on
 * overlap — a word absorbed into everyday Indonesian (e.g. "internet",
 * "video", "data") is conventionally *not* italicized even though it's
 * also an English word, which is exactly the behavior this priority gives
 * us for free. Anything in neither list (names, jargon, typos, numbers)
 * comes back "unknown" so the UI can flag it for a manual decision instead
 * of guessing.
 */
export function classifyWord(rawWord: string): WordClass {
  const w = rawWord.toLowerCase();
  if (ID_SET.has(w)) return "id";
  if (EN_SET.has(w)) return "en";
  return "unknown";
}
