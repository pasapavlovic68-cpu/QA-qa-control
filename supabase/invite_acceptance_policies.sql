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

drop policy if exists "Users can select own employee member row" on public.employees;
create policy "Users can select own employee member row"
on public.employees
for select
to authenticated
using (
  auth_user_id = auth.uid()
);

drop policy if exists "Organization members can select employees in their organization" on public.employees;
drop function if exists public.is_organization_member(uuid);
create or replace function public.is_organization_member(p_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.employees member
    where member.organization_id = p_organization_id
      and member.auth_user_id = auth.uid()
  );
$$;

grant execute on function public.is_organization_member(uuid) to authenticated;

create policy "Organization members can select employees in their organization"
on public.employees
for select
to authenticated
using (
  public.is_organization_member(organization_id)
);

drop policy if exists "Organization members can select their organization" on public.organizations;
create policy "Organization members can select their organization"
on public.organizations
for select
to authenticated
using (
  public.is_organization_member(id)
);

create or replace function public.accept_invite_for_current_user(
  p_invite_id uuid,
  p_display_name text default null
)
returns table (
  success boolean,
  organization_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite record;
  v_existing_member record;
  v_display_name text;
begin
  if v_auth_user_id is null then
    raise exception 'Пользователь не авторизован.';
  end if;

  if v_email = '' then
    raise exception 'Email пользователя не найден.';
  end if;

  select id, organization_id, email, status
  into v_invite
  from public.organization_invites
  where id = p_invite_id
    and status = 'pending'
    and lower(email) = v_email
  for update;

  if not found then
    raise exception 'Активное приглашение для этого email не найдено.';
  end if;

  select id, organization_id
  into v_existing_member
  from public.employees
  where auth_user_id = v_auth_user_id
  limit 1;

  if found and v_existing_member.organization_id <> v_invite.organization_id then
    raise exception 'Пользователь уже подключён к другой организации.';
  end if;

  if not found then
    v_display_name := coalesce(nullif(trim(p_display_name), ''), split_part(v_email, '@', 1), 'Новый пользователь');

    insert into public.employees (
      organization_id,
      auth_user_id,
      email,
      name,
      role,
      status,
      score,
      checks_count
    )
    values (
      v_invite.organization_id,
      v_auth_user_id,
      v_email,
      v_display_name,
      'member',
      'Активен',
      0,
      0
    );
  end if;

  update public.organization_invites
  set
    status = 'accepted',
    accepted_at = now(),
    accepted_auth_user_id = v_auth_user_id
  where id = v_invite.id;

  return query
  select true, v_invite.organization_id;
end;
$$;

grant execute on function public.accept_invite_for_current_user(uuid, text) to authenticated;
