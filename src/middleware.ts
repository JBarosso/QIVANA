// ============================================
// QIVANA MIDDLEWARE - Session Persistence
// ============================================
// Handles Supabase session refresh on every request

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

  // Proceed to the requested page
  return next();
});
