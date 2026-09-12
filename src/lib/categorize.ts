import { CATEGORIES, Category } from "./db";

const apiKey = process.env.ANTHROPIC_API_KEY;

export interface CategorizationResult {
  amount: number;
  currency: string;
  merchant: string | null;
  category: Category;
  confidence: number; // 0.00 - 1.00
}

// Below this, the bot asks the user to confirm/correct instead of trusting the model.
export const CONFIDENCE_THRESHOLD = 0.6;

const SYSTEM_PROMPT = `You extract structured expense data from short messages, which may be
typed by the user directly or forwarded from a bank SMS/email alert.

Respond with ONLY a single JSON object, no other text, no markdown fences. Shape:
{
  "amount": number,       // absolute value, e.g. 12.50. Negative only if it's clearly a refund/credit.
  "currency": string,     // ISO 4217 code, e.g. "SGD", "USD". Default to "SGD" if genuinely unclear.
  "merchant": string|null,// best-guess merchant/payee name, cleaned up (e.g. "NTUC FAIRPRICE" -> "NTUC Fairprice"). Null if none identifiable.
  "category": string,     // exactly one of: ${CATEGORIES.join(", ")}
  "confidence": number    // 0.00-1.00, your genuine confidence in the category choice specifically
}

Guidance on categories:
- Groceries = supermarket/wet market runs for household food stock.
- Food = eating out, cafes, food delivery, restaurants.
- A supermarket purchase is Groceries, not Food or Shopping.
- Family = spending on/for family members that isn't clearly another category (e.g. "dinner with mom" is ambiguous between Food and Family - use judgment, and lower confidence if genuinely unclear).
- If the message is messy/abbreviated bank text, still extract your best guess for every field.
- Confidence should be genuinely calibrated: an unambiguous case like "12.50 lunch at Subway" deserves ~0.95+, a genuinely ambiguous one (e.g. a supermarket purchase when the six categories don't cleanly cover groceries) deserves ~0.5-0.6, not artificially inflated.

If you cannot find an amount at all, respond with {"error": "no_amount_found"} instead.`;

export async function categorizeExpense(text: string): Promise<CategorizationResult | { error: string }> {
  if (!apiKey) {
    // No key configured — the caller (bot.ts) catches this and falls back
    // to the free regex parser + manual category picker from Phase 1.
    throw new Error("ANTHROPIC_API_KEY not set; LLM categorization disabled.");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");

  if (!textBlock?.text) {
    throw new Error("No text content in Anthropic response.");
  }

  // Defensive: strip accidental markdown fences even though the prompt forbids them.
  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${cleaned}`);
  }

  if (parsed && typeof parsed === "object" && "error" in parsed) {
    return parsed as { error: string };
  }

  const result = parsed as Partial<CategorizationResult>;

  if (
    typeof result.amount !== "number" ||
    typeof result.category !== "string" ||
    !CATEGORIES.includes(result.category as Category) ||
    typeof result.confidence !== "number"
  ) {
    throw new Error(`LLM response missing/invalid required fields: ${cleaned}`);
  }

  return {
    amount: Math.abs(result.amount),
    currency: typeof result.currency === "string" ? result.currency : "SGD",
    merchant: result.merchant ?? null,
    category: result.category as Category,
    confidence: Math.max(0, Math.min(1, result.confidence)),
  };
}
