-- NULL preserves legacy meetings whose locations already differ.
alter table public.timetable_classes add column if not exists location_override boolean;
comment on column public.timetable_classes.location_override is 'true: per-meeting location; false: shared course location; null: infer legacy differences';
