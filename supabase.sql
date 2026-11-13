-- Tabelle für die gemeinsamen Swipes (bereits angelegt)
create table if not exists public.swipes (
  trip text not null,
  name text not null,
  votes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (trip, name)
);
alter table public.swipes enable row level security;
create policy "lesen"     on public.swipes for select to anon using (trip = 'istanbul-2026');
create policy "eintragen" on public.swipes for insert to anon with check (trip = 'istanbul-2026' and name in ('Valä','Cha','Bettä'));
create policy "aendern"   on public.swipes for update to anon using (trip = 'istanbul-2026' and name in ('Valä','Cha','Bettä')) with check (trip = 'istanbul-2026' and name in ('Valä','Cha','Bettä'));
