// ============================================
// API: SELECT AVATAR
// ============================================

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';

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

  // Vérifier l'authentification
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Récupérer l'avatar ID
  const { avatarId } = await request.json();

  if (!avatarId) {
    return new Response(JSON.stringify({ error: 'Missing avatarId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Vérifier que l'avatar est débloqué pour cet utilisateur
  const { data: userAvatar } = await supabase
    .from('user_avatars')
    .select('id')
    .eq('user_id', user.id)
    .eq('avatar_id', avatarId)
    .single();

  if (!userAvatar) {
    return new Response(JSON.stringify({ error: 'Avatar not unlocked' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Mettre à jour le profil
  const { error } = await supabase
    .from('profiles')
    .update({ selected_avatar_id: avatarId })
    .eq('id', user.id);

  if (error) {
    console.error('Error updating selected avatar:', error);
    return new Response(JSON.stringify({ error: 'Failed to update avatar' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
