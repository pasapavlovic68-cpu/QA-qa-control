create extension if not exists pgcrypto;

create table if not exists public.employee_schedule (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  status text not null check (status in ('work', 'off', 'vacation', 'sick')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index if not exists employee_schedule_organization_id_idx
  on public.employee_schedule (organization_id);

create index if not exists employee_schedule_employee_date_idx
  on public.employee_schedule (employee_id, work_date);

alter table public.employee_schedule enable row level security;

drop policy if exists "organization members can select employee schedule" on public.employee_schedule;
create policy "organization members can select employee schedule"
on public.employee_schedule
for select
to authenticated
using (
  exists (
    select 1
    from public.employees member
    where member.organization_id = employee_schedule.organization_id
      and member.auth_user_id = auth.uid()
  )
);

drop policy if exists "organization members can insert employee schedule" on public.employee_schedule;
create policy "organization members can insert employee schedule"
on public.employee_schedule
for insert
to authenticated
with check (
  exists (
    select 1
    from public.employees member
    where member.organization_id = employee_schedule.organization_id
      and member.auth_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.employees checked_employee
    where checked_employee.id = employee_schedule.employee_id
      and checked_employee.organization_id = employee_schedule.organization_id
  )
);

drop policy if exists "organization members can update employee schedule" on public.employee_schedule;
create policy "organization members can update employee schedule"
on public.employee_schedule
for update
to authenticated
using (
  exists (
    select 1
    from public.employees member
    where member.organization_id = employee_schedule.organization_id
      and member.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.employees member
    where member.organization_id = employee_schedule.organization_id
      and member.auth_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.employees checked_employee
    where checked_employee.id = employee_schedule.employee_id
      and checked_employee.organization_id = employee_schedule.organization_id
  )
);

drop policy if exists "organization members can delete employee schedule" on public.employee_schedule;
create policy "organization members can delete employee schedule"
on public.employee_schedule
for delete
to authenticated
using (
  exists (
    select 1
    from public.employees member
    where member.organization_id = employee_schedule.organization_id
      and member.auth_user_id = auth.uid()
  )
);
