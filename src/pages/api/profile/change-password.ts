// ============================================
// API: CHANGE PASSWORD
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
  const newPassword = formData.get('new_password')?.toString();
  const confirmPassword = formData.get('confirm_password')?.toString();

  // Valider les mots de passe
  if (!newPassword || newPassword.length < 6) {
    return redirect('/profile/edit?error=password-short');
  }

  if (newPassword !== confirmPassword) {
    return redirect('/profile/edit?error=password-mismatch');
  }

  // Mettre à jour le mot de passe
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error('Error updating password:', error);
    return redirect('/profile/edit?error=update-failed');
  }

  return redirect('/profile/edit?success=password-updated');
};
