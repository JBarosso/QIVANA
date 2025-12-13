// ============================================
// API: UPDATE PROFILE (Pseudo)
// ============================================

import type { APIRoute } from 'astro';
import { createServerClient } from '@supabase/ssr';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
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
    return redirect('/auth/login');
  }

  // Récupérer les données du formulaire
  const formData = await request.formData();
  const pseudo = formData.get('pseudo')?.toString().trim();

  // Valider le pseudo
  if (!pseudo || pseudo.length < 3 || pseudo.length > 20) {
    return redirect('/profile/edit?error=pseudo-invalid');
  }

  // Vérifier si le pseudo est déjà pris
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('pseudo', pseudo)
    .neq('id', user.id)
    .single();

  if (existingProfile) {
    return redirect('/profile/edit?error=pseudo-taken');
  }

  // Générer un nouveau slug à partir du pseudo
  const baseSlug = pseudo
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // Vérifier si le slug existe déjà
  let slug = baseSlug;
  let counter = 0;
  let slugExists = true;

  while (slugExists) {
    const { data: existingSlug } = await supabase
      .from('profiles')
      .select('id')
      .eq('slug', slug)
      .neq('id', user.id)
      .single();

    if (!existingSlug) {
      slugExists = false;
    } else {
      counter++;
      slug = `${baseSlug}_${counter}`;
    }
  }

  // Mettre à jour le profil
  const { error } = await supabase
    .from('profiles')
    .update({
      pseudo,
      slug,
    })
    .eq('id', user.id);

  if (error) {
    console.error('Error updating profile:', error);
    return redirect('/profile/edit?error=update-failed');
  }

  return redirect('/profile/edit?success=profile-updated');
};
