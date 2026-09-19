-- Run once in the Supabase SQL editor. All three parts matter:
-- RLS blocks anon writes until disabled, and realtime is off per-table.
-- Safe to re-run.

create table if not exists reports (
  edge_id    text primary key,
  type       text not null,
  count      int  not null default 1,
  created_at timestamptz not null default now()
);

alter table reports disable row level security;

-- `alter publication ... add table` has no IF NOT EXISTS and errors on a
-- second run, which would abort the rest of this file at exactly the hour
-- nobody wants to debug it.
do $$
begin
  alter publication supabase_realtime add table reports;
exception
  when duplicate_object then null;
end $$;

create or replace function confirm_report(p_edge text, p_type text)
returns void language sql as $$
  insert into reports (edge_id, type) values (p_edge, p_type)
  on conflict (edge_id) do update set count = reports.count + 1;
$$;
