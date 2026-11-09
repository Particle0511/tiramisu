alter table tenants add column if not exists max_refund_minor bigint not null default 5000;

create table if not exists pending_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  dispute_id uuid not null references disputes(id) on delete cascade,
  action_type text not null check (action_type in ('REFUND', 'UPLOAD_TRACKING', 'RESPOND')),
  payload jsonb not null default '{}',
  amount_minor bigint,
  currency text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired', 'executed', 'failed')),
  created_by text not null,
  decided_by text,
  decided_at timestamptz,
  expires_at timestamptz not null,
  result jsonb,
  created_at timestamptz not null default now()
);
create index if not exists pending_actions_tenant_idx on pending_actions (tenant_id, status);

create table if not exists audit_log (
  tenant_id uuid not null references tenants(id),
  seq bigint not null,
  actor text not null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}',
  prev_hash text not null,
  hash text not null,
  created_at timestamptz not null,
  primary key (tenant_id, seq)
);

-- Append-only: edits and deletes are refused
create or replace function audit_log_immutable() returns trigger as $$
begin
  raise exception 'audit_log is append-only';
end;
$$ language plpgsql;

drop trigger if exists audit_log_no_change on audit_log;
create trigger audit_log_no_change
  before update or delete on audit_log
  for each row execute function audit_log_immutable();

alter table pending_actions enable row level security;
alter table audit_log enable row level security;