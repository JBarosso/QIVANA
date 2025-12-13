// ============================================
// API ROUTE - CREATE DUEL SALON
// ============================================
// Crée un nouveau salon de duel (Premium+ uniquement)
// Supporte les modes: db, ai-predefined, ai-custom-quiz

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';
import { createSalon } from '../../../lib/duel';
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
    // Pour le mode custom quiz, l'univers n'est pas requis (on utilise 'other' par défaut)
    let universe = (formData.get('universe')?.toString() || (mode === 'ai-custom-quiz' ? 'other' : null)) as Universe | null;
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

    // ⚠️ IMPORTANT : AUCUNE génération de questions à la création du salon
    // Toutes les générations (DB + Custom Quiz) se feront au démarrage du duel dans /api/duel/start
    let customPrompt: string | null = null;
    
    if (mode === 'ai-custom-quiz') {
      // Pour le custom quiz, on stocke seulement le prompt, pas les questions
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
      
      // ⚠️ IMPORTANT : On ne vérifie PAS le quota ici, ni on génère les questions
      // Tout sera fait au démarrage du duel dans /api/duel/start
      console.log(`📝 Custom prompt saved (will be generated at game start): ${customPrompt.substring(0, 50)}...`);
    }

    // Pour le mode custom quiz, l'univers est automatiquement 'other'
    // Pour le mode DB, l'univers est requis
    if (mode !== 'ai-custom-quiz') {
      if (!universe || !['anime', 'manga', 'comics', 'games', 'movies', 'series', 'other'].includes(universe)) {
        return new Response(
          JSON.stringify({ error: 'Univers invalide' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    } else {
      // Mode custom quiz : forcer 'other'
      universe = 'other';
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
    // ⚠️ IMPORTANT : universe est garanti d'être défini (soit depuis le form, soit 'other' pour custom quiz)
    // ⚠️ IMPORTANT : On ne stocke PAS les questions ici, seulement le prompt custom si présent
    const salonId = await createSalon(supabase, {
      salon_name,
      game_mode,
      mode,
      universe: universe!, // Non-null car vérifié ci-dessus
      difficulty,
      questions_count,
      timer_seconds: parsedTimerSeconds,
      is_public,
      chef_id: user.id,
      custom_prompt: customPrompt, // Stocker seulement le prompt, pas les questions
      temp_questions: null, // ⚠️ IMPORTANT : Plus de génération à la création
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
