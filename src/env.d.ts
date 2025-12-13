/// <reference types="astro/client" />

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/supabase';

declare namespace App {
  interface Locals {
    supabase: SupabaseClient<Database>;
  }
}

interface ImportMetaEnv {
  readonly VITE_SOCKET_IO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
