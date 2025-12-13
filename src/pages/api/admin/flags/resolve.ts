// ============================================
// API: Resolve Flag
// ============================================

import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/auth';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const supabase = (locals as any).supabase;

  if (!supabase) {
    return redirect('/admin/flags?error=Session+invalide');
  }

  // Vérifier auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirect('/auth/login');
  }

  // Vérifier admin
  const isUserAdmin = await isAdmin(supabase, user.id);
  if (!isUserAdmin) {
    return redirect('/');
  }

  // Récupérer les données du formulaire
  const formData = await request.formData();
  const flagId = formData.get('id') as string;
  const action = formData.get('action') as string;
  const resolutionNote = formData.get('resolution_note') as string || '';

  if (!flagId) {
    return redirect('/admin/flags?error=ID+manquant');
  }

  const status = action === 'resolve' ? 'resolved' : 'rejected';

  // Mettre à jour le flag
  const { error } = await supabase
    .from('flags')
    .update({
      status,
      resolution_note: resolutionNote || null,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', flagId);

  if (error) {
    return redirect(`/admin/flags?error=${encodeURIComponent(error.message)}`);
  }

  // Log admin action
  await supabase.from('admin_logs').insert({
    admin_id: user.id,
    action: `flag_${status}`,
    target_type: 'flag',
    target_id: flagId,
    metadata: { resolution_note: resolutionNote },
  });

  return redirect(`/admin/flags?success=Signalement+${status === 'resolved' ? 'résolu' : 'rejeté'}`);
};
