# Telegram Expenses Tracker

A personal expense tracker with no App Store app and no team — just a
Telegram bot for logging expenses and a passcode-protected web dashboard for
reviewing them. Built in phases; see `docs/project-brief.md` for the original
spec.

## How it works

1. **Log an expense on Telegram** — message the bot something like
   `12.50 lunch at Subway` or `grabbed coffee $6`.
2. **An LLM categorizes it** (merchant, amount, currency, category,
   confidence) via the Anthropic API. High-confidence results are logged
   straight away with a chance to correct them; low-confidence ones ask you
   to confirm the category via inline buttons.
3. **If the LLM is unavailable or no API key is set**, the bot falls back to
   a free regex-based parser (amount + description only) and always asks you
   to pick the category manually — the bot never goes silent on a real
   message.
4. **Review and edit on the dashboard** — open the web app, unlock it with a
   passcode, and see a monthly total, a category breakdown, a calendar
   heatmap of daily spend, a spend-over-time chart, and an editable
   transaction list. Everything reads from the same Supabase table the bot
   writes to.

## Project layout

- `schema.sql` — the `expenses` table (all fields the full plan needs, so
  later phases don't require a migration).
- `src/lib/db.ts` — Supabase client (service role, server-only) + all query
  helpers, for both the bot and the dashboard.
- `src/lib/categories.ts` — the category list and `Category` type. Kept
  separate from `db.ts` deliberately: it's imported from client-rendered
  dashboard code, and `db.ts` creates a Supabase client using a secret key at
  module load time — importing that into browser code would ship the secret
  client-side and crash in the browser (env vars aren't available there).
- `src/lib/parse.ts` — the regex fallback parser (Phase 1 behavior).
- `src/lib/categorize.ts` — the Anthropic LLM call for structured
  categorization; throws if `ANTHROPIC_API_KEY` isn't set so the bot's
  fallback kicks in.
- `src/lib/bot.ts` — the grammY bot: message handling, LLM-first with
  regex fallback, category picker, edit/undo buttons, single-user gate.
- `src/lib/auth.ts` — dashboard session handling (see below).
- `src/lib/date.ts` — month/day formatting and calendar-grid helpers for the
  dashboard.
- `src/lib/categoryStyle.ts` — consistent per-category colors used across the
  chart, calendar, and transaction list.
- `pages/api/telegram/webhook.ts` — the bot's webhook endpoint; verifies
  Telegram's secret token before processing anything.
- `pages/api/auth/{login,logout}.ts`, `pages/api/expenses/*`,
  `pages/api/summary.ts` — the dashboard's API, all session-gated.
- `pages/login.tsx`, `pages/dashboard.tsx` — the dashboard UI.
- `scripts/set-webhook.ts` — registers the webhook URL + secret with
  Telegram.

### Dashboard sessions

The dashboard is single-passcode, not per-user accounts. Logging in sets a
signed cookie — `${expiresAt}.${hmacSignature}` — verified with
`SESSION_SECRET` on every request. There's no session table or DB lookup;
the cookie verifies itself. See `src/lib/auth.ts`.

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

### 3. (Optional) Get an Anthropic API key
Create a key at [console.anthropic.com](https://console.anthropic.com) →
API Keys, and set it as `ANTHROPIC_API_KEY`. Without one, the bot still
works fully via the regex fallback + manual category picker — this is only
for automatic categorization.

### 4. Set environment variables
Copy `.env.example` to `.env.local` for local dev, and set the same values
in Vercel's dashboard (Project → Settings → Environment Variables) for
production. Generate `TELEGRAM_WEBHOOK_SECRET`, `SESSION_SECRET`, and pick a
`DASHBOARD_PASSCODE`:
```bash
openssl rand -hex 32
```

### 5. Install dependencies and deploy
```bash
npm install
```
Push this repo to GitHub, then import it into [Vercel](https://vercel.com)
(free tier). Add the environment variables there too, then deploy.

### 6. Point Telegram at your deployment
Once deployed, set `PUBLIC_APP_URL` to your Vercel URL (e.g.
`https://your-app.vercel.app`) and run:
```bash
npm run set-webhook
```
This tells Telegram to POST updates to `/api/telegram/webhook` and to
include your secret token on every request.

For local development, run `npm run dev` and tunnel port 3000 with
[ngrok](https://ngrok.com) (`ngrok http 3000`), then set `PUBLIC_APP_URL` to
the ngrok URL before running `npm run set-webhook`.

### 7. Test it
Message your bot on Telegram:
```
12.50 lunch at Subway
```
It should reply with the parsed amount and either a confirmed category (LLM
path) or a row of category buttons to tap (fallback path). Then open your
deployment's root URL, enter your `DASHBOARD_PASSCODE`, and confirm the
expense shows up on the dashboard.

## Security notes (already built in)
- Webhook rejects any request without the correct Telegram `secret_token`
  header.
- `external_id` (Telegram message ID) has a unique index — a retried
  delivery can't create a duplicate expense.
- Bot ignores messages from anyone whose Telegram user ID doesn't match
  `TELEGRAM_ALLOWED_USER_ID`.
- Dashboard API routes all check the signed session cookie before touching
  the database; the passcode check and cookie signature check are both
  constant-time comparisons.
- The Supabase service-role client (`src/lib/db.ts`) is server-only by
  construction — see `src/lib/categories.ts` above for why it's split out.
- No secrets are hardcoded — everything sensitive comes from environment
  variables.

## Known rough edges
- Supabase's free tier pauses a project after 7 days of total inactivity —
  if you go quiet for a week, you'll need to click "resume" in the Supabase
  dashboard before the bot works again.
- `next@14.2.x` currently has known advisories with no non-breaking fix
  (`npm audit` will flag them); upgrading to `next@16` is a deliberate,
  separate decision, not something to silently pull in via `npm audit fix
  --force`.

## Not yet built
- Email/SMS bank forwarding + duplicate detection (Phase 4).
- Weekly backup export.
