import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthenticated } from "@/lib/auth";
import { listExpenses, Category } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const month =
    typeof req.query.month === "string" ? req.query.month : new Date().toISOString().slice(0, 7);
  const category =
    typeof req.query.category === "string" ? (req.query.category as Category | "all") : "all";

  const { data, error } = await listExpenses({ month, category });

  if (error) {
    console.error("Failed to list expenses:", error);
    res.status(500).json({ error: "Failed to fetch expenses" });
    return;
  }

  res.status(200).json({ expenses: data });
}
