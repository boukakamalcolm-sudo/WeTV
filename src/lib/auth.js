// Connexion facultative : elle sert uniquement à retrouver ses propres
// données sur plusieurs appareils, jamais à un usage partagé ou social.
import { supabase } from './supabase';

// callback(undefined) : état encore inconnu (le temps de vérifier une session existante).
// callback(null) : confirmé déconnecté. callback(user) : confirmé connecté.
export function onAuthChange(callback) {
  if (!supabase) {
    callback(null);
    return () => {};
  }

  let actif = true;
  supabase.auth.getSession().then(({ data }) => {
    if (actif) callback(data.session?.user ?? null);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_evenement, session) => {
    if (actif) callback(session?.user ?? null);
  });

  return () => {
    actif = false;
    subscription.unsubscribe();
  };
}

export async function connecterAvecGoogle() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin },
  });
}

export async function seDeconnecter() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
