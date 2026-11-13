-- Tabelle für die gemeinsamen Swipes (einmal im Supabase SQL Editor ausführen)
create table if not exists public.swipes (
  trip text not null,
  name text not null,
  votes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (trip, name)
);
alter table public.swipes enable row level security;
create policy "lesen"      on public.swipes for select to anon using (trip = 'istanbul-2026');
create policy "eintragen"  on public.swipes for insert to anon with check (trip = 'istanbul-2026' and length(name) between 1 and 40);
create policy "aendern"    on public.swipes for update to anon using (trip = 'istanbul-2026') with check (trip = 'istanbul-2026');
