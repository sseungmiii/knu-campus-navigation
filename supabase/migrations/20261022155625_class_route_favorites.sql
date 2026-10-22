-- Favorites inherit the existing timetable owner RLS and are removed with their class.
begin;
alter table public.timetable_classes add column favorite_route jsonb;
alter table public.timetable_classes add constraint timetable_favorite_size
  check (favorite_route is null or (jsonb_typeof(favorite_route) = 'object' and octet_length(favorite_route::text) <= 4096));
commit;
