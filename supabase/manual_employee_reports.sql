create table if not exists public.manual_employee_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  dialogues_count integer not null default 0 check (dialogues_count >= 0),
  fd_count integer not null default 0 check (fd_count >= 0),
  rd_count integer not null default 0 check (rd_count >= 0),
  fd_amount numeric not null default 0 check (fd_amount >= 0),
  rd_amount numeric not null default 0 check (rd_amount >= 0),
  avg_response_time text,
  notes text,
  recommendations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_id, period_start)
);

create index if not exists manual_employee_reports_org_period_idx
  on public.manual_employee_reports (organization_id, period_start desc);

create index if not exists manual_employee_reports_employee_period_idx
  on public.manual_employee_reports (employee_id, period_start desc);

alter table public.manual_employee_reports enable row level security;

drop policy if exists "organization members can select manual employee reports" on public.manual_employee_reports;
create policy "organization members can select manual employee reports"
on public.manual_employee_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.employees member
    where member.organization_id = manual_employee_reports.organization_id
      and member.auth_user_id = auth.uid()
  )
);

drop policy if exists "organization members can insert manual employee reports" on public.manual_employee_reports;
create policy "organization members can insert manual employee reports"
on public.manual_employee_reports
for insert
to authenticated
with check (
  exists (
    select 1
    from public.employees member
    where member.organization_id = manual_employee_reports.organization_id
      and member.auth_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.employees checked_employee
    where checked_employee.id = manual_employee_reports.employee_id
      and checked_employee.organization_id = manual_employee_reports.organization_id
      and checked_employee.auth_user_id is null
  )
);

drop policy if exists "organization members can update manual employee reports" on public.manual_employee_reports;
create policy "organization members can update manual employee reports"
on public.manual_employee_reports
for update
to authenticated
using (
  exists (
    select 1
    from public.employees member
    where member.organization_id = manual_employee_reports.organization_id
      and member.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.employees member
    where member.organization_id = manual_employee_reports.organization_id
      and member.auth_user_id = auth.uid()
  )
  and exists (
    select 1
    from public.employees checked_employee
    where checked_employee.id = manual_employee_reports.employee_id
      and checked_employee.organization_id = manual_employee_reports.organization_id
      and checked_employee.auth_user_id is null
  )
);

drop policy if exists "organization members can delete manual employee reports" on public.manual_employee_reports;
create policy "organization members can delete manual employee reports"
on public.manual_employee_reports
for delete
to authenticated
using (
  exists (
    select 1
    from public.employees member
    where member.organization_id = manual_employee_reports.organization_id
      and member.auth_user_id = auth.uid()
  )
);
