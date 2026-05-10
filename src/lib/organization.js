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

export async function acceptOrganizationInvite(supabase, user, invite) {
  console.log('[InviteAcceptance] starting');

  if (!user) {
    const error = new Error('Пользователь не найден.');
    console.error('[InviteAcceptance] failed:', error);
    throw error;
  }

  if (!invite || invite.status !== 'pending') {
    const error = new Error('Приглашение уже не активно.');
    console.error('[InviteAcceptance] failed:', error);
    throw error;
  }

  const userEmail = user.email?.trim().toLowerCase();
  const inviteEmail = invite.email?.trim().toLowerCase();

  if (!userEmail || userEmail !== inviteEmail) {
    const error = new Error('Email пользователя не совпадает с приглашением.');
    console.error('[InviteAcceptance] failed:', error);
    throw error;
  }

  const { data: existingMember, error: existingError } = await supabase
    .from('employees')
    .select('id, organization_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (existingError) {
    console.error('[InviteAcceptance] failed:', existingError);
    throw existingError;
  }

  if (existingMember) {
    if (existingMember.organization_id !== invite.organization_id) {
      const error = new Error('Пользователь уже подключён к другой организации.');
      console.error('[InviteAcceptance] failed:', error);
      throw error;
    }

    console.log('[InviteAcceptance] employee already exists:', existingMember.id);
  } else {
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      userEmail.split('@')[0] ||
      'Новый пользователь';

    const { error: insertError } = await supabase
      .from('employees')
      .insert({
        organization_id: invite.organization_id,
        auth_user_id: user.id,
        email: user.email,
        name: displayName,
        role: 'member',
        status: 'Активен',
        score: 0,
        checks_count: 0,
      });

    if (insertError) {
      console.error('[InviteAcceptance] failed:', insertError);
      throw insertError;
    }

    console.log('[InviteAcceptance] employee created:', user.id);
  }

  const { error: inviteError } = await supabase
    .from('organization_invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_auth_user_id: user.id,
    })
    .eq('id', invite.id)
    .eq('organization_id', invite.organization_id);

  if (inviteError) {
    console.error('[InviteAcceptance] failed:', inviteError);
    throw inviteError;
  }

  console.log('[InviteAcceptance] invite accepted:', invite.id);

  return {
    success: true,
    organizationId: invite.organization_id,
  };
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
