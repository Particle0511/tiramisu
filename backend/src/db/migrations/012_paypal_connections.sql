create table if not exists paypal_connections (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  client_id text not null,
  secret_encrypted text not null,
  status text not null default 'connected' check (status in ('connected', 'invalid')),
  last_verified_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists paypal_connections_client_id_key on paypal_connections (client_id);

alter table paypal_connections enable row level security;
revoke all on paypal_connections from anon, authenticated;
grant select, insert, update, delete on paypal_connections to tiramisu_app;

drop policy if exists app_tenant on paypal_connections;
create policy app_tenant on paypal_connections for all to tiramisu_app
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);