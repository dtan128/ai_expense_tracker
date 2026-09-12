import type { NextApiRequest, NextApiResponse } from "next";
import { webhookCallback } from "grammy";
import { bot } from "@/lib/bot";

export const config = {
  api: {
    bodyParser: true,
  },
};

const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

const handleUpdate = webhookCallback(bot, "next-js");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  // Telegram echoes back the secret_token we set via setWebhook in every
  // request header. Reject anything that doesn't match — this is what stops
  // a random person who finds this URL from injecting fake updates.
  const receivedSecret = req.headers["x-telegram-bot-api-secret-token"];
  if (!expectedSecret || receivedSecret !== expectedSecret) {
    res.status(401).send("Unauthorized");
    return;
  }

  try {
    await handleUpdate(req, res);
  } catch (err) {
    console.error("Telegram webhook error:", err);
    if (!res.headersSent) {
      res.status(500).send("Internal error");
    }
  }
}
