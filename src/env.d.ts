/// <reference path="../.astro/types.d.ts" />

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/supabase';

declare namespace App {
  interface Locals {
    supabase: SupabaseClient<Database>;
  }
}