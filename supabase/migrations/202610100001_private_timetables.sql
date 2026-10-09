begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Two fixed slots enforce a maximum of two distinct authorized Auth users.
create table private.schedule_users (
  slot smallint primary key check (slot in (1, 2)),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table private.schedule_users enable row level security;
revoke all on private.schedule_users from public, anon, authenticated;

create function public.is_schedule_user() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.schedule_users where user_id = (select auth.uid())); $$;
revoke all on function public.is_schedule_user() from public, anon;
grant execute on function public.is_schedule_user() to authenticated;

create table public.timetable_classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  term text not null check (char_length(btrim(term)) between 1 and 60),
  weekday smallint not null check (weekday between 1 and 7),
  start_minute smallint not null check (start_minute between 0 and 1438),
  end_minute smallint not null check (end_minute between 1 and 1439 and end_minute > start_minute),
  place_name text not null check (char_length(btrim(place_name)) between 1 and 150),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index timetable_classes_owner_day on public.timetable_classes(owner_id, weekday, start_minute);
alter table public.timetable_classes enable row level security;
alter table public.timetable_classes force row level security;
revoke all on public.timetable_classes from public, anon, authenticated;
grant select, insert, update, delete on public.timetable_classes to authenticated;

create policy own_allowed_select on public.timetable_classes for select to authenticated
using (owner_id = (select auth.uid()) and (select public.is_schedule_user()));
create policy own_allowed_insert on public.timetable_classes for insert to authenticated
with check (owner_id = (select auth.uid()) and (select public.is_schedule_user()));
create policy own_allowed_update on public.timetable_classes for update to authenticated
using (owner_id = (select auth.uid()) and (select public.is_schedule_user()))
with check (owner_id = (select auth.uid()) and (select public.is_schedule_user()));
create policy own_allowed_delete on public.timetable_classes for delete to authenticated
using (owner_id = (select auth.uid()) and (select public.is_schedule_user()));

create function private.touch_timetable() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
revoke all on function private.touch_timetable() from public, anon, authenticated;
create trigger timetable_updated before update on public.timetable_classes
for each row execute function private.touch_timetable();
-- Empty allowlist is intentional: all users are denied until the owner assigns both slots.
commit;
