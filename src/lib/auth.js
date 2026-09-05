import { supabase } from './supabase';

export function onAuthChange(callback) {
  if (!supabase) {
    callback(null);
    return () => {};
  }
  let actif = true;
  supabase.auth.getSession().then(({ data }) => {
    if (actif) callback(data.session?.user ?? null);
  });
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (actif) callback(session?.user ?? null);
  });
  return () => {
    actif = false;
    subscription.unsubscribe();
  };
}

export async function connecterAvecGoogle() {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } });
  if (error) throw error;
}

export async function seConnecterAvecEmail(email, password) {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function creerCompteAvecEmail(email, password) {
  if (!supabase) return { requiresConfirmation: false };
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
  if (error) throw error;
  return { requiresConfirmation: !data.session };
}

export async function resetMotDePasse(email) {
  if (!supabase) return;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/` });
  if (error) throw error;
}

export async function seDeconnecter() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
