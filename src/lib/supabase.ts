import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://wgyftgqfooxjanhexrvb.supabase.co";
const supabaseAnonKey = "sb_publishable_F2h1q8lmcZE7LiY12SlC5w_-dQMI1-8";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing! Ensure .env is configured.");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
