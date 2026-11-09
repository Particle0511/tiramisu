-- Evidence records gathered for a dispute (what the draft is allowed to cite)
create table if not exists records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dispute_id uuid not null references disputes(id) on delete cascade,
  record_type text not null,
  source text not null default 'paypal' check (source in ('paypal', 'seed')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists records_dispute_idx on records (dispute_id);

-- Message thread (buyer text is untrusted input)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dispute_id uuid not null references disputes(id) on delete cascade,
  sender_role text not null check (sender_role in ('buyer', 'seller')),
  body text not null,
  injection_flag boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now()
);
create index if not exists messages_dispute_idx on messages (dispute_id);

alter table records enable row level security;
alter table messages enable row level security;