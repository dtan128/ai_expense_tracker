# 💬 Telegram Expense Tracker

I got tired of paying $47–180/year for an app just to track a dozen SGD
transactions a month, so I built this instead: text a Telegram bot what I
spent, Claude guesses the category, and a passcode-protected dashboard shows
me where the money actually went.

No app to install. No bank credentials handed to a third party. $0/month to
run.

## What it does

- **Log an expense by texting the bot** — `12.50 lunch at Subway` or
  `grabbed coffee $6` both work.
- **Claude categorizes it** — merchant, amount, category, confidence.
  High confidence gets logged instantly with a chance to fix it; anything
  it's unsure about asks you to tap a category first.
- **No API key set?** It falls back to a simple parser + manual category
  picker instead of going silent.
- **A dashboard to see where it actually went** — monthly total with a
  trend vs last month, category breakdown, a calendar heatmap (darker day
  = spent more), a spend-over-time chart, per-category budgets with
  progress bars, and search across everything you've ever logged.

## Screenshots

<!-- Drop in the bot conversation + dashboard screenshots here -->

## Stack

Next.js on Vercel · Supabase (Postgres) · grammY for the Telegram bot ·
Claude Haiku for categorization. All free-tier — see
[`docs/SETUP.md`](docs/SETUP.md) for exact costs and limits.

## Setup

Full step-by-step walkthrough (BotFather → Supabase → Vercel → testing) is
in [`docs/SETUP.md`](docs/SETUP.md). Short version:

```bash
git clone https://github.com/dtan128/ai_expense_tracker.git
cd ai_expense_tracker
cp .env.example .env.local   # fill in your own tokens/keys
npm install
npm run dev
```

## How it's organized

Bot logic lives in `src/lib/`, dashboard pages in `pages/`, API routes
under `pages/api/`. `schema.sql` has the full database structure. Nothing
unusual — a fairly standard Next.js app.

## What's not built yet

- Bank forwarding (email + SMS) with duplicate detection
- A weekly automated backup export

## Known rough edges

- Supabase's free tier naps a project after 7 days of inactivity — you'll
  need to manually wake it up in the dashboard if you go quiet for a week.
- `next@14.2.x` has a couple of open security advisories with no clean
  non-breaking fix yet. Upgrading to Next 16 is on the list, just not a
  "run `npm audit fix --force`" kind of fix.

## License

MIT — see [`LICENSE`](LICENSE).
