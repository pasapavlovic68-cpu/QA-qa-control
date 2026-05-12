alter table public.employee_schedule
add column if not exists start_time time,
add column if not exists end_time time;
