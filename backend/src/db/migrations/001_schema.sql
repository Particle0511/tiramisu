-- Tenants: one row per seller account
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_currency text not null default 'USD',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

-- Raw PayPal webhook events (the unique ID blocks duplicates)
create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  paypal_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Disputes
create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  paypal_dispute_id text not null unique,
  dispute_type text,
  reason text,
  status text not null default 'OPEN',
  amount_minor bigint,
  currency text,
  opened_at timestamptz,
  response_due_at timestamptz,
  ai_status text not null default 'pending'
    check (ai_status in ('pending', 'done', 'failed')),
  ai_draft jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists disputes_tenant_idx on disputes (tenant_id);
create index if not exists disputes_due_idx on disputes (response_due_at);

-- Lock every table by default. With no policies, the public (anon) key
-- can read and write nothing. Policies come in the next step.
alter table tenants enable row level security;
alter table webhook_events enable row level security;
alter table disputes enable row level security;

-- One demo seller so we can test
insert into tenants (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Demo Seller')
on conflict (id) do nothing;