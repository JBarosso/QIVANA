// ============================================
// API ROUTE - GENERATE CUSTOM QUIZ
// ============================================
// ⚠️ IMPORTANT: This API generates questions for "custom quiz" mode
// These questions MUST NEVER be stored in the database
// They are stored in quiz_sessions.temp_questions and exist only for the current quiz session

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { generateQuiz } from '../../../lib/ai';
import { getRecentUserQuestions } from '../../../lib/quiz';
import type { Difficulty } from '../../../lib/quiz';

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

  // ⚠️ SÉCURITÉ FREEMIUM : Récupérer le profil AVANT toute logique
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, ai_quizzes_used_this_month, ai_quota_reset_date')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return new Response('Profil introuvable', { status: 404 });
  }

  // ⚠️ SÉCURITÉ FREEMIUM : Double vérification du plan
  if (profile.plan === 'freemium') {
    return new Response(
      JSON.stringify({ error: 'Plan Premium ou Premium+ requis pour le mode Quiz Custom' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Vérifier le quota mensuel
  const quotaLimits = {
    premium: 5,
    'premium+': 200,
  };

  const currentQuota = profile.ai_quizzes_used_this_month || 0;
  const maxQuota = quotaLimits[profile.plan as keyof typeof quotaLimits] || 0;

  if (currentQuota >= maxQuota) {
    return new Response(
      JSON.stringify({ 
        error: `Quota mensuel atteint (${currentQuota}/${maxQuota}). Renouvellement le mois prochain.` 
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { prompt, difficulty, numberOfQuestions } = await request.json();

    // Validation des paramètres
    if (!prompt || !difficulty || !numberOfQuestions) {
      return new Response('Paramètres manquants', { status: 400 });
    }

    // Validation du prompt
    if (prompt.length < 10 || prompt.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Le prompt doit contenir entre 10 et 500 caractères' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Limiter le nombre de questions selon le plan
    const maxQuestions = profile.plan === 'premium' ? 10 : 30;
    const requestedQuestions = Math.min(numberOfQuestions, maxQuestions);

    // Récupérer les questions récentes pour injection de contexte (éviter duplicates)
    // Pour Custom Quiz, on récupère depuis 'other' universe car c'est là que sont stockées les questions custom
    const contextQuestions = await getRecentUserQuestions(supabase, user.id, 'other', 20);
    console.log(`📝 Context: ${contextQuestions.length} recent custom questions for injection`);

    // Générer le quiz via IA avec le prompt custom + contexte
    console.log('🎨 Generating CUSTOM quiz:', { prompt: prompt.substring(0, 50), difficulty, numberOfQuestions: requestedQuestions });
    
    const aiResponse = await generateQuiz({
      universe: 'other', // Fictif, le customPrompt prendra le dessus
      difficulty: difficulty as Difficulty,
      numberOfQuestions: requestedQuestions,
      customPrompt: prompt, // Le prompt custom de l'utilisateur
      contextQuestions: contextQuestions.length > 0 ? contextQuestions : undefined, // Injection de contexte
    });

    console.log('✅ Generated', aiResponse.questions.length, 'questions for custom quiz');

    // ⚠️ IMPORTANT: NE PAS INSÉRER EN DB
    // ⚠️ Les questions sont stockées dans quiz_sessions.temp_questions UNIQUEMENT
    // ⚠️ Elles n'existent que pour cette session de quiz

    // Créer des UUIDs temporaires pour les questions (la colonne questions_ids attend des UUIDs)
    const tempQuestionIds = aiResponse.questions.map(() => crypto.randomUUID());

    // Créer la session avec les questions stockées dans temp_questions
    const { data: newSession, error: sessionError } = await supabase
      .from('quiz_sessions')
      .insert({
        user_id: user.id,
        quiz_type: 'ai-custom-quiz',
        quiz_mode: 'step-by-step',
        universe: 'other',
        difficulty: difficulty as any,
        questions_ids: tempQuestionIds, // IDs temporaires
        temp_questions: aiResponse.questions, // Questions complètes stockées ici
        answers: [],
        score: 0,
        max_score: requestedQuestions * 10,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError || !newSession) {
      console.error('❌ Error creating custom-quiz session:', sessionError);
      console.error('❌ Full error details:', JSON.stringify(sessionError, null, 2));
      return new Response(
        JSON.stringify({ 
          error: 'Impossible de créer la session de quiz',
          details: sessionError?.message || 'Unknown error',
          code: sessionError?.code || 'UNKNOWN'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Session created:', newSession.id);

    // Incrémenter le compteur de quiz IA utilisés
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ai_quizzes_used_this_month: currentQuota + 1,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating AI quota:', updateError);
    }

    // Retourner l'ID de session pour redirection
    return new Response(
      JSON.stringify({
        success: true,
        sessionId: newSession.id,
        totalGenerated: aiResponse.questions.length,
        quotaUsed: currentQuota + 1,
        quotaMax: maxQuota,
        mode: 'custom-quiz',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating custom quiz:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erreur interne lors de la génération'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
