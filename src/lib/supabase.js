import { createClient } from '@supabase/supabase-js';

// L'app doit rester utilisable sans Supabase configuré : la synchro est un
// bonus, jamais un préalable au fonctionnement local d'abord.
const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && cle ? createClient(url, cle) : null;
