export const OWNER_ORG_SLUG = 'owner-workspace';

export async function resolveUserOrganization(supabase, user) {
  if (!user) {
    console.log('[OrgResolver] status=no_user');
    return { status: 'no_user' };
  }

  console.log('[OrgResolver] resolving organization for user:', user.email ?? user.id);

  const { data: member, error: memberError } = await supabase
    .from('employees')
    .select('id, organization_id, email, name, role, organizations(id, name, slug)')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (memberError) {
    console.error('[OrgResolver] member lookup failed:', memberError);
    throw memberError;
  }

  if (member) {
    const organization = member.organizations ?? null;
    console.log('[OrgResolver] member found:', {
      memberId: member.id,
      organizationId: member.organization_id,
    });
    console.log('[OrgResolver] status=member');
    return {
      status: 'member',
      organizationId: member.organization_id,
      organizationName: organization?.name ?? '',
      member,
    };
  }

  const normalizedEmail = user.email?.trim().toLowerCase();

  if (normalizedEmail) {
    const { data: invite, error: inviteError } = await supabase
      .from('organization_invites')
      .select('id, organization_id, email, status, organizations(id, name, slug)')
      .ilike('email', normalizedEmail)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteError) {
      console.error('[OrgResolver] invite lookup failed:', inviteError);
      throw inviteError;
    }

    if (invite) {
      const organization = invite.organizations ?? null;
      console.log('[OrgResolver] invite found:', {
        inviteId: invite.id,
        organizationId: invite.organization_id,
      });
      console.log('[OrgResolver] status=invite_found');
      return {
        status: 'invite_found',
        invite,
        organizationId: invite.organization_id,
        organizationName: organization?.name ?? '',
      };
    }
  }

  console.log('[OrgResolver] needs onboarding');
  console.log('[OrgResolver] status=needs_onboarding');
  return { status: 'needs_onboarding' };
}

export async function getOwnerOrganizationId(supabase) {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', OWNER_ORG_SLUG)
    .single();

  if (error) throw error;
  return data.id;
}

export async function getOwnerOrganization(supabase) {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', OWNER_ORG_SLUG)
    .single();

  if (error) throw error;
  return data;
}
