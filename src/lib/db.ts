import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
}

// Server-side only client using the service role key. Never import this file
// from client-side code — the service role key bypasses row-level security.
export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

export const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Groceries",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type ExpenseSource = "telegram" | "sms" | "email" | "dashboard";
export type ExpenseStatus = "confirmed" | "pending_review" | "possible_duplicate";
export type CategorySource = "llm" | "user_corrected" | "manual";

export interface NewExpenseInput {
  amount: number;
  currency?: string;
  merchant?: string | null;
  description?: string | null;
  category?: Category;
  category_source?: CategorySource;
  category_confidence?: number | null;
  transaction_date?: string; // YYYY-MM-DD
  source: ExpenseSource;
  raw_text: string;
  status?: ExpenseStatus;
  external_id?: string | null;
}

/**
 * Insert a new expense. Relies on the unique index on external_id for
 * idempotency: a retried delivery with the same external_id will throw a
 * unique-violation (Postgres code 23505) instead of creating a duplicate row.
 * Callers should catch that specific error and treat it as a no-op success.
 */
export async function insertExpense(input: NewExpenseInput) {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      amount: input.amount,
      currency: input.currency ?? "SGD",
      merchant: input.merchant ?? null,
      description: input.description ?? null,
      category: input.category ?? "Other",
      category_source: input.category_source ?? "manual",
      category_confidence: input.category_confidence ?? null,
      transaction_date: input.transaction_date ?? new Date().toISOString().slice(0, 10),
      source: input.source,
      raw_text: input.raw_text,
      status: input.status ?? "pending_review",
      external_id: input.external_id ?? null,
    })
    .select()
    .single();

  return { data, error };
}

export async function updateExpenseCategory(
  id: string,
  category: Category,
  categorySource: CategorySource = "user_corrected"
) {
  return supabase
    .from("expenses")
    .update({ category, category_source: categorySource, status: "confirmed" })
    .eq("id", id)
    .select()
    .single();
}

export async function deleteExpense(id: string) {
  return supabase.from("expenses").delete().eq("id", id);
}

export async function getExpenseById(id: string) {
  return supabase.from("expenses").select("*").eq("id", id).single();
}
