create table if not exists users (
  auth_user_id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text,
  role text not null default 'owner' check (role in ('owner', 'viewer')),
  created_at timestamptz not null default now()
);
alter table users enable row level security;