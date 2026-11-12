alter table webhook_events add column if not exists attempts int not null default 0;
alter table webhook_events add column if not exists last_error text;
create index if not exists webhook_events_unprocessed_idx
  on webhook_events (created_at) where processed_at is null;