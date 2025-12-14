// ============================================
// API ROUTE - RANDOM PROMPTS
// ============================================
// Retourne des prompts aléatoires pour le placeholder dynamique

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';

export const GET: APIRoute = async ({ cookies, url }) => {
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

  const count = parseInt(url.searchParams.get('count') || '5');
  const limitedCount = Math.min(Math.max(count, 1), 10); // Entre 1 et 10

  try {
    // Récupérer des prompts actifs aléatoires
    // Note: Supabase ne supporte pas ORDER BY RANDOM() directement,
    // donc on récupère plus et on shuffle côté serveur
    const { data: prompts, error } = await supabase
      .from('prompt_examples')
      .select('id, prompt')
      .eq('is_active', true)
      .limit(50);

    if (error) {
      console.error('Error fetching prompts:', error);
      return new Response(
        JSON.stringify({ prompts: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Shuffle et limiter
    const shuffled = (prompts || []).sort(() => Math.random() - 0.5);
    const selectedPrompts = shuffled.slice(0, limitedCount).map(p => p.prompt);

    return new Response(
      JSON.stringify({ prompts: selectedPrompts }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in random-prompts API:', error);
    return new Response(
      JSON.stringify({ prompts: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Endpoint pour incrémenter le compteur d'utilisation (bouton aléatoire)
export const POST: APIRoute = async ({ request, cookies }) => {
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

  try {
    // Récupérer un prompt aléatoire et incrémenter son usage
    const { data: prompts, error } = await supabase
      .from('prompt_examples')
      .select('id, prompt')
      .eq('is_active', true);

    if (error || !prompts || prompts.length === 0) {
      return new Response(
        JSON.stringify({ prompt: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Choisir un prompt aléatoire
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    // Incrémenter le compteur d'utilisation
    await supabase
      .from('prompt_examples')
      .update({ usage_count: (randomPrompt as any).usage_count + 1 || 1 })
      .eq('id', randomPrompt.id);

    return new Response(
      JSON.stringify({ prompt: randomPrompt.prompt }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in random-prompts POST API:', error);
    return new Response(
      JSON.stringify({ prompt: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
