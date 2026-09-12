/**
 * Phase 1 has no LLM yet (that's Phase 2). This is a deliberately simple
 * heuristic: pull out the first number-looking token as the amount, and use
 * the rest of the message as the description. Category is always left for
 * the user to pick via the inline keyboard, since we're not guessing yet.
 *
 * Handles inputs like:
 *   "12.50 lunch at Subway"   -> amount 12.50, description "lunch at Subway"
 *   "$6 coffee"               -> amount 6,     description "coffee"
 *   "coffee $6"               -> amount 6,     description "coffee"
 */
export interface ParsedMessage {
  amount: number | null;
  description: string | null;
}

const AMOUNT_REGEX = /(?<![\w.])\$?(\d+(?:\.\d{1,2})?)(?![\w])/;

export function parseManualEntry(text: string): ParsedMessage {
  const trimmed = text.trim();
  const match = trimmed.match(AMOUNT_REGEX);

  if (!match) {
    return { amount: null, description: trimmed || null };
  }

  const amount = parseFloat(match[1]);
  const description = (trimmed.slice(0, match.index) + trimmed.slice((match.index ?? 0) + match[0].length))
    .replace(/\s+/g, " ")
    .trim();

  return {
    amount: Number.isFinite(amount) ? amount : null,
    description: description || null,
  };
}
