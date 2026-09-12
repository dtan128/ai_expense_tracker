-- Telegram Expenses Tracker — Database Schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) before starting the bot.

create extension if not exists "pgcrypto";

create table if not exists expenses (
  id                   uuid primary key default gen_random_uuid(),
  amount               numeric(12,2) not null,          -- negative = refund/credit
  currency             text not null default 'SGD',     -- ISO 4217
  merchant             text,
  description          text,                             -- free-text note
  category             text not null default 'Other'
    check (category in ('Food','Transport','Shopping','Bills','Entertainment','Groceries','Family','Other')),
  category_source      text not null default 'manual'   -- 'llm' | 'user_corrected' | 'manual'
    check (category_source in ('llm','user_corrected','manual')),
  category_confidence  numeric(3,2),                     -- 0.00–1.00, null if not LLM-scored
  original_category    text,                             -- LLM's first guess, kept even after a user correction
  transaction_date     date not null default current_date, -- when the purchase happened
  logged_at            timestamptz not null default now(), -- when it entered the system
  source               text not null                     -- 'telegram' | 'sms' | 'email' | 'dashboard'
    check (source in ('telegram','sms','email','dashboard')),
  raw_text             text,                             -- original message/SMS/email body, verbatim
  status               text not null default 'confirmed' -- 'confirmed' | 'pending_review' | 'possible_duplicate'
    check (status in ('confirmed','pending_review','possible_duplicate')),
  duplicate_of         uuid references expenses(id),
  external_id          text,                             -- Telegram message id / email Message-ID — idempotency key
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Idempotency: a retried webhook delivery with the same external_id simply fails to insert.
create unique index if not exists expenses_external_id_idx
  on expenses(external_id) where external_id is not null;

create index if not exists expenses_transaction_date_idx on expenses(transaction_date);
create index if not exists expenses_status_idx on expenses(status);

-- Keep updated_at current on every edit.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists expenses_set_updated_at on expenses;
create trigger expenses_set_updated_at
  before update on expenses
  for each row execute function set_updated_at();
