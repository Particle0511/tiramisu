

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'tiramisu_app') then
    create role tiramisu_app login password 'CHANGE_ME_LONG_LETTERS_AND_DIGITS_ONLY'
      nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end
$$;

grant usage on schema public to tiramisu_app;
revoke all on all tables in schema public from tiramisu_app;
revoke all on all tables in schema public from anon, authenticated;

-- Only what the app really needs. No users table, no drops, no audit edits.
grant select on tenants to tiramisu_app;
grant select, insert, update, delete on disputes to tiramisu_app;
grant select, insert, delete on records to tiramisu_app;
grant select, insert, update, delete on messages to tiramisu_app;
grant select, insert, update on pending_actions to tiramisu_app;
grant select, insert on audit_log to tiramisu_app;
grant select, insert, update on webhook_events to tiramisu_app;

-- Row-level policies: the app role only sees the tenant set for the current transaction
drop policy if exists app_tenant on tenants;
create policy app_tenant on tenants for select to tiramisu_app
  using (id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists app_tenant on disputes;
create policy app_tenant on disputes for all to tiramisu_app
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists app_tenant on records;
create policy app_tenant on records for all to tiramisu_app
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists app_tenant on messages;
create policy app_tenant on messages for all to tiramisu_app
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists app_tenant on pending_actions;
create policy app_tenant on pending_actions for all to tiramisu_app
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

drop policy if exists app_tenant on audit_log;
create policy app_tenant on audit_log for all to tiramisu_app
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Webhook events are signature-verified PayPal data and carry no tenant
drop policy if exists app_all on webhook_events;
create policy app_all on webhook_events for all to tiramisu_app
  using (true) with check (true);

-- Sign-in lookup and first-time setup run as the owner, inside two small functions
create or replace function app_find_user(p_auth_user_id uuid)
returns table (out_tenant_id uuid, out_role text)
language sql security definer set search_path = public as $$
  select u.tenant_id, u.role from users u where u.auth_user_id = p_auth_user_id;
$$;

create or replace function app_provision_user(p_auth_user_id uuid, p_email text)
returns table (out_tenant_id uuid, out_role text, created boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_role text;
begin
  perform pg_advisory_xact_lock(hashtext(p_auth_user_id::text));

  select u.tenant_id, u.role into v_tenant, v_role
    from users u where u.auth_user_id = p_auth_user_id;
  if found then
    return query select v_tenant, v_role, false;
    return;
  end if;

  insert into tenants (name)
    values (coalesce(nullif(split_part(coalesce(p_email, ''), '@', 1), ''), 'Seller'))
    returning id into v_tenant;
  insert into users (auth_user_id, tenant_id, email, role)
    values (p_auth_user_id, v_tenant, p_email, 'owner');

  return query select v_tenant, 'owner'::text, true;
end
$$;

revoke all on function app_find_user(uuid) from public;
revoke all on function app_provision_user(uuid, text) from public;
grant execute on function app_find_user(uuid) to tiramisu_app;
grant execute on function app_provision_user(uuid, text) to tiramisu_app;