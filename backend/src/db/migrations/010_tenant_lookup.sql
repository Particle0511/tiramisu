create or replace function app_tenant_by_email(p_email text)
returns uuid
language sql security definer set search_path = public as $$
  select tenant_id from users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function app_tenant_by_email(text) from public;
grant execute on function app_tenant_by_email(text) to tiramisu_app;