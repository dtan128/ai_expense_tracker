import type { NextApiRequest, NextApiResponse } from "next";
import { isAuthenticated } from "@/lib/auth";
import { getMonthSummary } from "@/lib/db";
import { shiftMonth } from "@/lib/date";

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

  const [summary, previous] = await Promise.all([
    getMonthSummary(month),
    getMonthSummary(shiftMonth(month, -1)),
  ]);

  res.status(200).json({ ...summary, previousTotal: previous.total });
}
