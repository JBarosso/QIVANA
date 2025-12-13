// ============================================
// QIVANA MIDDLEWARE - Session Persistence + Admin Protection
// ============================================
// Handles Supabase session refresh on every request
// Protects /admin/* routes

import { defineMiddleware } from 'astro:middleware';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
  // Create Supabase client with cookie handling
  const supabase = createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(key) {
          return context.cookies.get(key)?.value;
        },
        set(key, value, options) {
          context.cookies.set(key, value, options);
        },
        remove(key, options) {
          context.cookies.delete(key, options);
        },
      },
    }
  );

  // Refresh session if expired
  await supabase.auth.getSession();

  // Make supabase client available in all pages
  // Type assertion nécessaire car TypeScript ne reconnaît pas automatiquement App.Locals dans le middleware
  (context.locals as { supabase: SupabaseClient<Database> }).supabase = supabase;

  // Protection des routes /admin/*
  const pathname = context.url.pathname;
  if (pathname.startsWith('/admin')) {
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Non authentifié → redirection vers login
      return context.redirect('/auth/login');
    }

    // Vérifier si l'utilisateur est admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile || !(profile as any).is_admin) {
      // Non admin → redirection discrète vers l'accueil
      return context.redirect('/');
    }
  }

  // Proceed to the requested page
  return next();
});
