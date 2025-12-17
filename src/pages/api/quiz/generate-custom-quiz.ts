// ============================================
// API ROUTE - GENERATE CUSTOM QUIZ
// ============================================
// ⚠️ IMPORTANT: This API generates questions for "custom quiz" mode
// These questions MUST NEVER be stored in the database
// They are stored in quiz_sessions.temp_questions and exist only for the current quiz session

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { generateQuiz, validatePromptPreFilter } from '../../../lib/ai';
import { getRecentUserQuestions } from '../../../lib/quiz';
import { addQuestionsToHistory } from '../../../lib/questionHistory';
import { checkAndConsumeAiCredit } from '../../../lib/ai-credits';
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

  try {
    const { prompt, difficulty, numberOfQuestions, timerSeconds, selectedClarification } = await request.json();

    // Validation des paramètres
    if (!prompt || !difficulty || !numberOfQuestions) {
      return new Response('Paramètres manquants', { status: 400 });
    }

    // Récupérer et valider le timer
    let validatedTimerSeconds = 10; // Par défaut
    if (timerSeconds) {
      const parsedTimer = parseInt(timerSeconds.toString(), 10);
      if (!isNaN(parsedTimer) && parsedTimer > 0) {
        validatedTimerSeconds = parsedTimer;
        // Validation selon le plan
        if (profile.plan === 'premium') {
          if (![5, 10, 15].includes(validatedTimerSeconds)) {
            validatedTimerSeconds = 10; // Fallback
          }
        } else if (profile.plan === 'premium+') {
          if (validatedTimerSeconds < 3 || validatedTimerSeconds > 20) {
            validatedTimerSeconds = 10; // Fallback
          }
        }
      }
    }

    // ⚠️ PRÉ-FILTRE : Validation du prompt AVANT appel IA
    // Si une clarification a été sélectionnée, on skip le pré-filtre (le thème est déjà validé)
    if (!selectedClarification) {
      const preFilterResult = validatePromptPreFilter(prompt);
      if (!preFilterResult.isValid) {
        return new Response(
          JSON.stringify({ 
            error: preFilterResult.error,
            mode: 'prefilter_error'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validation de la longueur du prompt
    if (prompt.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Le prompt doit contenir moins de 500 caractères' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Utiliser la clarification sélectionnée comme prompt si disponible
    const effectivePrompt = selectedClarification || prompt;

    // Récupérer le profil pour obtenir le plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response('Profil introuvable', { status: 404 });
    }

    // Limiter le nombre de questions selon le plan
    const maxQuestions = profile.plan === 'premium' ? 10 : 30;
    const requestedQuestions = Math.min(numberOfQuestions, maxQuestions);

    // ⚠️ VÉRIFICATION ET CONSOMMATION DES CRÉDITS IA
    // Note: On vérifie AVANT la génération, mais on ne consomme qu'après succès
    // Pour le mode "clarify", on ne consomme pas de crédit
    const creditCheck = await checkAndConsumeAiCredit(supabase, user.id, {
      mode: 'custom',
      questionsInBatch: requestedQuestions,
    });

    if (!creditCheck.allowed) {
      if (creditCheck.error === 'plan_not_allowed') {
        return new Response(
          JSON.stringify({ error: 'Plan Premium ou Premium+ requis pour le mode Quiz Custom' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (creditCheck.error === 'out_of_credits') {
        return new Response(
          JSON.stringify({ 
            error: 'Crédits IA épuisés',
            creditsRemaining: creditCheck.creditsRemaining,
            out_of_credits: true
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Récupérer les questions récentes pour injection de contexte (éviter duplicates)
    // Pour Custom Quiz, on récupère depuis 'other' universe car c'est là que sont stockées les questions custom
    const contextQuestions = await getRecentUserQuestions(supabase, user.id, 'other', 20);
    console.log(`📝 Context: ${contextQuestions.length} recent custom questions for injection`);

    // Générer le quiz via IA avec le prompt custom + contexte
    console.log('🎨 Generating CUSTOM quiz:', { prompt: effectivePrompt.substring(0, 50), difficulty, numberOfQuestions: requestedQuestions });
    
    const aiResponse = await generateQuiz({
      universe: 'other', // Fictif, le customPrompt prendra le dessus
      difficulty: difficulty as Difficulty,
      numberOfQuestions: requestedQuestions,
      customPrompt: effectivePrompt, // Le prompt (ou clarification sélectionnée)
      contextQuestions: contextQuestions.length > 0 ? contextQuestions : undefined, // Injection de contexte
    });

    console.log('✅ AI Response mode:', aiResponse.mode, '- Questions:', aiResponse.questions.length);

    // ============================================
    // GESTION DES MODES DE RÉPONSE IA
    // ============================================
    
    // Mode ERREUR : prompt impossible à interpréter
    if (aiResponse.mode === 'error') {
      return new Response(
        JSON.stringify({
          mode: 'error',
          error: aiResponse.error_message || 'Impossible d\'interpréter cette demande.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mode CLARIFICATION : prompt ambigu, proposer des alternatives
    if (aiResponse.mode === 'clarify') {
      // ⚠️ IMPORTANT: On a déjà consommé un crédit, mais pour la clarification
      // on peut considérer que c'est un "coût" acceptable car l'IA a quand même travaillé
      // Si on veut être plus strict, on pourrait rembourser le crédit ici
      return new Response(
        JSON.stringify({
          mode: 'clarify',
          interpreted_theme: aiResponse.interpreted_theme,
          confidence: aiResponse.confidence,
          clarifications: aiResponse.clarifications,
          message: 'Ton thème est un peu vague. Choisis une interprétation ci-dessous :',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mode QUIZ : génération réussie
    if (aiResponse.questions.length === 0) {
      throw new Error('Aucune question générée par l\'IA');
    }

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
        max_score: requestedQuestions * 20, // 20 points max par question (10 base + 10 bonus)
        timer_seconds: validatedTimerSeconds,
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

    // Sauvegarder les questions dans l'historique pour éviter les doublons
    try {
      await addQuestionsToHistory(
        supabase,
        user.id,
        aiResponse.questions,
        effectivePrompt
      );
      console.log('📝 Questions added to history');
    } catch (historyError) {
      // Ne pas bloquer si l'historique échoue
      console.warn('⚠️ Failed to add questions to history:', historyError);
    }

    // Logging pour analytics (ai_usage)
    const { error: logError } = await supabase
      .from('ai_usage')
      .insert({
        user_id: user.id,
        quiz_type: 'ai-custom-quiz',
        questions_count: aiResponse.questions.length,
        universe: 'other',
        prompt: effectivePrompt.substring(0, 200), // Limiter la longueur
        mode: 'custom',
        credits_consumed: 1,
        plan_at_time: profile.plan,
      });

    if (logError) {
      console.error('Error logging AI usage:', logError);
    }

    // Retourner l'ID de session pour redirection
    return new Response(
      JSON.stringify({
        success: true,
        sessionId: newSession.id,
        totalGenerated: aiResponse.questions.length,
        creditsRemaining: creditCheck.creditsRemaining,
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
