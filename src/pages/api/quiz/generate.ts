// ============================================
// API ROUTE - GENERATE AI QUIZ
// ============================================

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { generateQuiz } from '../../../lib/ai';
import { generateEmbedding, checkDuplicate, saveEmbedding } from '../../../lib/embeddings';
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

  // Parser la requête
  try {
    const { universe, difficulty, numberOfQuestions } = await request.json();

    if (!universe || !difficulty || !numberOfQuestions) {
      return new Response('Paramètres manquants', { status: 400 });
    }

    // Limiter le nombre de questions selon le plan
    const maxQuestions = profile.plan === 'premium' ? 10 : 30;
    const requestedQuestions = Math.min(numberOfQuestions, maxQuestions);

    // Générer le quiz via IA
    console.log('🤖 Calling AI to generate quiz...');
    const aiResponse = await generateQuiz({
      universe: universe as Universe,
      difficulty: difficulty as Difficulty,
      numberOfQuestions: requestedQuestions,
    });

    console.log('✅ AI generated', aiResponse.questions.length, 'questions');
    console.log('First question sample:', aiResponse.questions[0]);

    // Filtrer les duplicates et insérer les questions valides
    const insertedQuestions: string[] = [];
    const duplicates: string[] = [];

    console.log('📝 Starting to process questions...');
    const errors: string[] = []; // Collecter les erreurs pour les retourner
    
    for (const question of aiResponse.questions) {
      try {
        console.log('Processing question:', question.question.substring(0, 50) + '...');

        // Générer l'embedding
        const embedding = await generateEmbedding(question.question);

        // Vérifier les duplicates
        const isDuplicate = await checkDuplicate(supabase, question.question, embedding);

        if (isDuplicate) {
          console.log('⚠️ Duplicate detected, skipping');
          duplicates.push(question.question);
          continue; // Skip cette question
        }

        // Insérer la question dans la DB
        console.log('Inserting question into DB...');
        const { data: insertedQuestion, error: insertError } = await supabase
          .from('questions')
          .insert({
            question: question.question,
            choices: question.choices,
            correct_index: question.correct_index,
            explanation: question.explanation,
            difficulty: difficulty as Difficulty,
            universe: universe as Universe,
            type: 'predefined',
            created_by: 'ia',
            is_approved: true, // Auto-approuvé pour predefined universes
          })
          .select('id')
          .single();

        if (insertError) {
          const errorMsg = `Error inserting question: ${insertError.message || JSON.stringify(insertError)}`;
          console.error('❌', errorMsg);
          errors.push(errorMsg);
          continue;
        }

        console.log('✅ Question inserted:', insertedQuestion.id);

        // Sauvegarder l'embedding
        await saveEmbedding(supabase, insertedQuestion.id, embedding);

        insertedQuestions.push(insertedQuestion.id);
      } catch (error) {
        const errorMsg = `Unexpected error: ${error instanceof Error ? error.message : JSON.stringify(error)}`;
        console.error('❌', errorMsg);
        errors.push(errorMsg);
      }
    }

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

    // Retourner les IDs des questions insérées + les erreurs
    return new Response(
      JSON.stringify({
        success: true,
        questionIds: insertedQuestions,
        duplicatesSkipped: duplicates.length,
        totalGenerated: aiResponse.questions.length,
        quotaUsed: currentQuota + 1,
        quotaMax: maxQuota,
        errors: errors.length > 0 ? errors : undefined, // Inclure les erreurs s'il y en a
        debug: {
          questionsAttempted: aiResponse.questions.length,
          questionsInserted: insertedQuestions.length,
          questionsFailed: errors.length,
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
