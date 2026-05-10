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
  console.log(`${TAG} no record found by email — skipping unsafe auto-create`);
  return null;
}
