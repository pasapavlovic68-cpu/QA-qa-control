export const OWNER_ORG_SLUG = 'owner-workspace';

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
