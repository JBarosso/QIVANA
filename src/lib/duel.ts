import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import type { Universe, Difficulty, QuizType } from '../types';

/**
 * Génère un code de salon unique de 6 caractères alphanumériques
 * Format: majuscules et chiffres (ex: "A3B9K2")
 */
export function generateSalonCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Vérifie si un code de salon existe déjà en DB
 */
export async function salonCodeExists(
  supabase: SupabaseClient<Database>,
  code: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('duel_sessions')
    .select('id')
    .eq('salon_code', code)
    .single();

  if (error && error.code === 'PGRST116') {
    // Code n'existe pas (erreur "no rows returned")
    return false;
  }

  if (error) {
    console.error('Error checking salon code:', error);
    throw new Error('Erreur lors de la vérification du code');
  }

  return !!data;
}

/**
 * Génère un code de salon unique (vérifie qu'il n'existe pas déjà)
 */
export async function generateUniqueSalonCode(
  supabase: SupabaseClient<Database>
): Promise<string> {
  let code = generateSalonCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (await salonCodeExists(supabase, code)) {
    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error('Impossible de générer un code unique après plusieurs tentatives');
    }
    code = generateSalonCode();
  }

  return code;
}

/**
 * Interface pour créer un salon
 */
export interface CreateSalonData {
  salon_name: string;
  game_mode: 'classic' | 'deathmatch';
  mode: QuizType;
  universe: Universe;
  difficulty: Difficulty;
  questions_count: number;
  timer_seconds: number | null;
  is_public: boolean;
  chef_id: string;
  temp_questions?: any[] | null; // Questions temporaires pour custom quiz
}

/**
 * Crée un nouveau salon (duel session)
 */
export async function createSalon(
  supabase: SupabaseClient<Database>,
  data: CreateSalonData
): Promise<string> {
  // Générer un code unique
  const salon_code = await generateUniqueSalonCode(supabase);

  // Insérer le salon
  const insertData: any = {
    salon_code,
    salon_name: data.salon_name,
    game_mode: data.game_mode,
    mode: data.mode,
    universe: data.universe,
    difficulty: data.difficulty,
    questions_count: data.questions_count,
    timer_seconds: data.timer_seconds,
    is_public: data.is_public,
    chef_id: data.chef_id,
    status: 'lobby',
    participants: [],
  };

  // Ajouter temp_questions si fourni (pour custom quiz)
  if (data.temp_questions) {
    insertData.temp_questions = data.temp_questions;
  }

  const { data: salon, error } = await supabase
    .from('duel_sessions')
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    console.error('Error creating salon:', error);
    throw new Error(`Erreur lors de la création du salon: ${error.message}`);
  }

  if (!salon) {
    throw new Error('Erreur: salon créé mais ID non retourné');
  }

  return salon.id;
}

/**
 * Récupère un salon par son code
 */
export async function getSalonByCode(
  supabase: SupabaseClient<Database>,
  code: string
) {
  const { data, error } = await supabase
    .from('duel_sessions')
    .select('*')
    .eq('salon_code', code)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Salon non trouvé
    }
    console.error('Error fetching salon:', error);
    throw new Error(`Erreur lors de la récupération du salon: ${error.message}`);
  }

  return data;
}
