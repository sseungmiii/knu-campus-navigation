begin;
-- Keep existing classes and the former allowlist for rollback. Only eligibility changes.
-- RLS still requires owner_id = auth.uid() for every read and write.
create or replace function public.is_schedule_user() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users as member
    where member.id = (select auth.uid())
      and member.email is not null and member.email <> ''
      and member.email_confirmed_at is not null
      and (member.banned_until is null or member.banned_until <= now())
  );
$$;
revoke all on function public.is_schedule_user() from public, anon;
grant execute on function public.is_schedule_user() to authenticated;
commit;
