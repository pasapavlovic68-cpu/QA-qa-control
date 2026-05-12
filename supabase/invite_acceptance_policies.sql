drop policy if exists "Invited users can select their pending invites" on public.organization_invites;
create policy "Invited users can select their pending invites"
on public.organization_invites
for select
to authenticated
using (
  status = 'pending'
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Invited users can select invited organization" on public.organizations;
create policy "Invited users can select invited organization"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_invites invite
    where invite.organization_id = organizations.id
      and invite.status = 'pending'
      and lower(invite.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "Invited users can create their member row" on public.employees;
create policy "Invited users can create their member row"
on public.employees
for insert
to authenticated
with check (
  auth_user_id = auth.uid()
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and role = 'member'
  and exists (
    select 1
    from public.organization_invites invite
    where invite.organization_id = employees.organization_id
      and invite.status = 'pending'
      and lower(invite.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "Invited users can accept their invite" on public.organization_invites;
create policy "Invited users can accept their invite"
on public.organization_invites
for update
to authenticated
using (
  status = 'pending'
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  status = 'accepted'
  and accepted_auth_user_id = auth.uid()
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "Organization members can update invites" on public.organization_invites;
create policy "Organization members can update invites"
on public.organization_invites
for update
to authenticated
using (
  exists (
    select 1
    from public.employees member
    where member.organization_id = organization_invites.organization_id
      and member.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.employees member
    where member.organization_id = organization_invites.organization_id
      and member.auth_user_id = auth.uid()
  )
);
