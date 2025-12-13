// ============================================
// QIVANA AUTH HELPERS
// ============================================
// Client-side and server-side auth utilities

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { AstroContext, AuthResult } from '../types';

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
 * Uses PKCE flow (recommended by Supabase)
 */
export async function signInWithOAuth(
  supabase: SupabaseClient<Database>,
  provider: 'google' | 'discord' | 'facebook',
  redirectTo?: string
) {
  // Get current origin (handles both localhost and production)
  // This function is only called client-side, so window should be available
  if (typeof window === 'undefined') {
    throw new Error('signInWithOAuth can only be called from the client-side');
  }

  const origin = window.location.origin;
  
  // Build callback URL with next parameter
  // redirectTo can be a relative path (e.g., '/profile') or undefined
  const callbackUrl = redirectTo 
    ? `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
    : `${origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl,
      // Force PKCE flow (recommended for security)
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  // If we have a URL, redirect to it (browser will handle the OAuth flow)
  if (data.url) {
    window.location.href = data.url;
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
export async function requireAuth(Astro: AstroContext): Promise<AuthResult | Response> {
  const supabase = (Astro.locals as { supabase?: SupabaseClient<Database> }).supabase;
  
  if (!supabase) {
    throw new Error('Supabase client not found in Astro.locals. Make sure middleware is configured.');
  }

  const user = await getUser(supabase);

  if (!user) {
    return Astro.redirect('/auth/login');
  }

  // Also fetch profile
  const profile = await getProfile(supabase, user.id);

  if (!profile) {
    throw new Error('Profile not found for authenticated user');
  }

  return {
    user,
    profile,
  };
}

/**
 * Check if user is authenticated AND has Premium+ plan (server-side)
 * Redirects to /auth/login if not authenticated
 * Redirects to /profile with error message if not Premium+
 * To be used in Astro pages: const { user, profile } = await requirePremiumPlus(Astro);
 */
export async function requirePremiumPlus(Astro: AstroContext): Promise<AuthResult | Response> {
  const authResult = await requireAuth(Astro);
  
  // Si c'est une redirection (non authentifié), la retourner
  if (authResult instanceof Response) {
    return authResult;
  }
  
  const { user, profile } = authResult;
  
  // Vérifier que l'utilisateur a Premium+
  if (profile.plan !== 'premium+') {
    // Rediriger vers le profile avec un message d'erreur
    return Astro.redirect('/profile?error=premium-plus-required');
  }
  
  return {
    user,
    profile,
  };
}

/**
 * Check if user is authenticated AND is an admin (server-side)
 * Redirects to /auth/login if not authenticated
 * Redirects to / with 403 if not admin
 * To be used in Astro pages: const { user, profile } = await requireAdmin(Astro);
 */
export async function requireAdmin(Astro: AstroContext): Promise<AuthResult | Response> {
  const authResult = await requireAuth(Astro);
  
  // Si c'est une redirection (non authentifié), la retourner
  if (authResult instanceof Response) {
    return authResult;
  }
  
  const { user, profile } = authResult;
  
  // Vérifier que l'utilisateur est admin
  if (!(profile as any).is_admin) {
    // Rediriger vers l'accueil (les non-admins ne doivent pas savoir que la route existe)
    return Astro.redirect('/');
  }
  
  return {
    user,
    profile,
  };
}

/**
 * Check if user is admin (helper pour middleware)
 */
export async function isAdmin(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return (data as any).is_admin === true;
}
