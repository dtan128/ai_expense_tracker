import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthenticated } from "@/lib/auth";
import { updateExpenseFields, deleteExpense, CATEGORIES, Category } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { id } = req.query;
  if (typeof id !== "string") {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  if (req.method === "PATCH") {
    const { amount, merchant, description, category } = req.body ?? {};
    const fields: Record<string, unknown> = {};

    if (amount !== undefined) {
      const n = Number(amount);
      if (!Number.isFinite(n)) {
        res.status(400).json({ error: "Invalid amount" });
        return;
      }
      fields.amount = n;
    }
    if (merchant !== undefined) fields.merchant = merchant;
    if (description !== undefined) fields.description = description;
    if (category !== undefined) {
      if (!CATEGORIES.includes(category as Category)) {
        res.status(400).json({ error: "Invalid category" });
        return;
      }
      fields.category = category as Category;
    }

    const { data, error } = await updateExpenseFields(id, fields);
    if (error || !data) {
      console.error("Failed to update expense:", error);
      res.status(500).json({ error: "Failed to update expense" });
      return;
    }
    res.status(200).json({ expense: data });
    return;
  }

  if (req.method === "DELETE") {
    const { error } = await deleteExpense(id);
    if (error) {
      console.error("Failed to delete expense:", error);
      res.status(500).json({ error: "Failed to delete expense" });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
