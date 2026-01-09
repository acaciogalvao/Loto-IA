
import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase com as chaves fornecidas pelo usuário
// URL e Key válidas para evitar "TypeError: Failed to construct 'URL'"
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ckvpeaycpugcmhiuript.supabase.co'; 
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ErXWdDkTHcU85HJUVz1DMg_h1vQJleT';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
