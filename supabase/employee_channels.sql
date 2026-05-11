create extension if not exists pgcrypto;

alter table public.employees
add column if not exists channel text null;

create table if not exists public.employee_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#7765e3',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists employee_channels_organization_id_idx
  on public.employee_channels (organization_id);

alter table public.employee_channels enable row level security;

drop policy if exists "organization members can select employee channels" on public.employee_channels;
create policy "organization members can select employee channels"
on public.employee_channels
for select
to authenticated
using (
  exists (
    select 1
    from public.employees e
    where e.organization_id = employee_channels.organization_id
      and e.auth_user_id = auth.uid()
  )
);

drop policy if exists "organization members can insert employee channels" on public.employee_channels;
create policy "organization members can insert employee channels"
on public.employee_channels
for insert
to authenticated
with check (
  exists (
    select 1
    from public.employees e
    where e.organization_id = employee_channels.organization_id
      and e.auth_user_id = auth.uid()
  )
);

drop policy if exists "organization members can delete employee channels" on public.employee_channels;
create policy "organization members can delete employee channels"
on public.employee_channels
for delete
to authenticated
using (
  exists (
    select 1
    from public.employees e
    where e.organization_id = employee_channels.organization_id
      and e.auth_user_id = auth.uid()
  )
);

drop policy if exists "organization members can update checked employee status and channel" on public.employees;
create policy "organization members can update checked employee status and channel"
on public.employees
for update
to authenticated
using (
  exists (
    select 1
    from public.employees member
    where member.organization_id = employees.organization_id
      and member.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.employees member
    where member.organization_id = employees.organization_id
      and member.auth_user_id = auth.uid()
  )
);
