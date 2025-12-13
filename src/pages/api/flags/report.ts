// ============================================
// API: Report Question (User-facing)
// ============================================
// Permet aux utilisateurs connectés de signaler une question

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = (locals as any).supabase;

  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Session invalide' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Vérifier auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Non authentifié' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { questionId, reason, additionalInfo } = body;

    // Validation
    if (!questionId) {
      return new Response(JSON.stringify({ error: 'ID de question manquant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!reason || reason.length < 10) {
      return new Response(JSON.stringify({ error: 'La raison doit contenir au moins 10 caractères' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Vérifier que la question existe
    const { data: question } = await supabase
      .from('questions')
      .select('id')
      .eq('id', questionId)
      .single();

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question introuvable' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Vérifier qu'un signalement n'existe pas déjà pour cette question par cet utilisateur
    const { data: existingFlag } = await supabase
      .from('flags')
      .select('id')
      .eq('question_id', questionId)
      .eq('reported_by', user.id)
      .eq('status', 'pending')
      .single();

    if (existingFlag) {
      return new Response(JSON.stringify({ error: 'Vous avez déjà signalé cette question' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Créer le signalement
    const { error } = await supabase.from('flags').insert({
      question_id: questionId,
      reported_by: user.id,
      reason,
      additional_info: additionalInfo || null,
      status: 'pending',
    });

    if (error) {
      console.error('Error creating flag:', error);
      return new Response(JSON.stringify({ error: 'Erreur lors du signalement' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Signalement envoyé' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in report API:', err);
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
