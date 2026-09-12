// Shared category constants — no server-only imports here (no Supabase client,
// no env vars). Safe to import from client-rendered components. Anything that
// needs the database should import from "./db" instead, which re-exports these.

export const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Groceries",
  "Family",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];
