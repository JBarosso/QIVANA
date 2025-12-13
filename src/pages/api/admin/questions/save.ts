// ============================================
// API: Save/Update Question
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
  const questionId = formData.get('id') as string | null;
  const questionText = formData.get('question') as string;
  const choice0 = formData.get('choice_0') as string;
  const choice1 = formData.get('choice_1') as string;
  const choice2 = formData.get('choice_2') as string;
  const choice3 = formData.get('choice_3') as string;
  const correctIndex = parseInt(formData.get('correct_index') as string);
  const explanation = formData.get('explanation') as string;
  const universe = formData.get('universe') as string;
  const difficulty = formData.get('difficulty') as string;
  const isApproved = formData.get('is_approved') === 'on';

  // Validation
  if (!questionText || questionText.length < 10) {
    return redirect(`/admin/questions/${questionId || 'new'}?error=Question+trop+courte+(min+10+caractères)`);
  }
  if (!choice0 || !choice1) {
    return redirect(`/admin/questions/${questionId || 'new'}?error=Au+moins+2+choix+requis`);
  }
  if (!explanation || explanation.length < 10) {
    return redirect(`/admin/questions/${questionId || 'new'}?error=Explication+trop+courte+(min+10+caractères)`);
  }

  const choices = [choice0, choice1, choice2, choice3].filter(c => c && c.trim());

  const questionData = {
    question: questionText,
    choices: choices,
    correct_index: correctIndex,
    explanation,
    universe,
    difficulty,
    is_approved: isApproved,
    created_by: 'admin' as const,
    reviewed_by: isApproved ? user.id : null,
    reviewed_at: isApproved ? new Date().toISOString() : null,
  };

  let error;
  let savedQuestionId = questionId;

  if (questionId && questionId !== 'new') {
    // Update
    const result = await supabase
      .from('questions')
      .update(questionData)
      .eq('id', questionId);
    error = result.error;

    // Log
    await supabase.from('admin_logs').insert({
      admin_id: user.id,
      action: 'update_question',
      target_type: 'question',
      target_id: questionId,
      metadata: { changes: questionData },
    });
  } else {
    // Insert
    const result = await supabase
      .from('questions')
      .insert(questionData)
      .select('id')
      .single();
    error = result.error;
    savedQuestionId = result.data?.id;

    // Log
    if (savedQuestionId) {
      await supabase.from('admin_logs').insert({
        admin_id: user.id,
        action: 'create_question',
        target_type: 'question',
        target_id: savedQuestionId,
      });
    }
  }

  if (error) {
    return redirect(`/admin/questions/${questionId || 'new'}?error=${encodeURIComponent(error.message)}`);
  }

  return redirect(`/admin/questions?success=Question+${questionId ? 'modifiée' : 'créée'}`);
};
