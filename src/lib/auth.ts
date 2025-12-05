// ============================================
// QIVANA AUTH HELPERS
// ============================================
// Client-side and server-side auth utilities

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Get current authenticated user from Supabase session
 */
export async function getUser(
  supabase: SupabaseClient<Database>
): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('Error fetching user:', error.message);
    return null;
  }

  return user;
}

/**
 * Get current user's profile
 */
export async function getProfile(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error.message);
    return null;
  }

  return data;
}

/**
 * Sign up with email and password
 */
export async function signUp(
  supabase: SupabaseClient<Database>,
  email: string,
  password: string,
  pseudo: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        pseudo, // Will be used in handle_new_user() trigger
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Sign in with email and password
 */
export async function signIn(
  supabase: SupabaseClient<Database>,
  email: string,
  password: string
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithOAuth(
  supabase: SupabaseClient<Database>,
  provider: 'google' | 'discord' | 'facebook',
  redirectTo?: string
) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Sign out
 */
export async function signOut(supabase: SupabaseClient<Database>) {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Check if user is authenticated (server-side)
 * Redirects to /auth/login if not authenticated
 * To be used in Astro pages: const { user, profile } = await requireAuth(Astro);
 */
export async function requireAuth(Astro: any) {
  const supabase = Astro.locals.supabase;
  
  if (!supabase) {
    throw new Error('Supabase client not found in Astro.locals. Make sure middleware is configured.');
  }

  const user = await getUser(supabase);

  if (!user) {
    return Astro.redirect('/auth/login');
  }

  // Also fetch profile
  const profile = await getProfile(supabase, user.id);

  return {
    user,
    profile,
  };
}
