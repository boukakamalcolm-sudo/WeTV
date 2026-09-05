import { items } from './store';
import { season, details } from './tmdb';

// Toutes les dates de sortie connues des œuvres suivies, peu importe leur
// statut : une ligne par épisode diffusé (séries) ou par film. Sert de seule
// source au Calendrier, qui les affiche toutes, triées et segmentées par date.
export async function sortiesConnues() {
  const is = await items();
  const resultats = [];
  for (const it of is) {
    try {
      if (it.mediaType === 'movie') {
        const d = await details('movie', it.tmdbId);
        if (d.release_date) {
          resultats.push({ localId: it.localId, tmdbId: it.tmdbId, mediaType: 'movie', title: it.title, posterPath: it.posterPath, status: it.status, date: d.release_date });
        }
        continue;
      }
      const d = await details('tv', it.tmdbId);
      const saisons = (d.seasons || []).filter((s) => s.season_number > 0);
      for (const s of saisons) {
        const sd = await season(it.tmdbId, s.season_number);
        for (const ep of sd.episodes || []) {
          if (ep.air_date) {
            resultats.push({
              localId: it.localId,
              tmdbId: it.tmdbId,
              mediaType: 'tv',
              title: it.title,
              posterPath: it.posterPath,
              status: it.status,
              saison: s.season_number,
              episode: ep.episode_number,
              titreEpisode: ep.name,
              date: ep.air_date,
            });
          }
        }
      }
    } catch { /* un titre sans données TMDB ne bloque pas les autres */ }
  }
  return resultats;
}
