-- Run once in the Supabase SQL editor. All three statements matter:
-- RLS blocks anon writes until disabled, and realtime is off per-table.

create table if not exists reports (
  edge_id    text primary key,
  type       text not null,
  count      int  not null default 1,
  created_at timestamptz not null default now()
);

alter table reports disable row level security;
alter publication supabase_realtime add table reports;

create or replace function confirm_report(p_edge text, p_type text)
returns void language sql as $$
  insert into reports (edge_id, type) values (p_edge, p_type)
  on conflict (edge_id) do update set count = reports.count + 1;
$$;
