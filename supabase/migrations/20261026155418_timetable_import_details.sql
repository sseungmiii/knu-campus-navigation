begin;
alter table public.timetable_classes add column room text not null default '' check(char_length(room)<=80);
alter table public.timetable_classes add column professor text not null default '' check(char_length(professor)<=80);
alter table public.timetable_classes add column display_end_minute smallint check(display_end_minute between 1 and 1439 and display_end_minute>=end_minute and display_end_minute-end_minute<=60);
commit;
