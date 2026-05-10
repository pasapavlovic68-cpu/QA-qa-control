import { supabase } from './supabase.js';

const TAG = '[bootstrapEmployee]';

export async function bootstrapEmployee(user) {
  console.log(`${TAG} start — user.id=${user.id} email=${user.email}`);

  // Step 1: fast path — find by auth_user_id
  const { data: byAuthId, error: e1 } = await supabase
    .from('employees')
    .select('id, name, role, organization_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (e1) {
    console.error(`${TAG} query by auth_user_id failed:`, e1);
  }
  if (byAuthId) {
    console.log(`${TAG} found by auth_user_id — id=${byAuthId.id} name="${byAuthId.name}" role=${byAuthId.role}`);
    return byAuthId;
  }
  console.log(`${TAG} no record found by auth_user_id`);

  // Step 2: look up by email — only links if email matches exactly
  let byEmail = null;
  if (user.email) {
    const { data, error: e2 } = await supabase
      .from('employees')
      .select('id, name, role, organization_id, auth_user_id, email')
      .eq('email', user.email)
      .maybeSingle();

    if (e2) {
      console.error(`${TAG} query by email failed:`, e2);
    }
    byEmail = data ?? null;
  }

  if (byEmail) {
    console.log(`${TAG} found by email — id=${byEmail.id} name="${byEmail.name}" — linking auth_user_id`);
    const updates = { auth_user_id: user.id };
    if (!byEmail.email) updates.email = user.email;

    const { error: e3 } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', byEmail.id);

    if (e3) {
      console.error(`${TAG} failed to update auth_user_id on existing record:`, e3);
    } else {
      console.log(`${TAG} auth_user_id linked to employee id=${byEmail.id}`);
    }
    return byEmail;
  }
  console.log(`${TAG} no record found by email — will create new employee`);

  // Step 3: get first organization
  const { data: org, error: e4 } = await supabase
    .from('organizations')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (e4 || !org) {
    console.error(`${TAG} failed to load organization:`, e4);
    return null;
  }
  console.log(`${TAG} organization id=${org.id}`);

  // Step 4: determine role
  // Owner = no authenticated employee with role='owner' exists yet.
  // Manually created records without auth_user_id are ignored for this check.
  const { count, error: e5 } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)
    .eq('role', 'owner')
    .not('auth_user_id', 'is', null);

  if (e5) {
    console.error(`${TAG} role check query failed:`, e5);
  }

  const isFirstAuthUser = count === 0 || count === null;
  const role = isFirstAuthUser ? 'owner' : 'employee';
  console.log(`${TAG} role=${role} (existing authenticated owners: ${count})`);

  // Step 5: derive display name
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Новый пользователь';

  console.log(`${TAG} inserting employee name="${fullName}" role=${role} org=${org.id}`);

  const { data: created, error: e6 } = await supabase
    .from('employees')
    .insert({
      auth_user_id: user.id,
      email: user.email,
      name: fullName,
      role,
      organization_id: org.id,
      status: 'На контроле',
      score: 0,
      checks_count: 0,
    })
    .select('id, name, role, organization_id')
    .single();

  if (e6) {
    console.error(`${TAG} failed to create employee:`, e6);
    return null;
  }

  console.log(`${TAG} created — id=${created.id} name="${created.name}" role=${created.role}`);
  return created;
}
