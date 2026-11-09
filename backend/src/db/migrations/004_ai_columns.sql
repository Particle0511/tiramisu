alter table disputes add column if not exists ai_generations int not null default 0;
alter table disputes add column if not exists ai_error text;