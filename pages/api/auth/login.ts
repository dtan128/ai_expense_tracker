import type { NextApiRequest, NextApiResponse } from "next";
import { checkPasscode, sessionCookieHeader } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { passcode } = req.body ?? {};
  if (typeof passcode !== "string" || !passcode) {
    res.status(400).json({ error: "Passcode required" });
    return;
  }

  let valid: boolean;
  try {
    valid = checkPasscode(passcode);
  } catch (err) {
    console.error("Dashboard auth misconfigured:", err);
    res.status(500).json({ error: "Server not configured" });
    return;
  }

  if (!valid) {
    res.status(401).json({ error: "Incorrect passcode" });
    return;
  }

  res.setHeader("Set-Cookie", sessionCookieHeader());
  res.status(200).json({ ok: true });
}
