import { createClient } from "@supabase/supabase-js";
import { CATEGORIES, Category } from "./categories";

export { CATEGORIES };
export type { Category };

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

// --- Dashboard queries (Phase 3) ----------------------------------------

function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); // first day of next month
  return { start, end };
}

export async function listExpenses(params: { month: string; category?: Category | "all" }) {
  const { start, end } = monthRange(params.month);
  let query = supabase
    .from("expenses")
    .select("*")
    .gte("transaction_date", start)
    .lt("transaction_date", end)
    .order("transaction_date", { ascending: false })
    .order("logged_at", { ascending: false });

  if (params.category && params.category !== "all") {
    query = query.eq("category", params.category);
  }

  return query;
}

export interface MonthSummary {
  month: string;
  total: number;
  byCategory: { category: Category; total: number }[];
  byDay: { date: string; total: number }[];
}

export async function getMonthSummary(month: string): Promise<MonthSummary> {
  const { start, end } = monthRange(month);
  const { data, error } = await supabase
    .from("expenses")
    .select("amount, category, transaction_date")
    .gte("transaction_date", start)
    .lt("transaction_date", end);

  if (error || !data) {
    return { month, total: 0, byCategory: [], byDay: [] };
  }

  let total = 0;
  const categoryTotals = new Map<string, number>();
  const dayTotals = new Map<string, number>();

  for (const row of data) {
    total += row.amount;
    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.amount);
    dayTotals.set(
      row.transaction_date,
      (dayTotals.get(row.transaction_date) ?? 0) + row.amount
    );
  }

  const byCategory = CATEGORIES.map((category) => ({
    category,
    total: categoryTotals.get(category) ?? 0,
  }))
    .filter((c) => c.total !== 0)
    .sort((a, b) => b.total - a.total);

  const byDay = Array.from(dayTotals.entries())
    .map(([date, dayTotal]) => ({ date, total: dayTotal }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { month, total, byCategory, byDay };
}

export interface UpdateExpenseFields {
  amount?: number;
  merchant?: string | null;
  description?: string | null;
  category?: Category;
  status?: ExpenseStatus;
}

export async function updateExpenseFields(id: string, fields: UpdateExpenseFields) {
  const update: Record<string, unknown> = { ...fields };
  if (fields.category) {
    update.category_source = "user_corrected";
    if (!fields.status) update.status = "confirmed";
  }
  return supabase.from("expenses").update(update).eq("id", id).select().single();
}
