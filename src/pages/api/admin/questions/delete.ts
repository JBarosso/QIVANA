// ============================================
// API: Delete Question
// ============================================

import type { APIRoute } from 'astro';
import { isAdmin } from '@/lib/auth';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const supabase = (locals as any).supabase;

  if (!supabase) {
    return redirect('/admin/questions?error=Session+invalide');
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
  const questionId = formData.get('id') as string;

  if (!questionId) {
    return redirect('/admin/questions?error=ID+manquant');
  }

  // Supprimer d'abord les embeddings liés
  await supabase
    .from('embeddings')
    .delete()
    .eq('question_id', questionId);

  // Supprimer les flags liés
  await supabase
    .from('flags')
    .delete()
    .eq('question_id', questionId);

  // Supprimer la question
  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('id', questionId);

  if (error) {
    return redirect(`/admin/questions?error=${encodeURIComponent(error.message)}`);
  }

  // Log admin action
  await supabase.from('admin_logs').insert({
    admin_id: user.id,
    action: 'delete_question',
    target_type: 'question',
    target_id: questionId,
  });

  return redirect('/admin/questions?success=Question+supprimée');
};
