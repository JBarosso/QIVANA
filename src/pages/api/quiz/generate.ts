// ============================================
// API ROUTE - GENERATE AI QUIZ (Legacy - à déprécier)
// ============================================
// ⚠️ NOTE: Cette route est maintenue pour compatibilité mais devrait être remplacée
// par la logique unifiée dans start.ts. Utilise maintenant la génération contrôlée.

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { generateControlledAIQuestions } from '../../../lib/ai-generation';
import type { Universe, Difficulty } from '../../../lib/quiz';

export const POST: APIRoute = async ({ request, cookies }) => {
  // Créer le client Supabase
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(key) {
          return cookies.get(key)?.value;
        },
        set(key, value, options) {
          cookies.set(key, value, options);
        },
        remove(key, options) {
          cookies.delete(key, options);
        },
      },
    }
  );

  // Vérifier l'auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return new Response('Non autorisé', { status: 401 });
  }

  // Récupérer le profil pour vérifier le plan et le quota
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, ai_quizzes_used_this_month, ai_quota_reset_date')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return new Response('Profil introuvable', { status: 404 });
  }

  // Vérifier que l'utilisateur est Premium ou Premium+
  if (profile.plan === 'freemium') {
    return new Response(
      JSON.stringify({ error: 'Plan Premium ou Premium+ requis pour générer des quiz IA' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ⚠️ SÉCURITÉ : Vérification du plan (double check)
  if (profile.plan === 'freemium') {
    return new Response(
      JSON.stringify({ error: 'Plan Premium ou Premium+ requis pour générer des quiz IA' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parser la requête
  try {
    const { universe, difficulty, numberOfQuestions } = await request.json();

    if (!universe || !difficulty || !numberOfQuestions) {
      return new Response('Paramètres manquants', { status: 400 });
    }

    // Limiter le nombre de questions selon le plan
    const maxQuestions = profile.plan === 'premium' ? 10 : 30;
    const requestedQuestions = Math.min(numberOfQuestions, maxQuestions);

    // ============================================
    // GÉNÉRATION CONTRÔLÉE (1 batch, pas de boucle)
    // ============================================
    console.log(`🤖 Controlled AI generation: ${requestedQuestions} questions`);

    const generationResult = await generateControlledAIQuestions(
      supabase,
      user.id,
      universe as Universe,
      difficulty as Difficulty,
      requestedQuestions, // Nombre exact à générer
      1 // Buffer de 1 question
    );

    // Logging pour analytics
    console.log(`📊 AI Generation logged: user=${user.id}, universe=${universe}, count=${generationResult.questionIds.length}`);

    // Retourner les IDs des questions insérées
    return new Response(
      JSON.stringify({
        success: true,
        questionIds: generationResult.questionIds,
        duplicatesSkipped: generationResult.duplicatesSkipped,
        totalGenerated: generationResult.generatedCount,
        errors: generationResult.errors.length > 0 ? generationResult.errors : undefined,
        debug: {
          questionsAttempted: generationResult.generatedCount,
          questionsInserted: generationResult.questionIds.length,
          questionsFailed: generationResult.errors.length,
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating AI quiz:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur interne lors de la génération'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
