/**
 * Run once after each deploy (or whenever the URL/secret changes):
 *   npm run set-webhook
 *
 * Reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and PUBLIC_APP_URL from
 * the environment and tells Telegram where to send updates.
 */
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = process.env.PUBLIC_APP_URL;

if (!token || !secret || !appUrl) {
  console.error(
    "Missing one of TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, PUBLIC_APP_URL in the environment."
  );
  process.exit(1);
}

const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;

async function main() {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      drop_pending_updates: true,
    }),
  });

  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));

  if (!body.ok) {
    process.exit(1);
  }
  console.log(`\nWebhook set to: ${webhookUrl}`);
}

main();
