create table if not exists employee_stats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null,
  dialogs integer not null default 0,
  registrations integer not null default 0,
  first_deposits integer not null default 0,
  repeat_deposits integer not null default 0,
  created_at timestamptz not null default now(),
  constraint employee_stats_unique unique (organization_id, employee_id, date)
);

alter table employee_stats enable row level security;

create policy "org members can manage stats"
  on employee_stats
  for all
  using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );
