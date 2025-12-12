// ============================================
// API ROUTE - CREATE DUEL SALON
// ============================================
// Crée un nouveau salon de duel (Premium+ uniquement)
// Supporte les modes: db, ai-predefined, ai-custom-quiz

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { createSalon } from '../../../lib/duel';
import { generateQuiz } from '../../../lib/ai';
import { getRecentUserQuestions } from '../../../lib/quiz';
import type { Universe, Difficulty, QuizType } from '../../../types';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
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
    return new Response(JSON.stringify({ error: 'Non authentifié' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ⚠️ SÉCURITÉ : Vérifier que l'utilisateur a Premium+
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: 'Profil introuvable' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (profile.plan !== 'premium+') {
    return new Response(
      JSON.stringify({ error: 'Accès réservé aux utilisateurs Premium+' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Parser le formulaire
    const formData = await request.formData();
    
    const salon_name = formData.get('salon_name')?.toString().trim();
    const game_mode = formData.get('game_mode')?.toString() as 'classic' | 'deathmatch';
    const mode = formData.get('mode')?.toString() as QuizType;
    const universe = formData.get('universe')?.toString() as Universe;
    const difficulty = formData.get('difficulty')?.toString() as Difficulty;
    const questions_count = parseInt(formData.get('questions_count')?.toString() || '10', 10);
    const timer_seconds = formData.get('timer_seconds')?.toString();
    // MVP: Tous les salons sont privés (pas de liste publique pour l'instant)
    const is_public = false;

    // Validation
    if (!salon_name || salon_name.length < 3 || salon_name.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Le nom du salon doit contenir entre 3 et 50 caractères' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!game_mode || (game_mode !== 'classic' && game_mode !== 'deathmatch')) {
      return new Response(
        JSON.stringify({ error: 'Mode de jeu invalide' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Pour l'instant, seul "classic" est implémenté
    if (game_mode !== 'classic') {
      return new Response(
        JSON.stringify({ error: 'Le mode Deathmatch n\'est pas encore disponible' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!mode || !['db', 'ai-custom-quiz'].includes(mode)) {
      return new Response(
        JSON.stringify({ error: 'Source de questions invalide' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Pour le custom quiz, vérifier le prompt
    let customPrompt: string | null = null;
    let tempQuestions: any[] | null = null;
    
    if (mode === 'ai-custom-quiz') {
      customPrompt = formData.get('custom_prompt')?.toString().trim() || null;
      
      if (!customPrompt || customPrompt.length < 10) {
        return new Response(
          JSON.stringify({ error: 'Le prompt custom doit contenir au moins 10 caractères' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Vérifier le quota IA
      const { data: quotaProfile } = await supabase
        .from('profiles')
        .select('ai_quizzes_used_this_month, ai_quota_reset_date')
        .eq('id', user.id)
        .single();

      if (quotaProfile) {
        const now = new Date();
        const resetDate = new Date(quotaProfile.ai_quota_reset_date);
        
        // Si la date de reset est passée, réinitialiser le quota
        if (now > resetDate) {
          await supabase
            .from('profiles')
            .update({
              ai_quizzes_used_this_month: 0,
              ai_quota_reset_date: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
            })
            .eq('id', user.id);
        }
      }

      const currentQuota = quotaProfile?.ai_quizzes_used_this_month || 0;
      const maxQuota = 200; // Premium+ a 200 quiz IA par mois
      
      if (currentQuota >= maxQuota) {
        return new Response(
          JSON.stringify({ 
            error: 'Quota mensuel de quiz IA épuisé',
            message: `Vous avez utilisé ${currentQuota}/${maxQuota} quiz IA ce mois. Le quota sera réinitialisé le mois prochain.`
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Générer le custom quiz
      try {
        const contextQuestions = await getRecentUserQuestions(supabase, user.id, 'other', 20);
        
        const aiResponse = await generateQuiz({
          universe: 'other',
          difficulty: difficulty as Difficulty,
          numberOfQuestions: questions_count,
          customPrompt: customPrompt,
          contextQuestions: contextQuestions.length > 0 ? contextQuestions : undefined,
        });

        tempQuestions = aiResponse.questions;
        
        // Incrémenter le quota
        await supabase
          .from('profiles')
          .update({
            ai_quizzes_used_this_month: currentQuota + 1,
          })
          .eq('id', user.id);

        console.log(`✅ Custom quiz generated: ${tempQuestions.length} questions`);
      } catch (error) {
        console.error('Error generating custom quiz:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Erreur lors de la génération du quiz custom',
            details: error instanceof Error ? error.message : 'Erreur inconnue'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (!universe || !['anime', 'manga', 'comics', 'games', 'movies', 'series', 'other'].includes(universe)) {
      return new Response(
        JSON.stringify({ error: 'Univers invalide' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
      return new Response(
        JSON.stringify({ error: 'Difficulté invalide' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (isNaN(questions_count) || questions_count < 5 || questions_count > 30) {
      return new Response(
        JSON.stringify({ error: 'Le nombre de questions doit être entre 5 et 30' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parser le timer (peut être null si désactivé)
    let parsedTimerSeconds: number | null = null;
    if (timer_seconds) {
      const parsed = parseInt(timer_seconds, 10);
      if (!isNaN(parsed) && parsed >= 3 && parsed <= 20) {
        parsedTimerSeconds = parsed;
      }
    }

    // Créer le salon
    const salonId = await createSalon(supabase, {
      salon_name,
      game_mode,
      mode,
      universe,
      difficulty,
      questions_count,
      timer_seconds: parsedTimerSeconds,
      is_public,
      chef_id: user.id,
      temp_questions: tempQuestions, // Questions temporaires si custom quiz
    });

    // Retourner le succès avec redirection vers le lobby
    return new Response(
      JSON.stringify({
        success: true,
        salonId,
        redirectTo: `/duel/lobby?salon=${salonId}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating salon:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erreur lors de la création du salon',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
