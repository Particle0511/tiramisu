
alter table tenants drop constraint if exists tenants_max_refund_range;
alter table tenants add constraint tenants_max_refund_range
  check (max_refund_minor >= 0 and max_refund_minor <= 1000000);

grant update (max_refund_minor) on tenants to tiramisu_app;

drop policy if exists app_tenant_update on tenants;
create policy app_tenant_update on tenants for update to tiramisu_app
  using (id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  with check (id = nullif(current_setting('app.tenant_id', true), '')::uuid);