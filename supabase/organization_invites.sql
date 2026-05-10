create extension if not exists pgcrypto;

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  status text not null default 'pending',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz null,
  accepted_auth_user_id uuid null,
  constraint organization_invites_status_check
    check (status in ('pending', 'accepted', 'revoked'))
);

create index if not exists organization_invites_organization_id_idx
  on public.organization_invites (organization_id);

create unique index if not exists organization_invites_pending_email_unique_idx
  on public.organization_invites (organization_id, lower(email))
  where status = 'pending';

alter table public.organization_invites enable row level security;

drop policy if exists "Organization members can select invites" on public.organization_invites;
create policy "Organization members can select invites"
on public.organization_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.employees e
    where e.organization_id = organization_invites.organization_id
      and e.auth_user_id = auth.uid()
  )
);

drop policy if exists "Organization members can insert invites" on public.organization_invites;
create policy "Organization members can insert invites"
on public.organization_invites
for insert
to authenticated
with check (
  exists (
    select 1
    from public.employees e
    where e.organization_id = organization_invites.organization_id
      and e.auth_user_id = auth.uid()
  )
);

drop policy if exists "Organization members can delete invites" on public.organization_invites;
create policy "Organization members can delete invites"
on public.organization_invites
for delete
to authenticated
using (
  exists (
    select 1
    from public.employees e
    where e.organization_id = organization_invites.organization_id
      and e.auth_user_id = auth.uid()
  )
);
