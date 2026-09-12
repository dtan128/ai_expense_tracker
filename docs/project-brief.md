# Project: Telegram Expenses Tracker

I want to build a personal expense tracker for my own use — no App Store
app, no professional dev team, just me maintaining it with your help.
Use a multi-agent team to plan and build this in phases, checking in with
me between phases rather than running the whole thing autonomously in one
pass.

## Goals

1. I can log an expense by typing a message in Telegram (e.g. "12.50 lunch
   at Subway" or "grabbed coffee $6") and have it automatically:
   - Parse the amount and merchant/description
   - Categorize it (e.g. Food, Transport, Shopping, Bills, Entertainment,
     Other) using an LLM call
   - Save it to a database
2. I can forward bank/credit-card transaction SMS or emails to a fixed
   address/webhook and have those parsed and logged the same way.
3. I can view my spending on my iPhone via a simple web dashboard,
   installable to the home screen as a PWA — no App Store submission.
4. Editing/deleting entries, monthly totals by category, and a simple
   chart of spending over time.

## Constraints

- No App Store distribution. iPhone access is via Telegram (already
  cross-platform) and a web app / PWA.
- iOS does not allow reading other apps' notifications directly — do not
  propose that anywhere in the plan. Use Shortcuts-based forwarding or
  email/SMS forwarding into a webhook instead.
- Keep hosting cheap or free (e.g. a single small server, or serverless
  functions + a hosted database like Supabase/Postgres).
- Favor simplicity over enterprise architecture — this is a solo,
  single-user tool.
- This app will hold my real financial transaction data (amounts,
  merchants, dates). Treat basic security (secrets in env vars, an
  authenticated webhook, no public read access to my data) as a hard
  requirement, not a nice-to-have.

## Agent team and roles

Please organize the work using these roles, and tell me at the start of
each phase which agent is doing what:

**Research Agent** — Investigates and reports, doesn't write final code.
Compares Telegram bot frameworks, free/cheap hosting + database options,
and confirms the iOS Shortcuts notification-forwarding approach is
workable. Produces a short comparison, not a final decision.

**Architect Agent** — Takes the Research Agent's findings and turns them
into a concrete spec before any code is written: final stack choice,
database schema (expenses table: amount, merchant, category, date,
source), the API contract between Telegram bot → backend → dashboard, and
the phase order for building it.

**Code Agent** — Builds strictly to the Architect's spec, one phase at a
time. Suggested phases:
  1. Telegram bot that logs raw message text to the database
  2. LLM categorization logic layered on top
  3. Web dashboard (view/edit/delete, monthly totals, chart)
  4. Bank/email forwarding webhook

**Reviewer Agent** — Reviews each phase's code for:
  - Correctness and code quality
  - Security: are secrets hardcoded anywhere? Is the forwarding webhook
    authenticated, or could anyone who finds the URL inject fake
    transactions?
  - Categorization accuracy: test against 15-20 realistic sample
    messages (clean typed entries AND messy forwarded bank text), not
    just clean examples.

**QA/Test-Data Agent** — Before I approve a phase as done, generates edge
cases and feeds them through: malformed messages, duplicate entries,
unusual amounts/currency formatting, a forwarded email that doesn't match
the expected format. Reports back what breaks.

## Workflow

For each phase: Code builds it → Reviewer + QA check it → issues get
fixed → you summarize what changed and what I should test myself → I
approve before moving to the next phase. Don't proceed past a phase
without my go-ahead, since I'll be checking in from my phone between
sessions rather than watching continuously.

## First deliverable

Start with Research + Architect only. Give me:
1. The recommended stack and why (in plain language, I'm not a
   professional developer)
2. The database schema
3. The categorization prompt/logic design, with 2-3 example
   inputs/outputs
4. The phase plan

Wait for my confirmation before Code Agent starts Phase 1.
