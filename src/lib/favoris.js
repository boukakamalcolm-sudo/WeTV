import { supabase } from './supabase';

// La console est un outil d'administration en ligne : Supabase est la seule
// source de vérité, il n'y a plus de copie locale à synchroniser.

export async function listerFavoris() {
  const { data, error } = await supabase
    .from('favoris')
    .select('id, tmdb_id, media_type, title, poster_path, annee, added_at')
    .order('title');
  if (error) throw error;
  return data;
}

export async function ajouterFavori(titre) {
  const { data, error } = await supabase
    .from('favoris')
    .upsert(
      {
        tmdb_id: titre.tmdbId,
        media_type: titre.mediaType,
        title: titre.title,
        poster_path: titre.posterPath,
        annee: titre.year ? Number(titre.year) : null,
      },
      { onConflict: 'user_id,tmdb_id,media_type' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function retirerFavori(id) {
  const { error } = await supabase.from('favoris').delete().eq('id', id);
  if (error) throw error;
}

// Crée la clé du flux au premier appel, la renvoie ensuite telle quelle.
export async function maCle() {
  const { data, error } = await supabase.rpc('ma_cle_calendrier');
  if (error) throw error;
  return data;
}

// L'ancienne URL cesse de fonctionner : utile si elle a fuité.
export async function regenererCle() {
  const { data, error } = await supabase.rpc('regenerer_cle_calendrier');
  if (error) throw error;
  return data;
}

export const urlFlux = (cle) => `${location.origin}/calendrier.ics?cle=${cle}`;
export const urlWebcal = (cle) => urlFlux(cle).replace(/^https?:/, 'webcal:');

export async function apercuSorties(cle) {
  const res = await fetch(`/api/calendrier?format=json&cle=${cle}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
