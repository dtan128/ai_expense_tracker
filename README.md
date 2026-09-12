# Telegram Expenses Tracker — Phase 1

**Scope of this phase:** Telegram bot + full database schema. Manual entries
only — no LLM categorization yet (that's Phase 2). Every log gets an in-chat
confirmation with a 7-category picker: Food, Transport, Shopping, Bills,
Entertainment, Groceries, Other.

## What's in this build

- `schema.sql` — the `expenses` table, with all fields the full 4-phase plan
  needs (so later phases don't require a migration).
- `src/lib/db.ts` — Supabase client + typed helper functions.
- `src/lib/parse.ts` — simple regex-based amount extraction (no AI yet).
- `src/lib/bot.ts` — the grammY bot: message handling, category-picker inline
  keyboard, edit/undo buttons, single-user gate.
- `pages/api/telegram/webhook.ts` — the webhook endpoint, verifies Telegram's
  secret token before processing anything.
- `scripts/set-webhook.ts` — registers the webhook URL + secret with Telegram.

## Setup

### 1. Create your Telegram bot
1. Message **@BotFather** on Telegram, send `/newbot`, follow the prompts.
2. Copy the token it gives you — this is `TELEGRAM_BOT_TOKEN`.
3. Message **@userinfobot** to get your own numeric Telegram user ID — this
   is `TELEGRAM_ALLOWED_USER_ID`. This locks the bot to only respond to you.

### 2. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → New project (free tier).
2. In the SQL editor, paste and run the contents of `schema.sql`.
3. Go to Project Settings → API. Copy the **Project URL** (`SUPABASE_URL`)
   and the **service_role** key — not the anon key — (`SUPABASE_SERVICE_ROLE_KEY`).

### 3. Set environment variables
Copy `.env.example` to `.env.local` for local dev, and fill in the same
values in Vercel's dashboard (Project → Settings → Environment Variables)
for production. Generate `TELEGRAM_WEBHOOK_SECRET` yourself, e.g.:

```bash
openssl rand -hex 32
```

### 4. Install dependencies and deploy
```bash
npm install
```
Push this repo to GitHub, then import it into [Vercel](https://vercel.com)
(free tier). Add the environment variables there too, then deploy.

### 5. Point Telegram at your deployment
Once deployed, set `PUBLIC_APP_URL` to your Vercel URL (e.g.
`https://your-app.vercel.app`) and run:
```bash
npm run set-webhook
```
This tells Telegram to POST updates to `/api/telegram/webhook` and to
include your secret token on every request.

### 6. Test it
Message your bot on Telegram:
```
12.50 lunch at Subway
```
It should reply with the parsed amount and a row of category buttons. Tap
one — the message should update to show the confirmed category with
"Edit category" / "Undo" buttons.

## Security notes (already built in)
- Webhook rejects any request without the correct `secret_token` header.
- `external_id` (Telegram message ID) has a unique index — a retried
  delivery can't create a duplicate expense.
- Bot ignores messages from anyone whose Telegram user ID doesn't match
  `TELEGRAM_ALLOWED_USER_ID`.
- No secrets are hardcoded — everything sensitive comes from environment
  variables.

## Not in this phase (coming later)
- LLM categorization (Phase 2) — for now you always pick the category
  yourself via the buttons.
- Web dashboard (Phase 3).
- Email/SMS bank forwarding + duplicate detection (Phase 4).
- Weekly backup export (planned for Phase 4, per the security requirements
  in the spec).

## A known rough edge to expect
Supabase's free tier pauses a project after 7 days of total inactivity —
if you go quiet for a week, you'll need to click "resume" in the Supabase
dashboard before the bot works again. Not a bug, just a free-tier quirk.
