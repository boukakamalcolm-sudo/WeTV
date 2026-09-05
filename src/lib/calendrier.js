import { aSuivre } from './store';
import { season } from './tmdb';

// Épisodes pas encore diffusés, pour les séries suivies. On repart de aSuivre()
// (déjà le prochain épisode non vu de chaque série) et on va chercher sa date
// de diffusion réelle, faute de quoi rien ne distingue "à voir" de "à venir".
export async function calendrier() {
  const suivies = await aSuivre();
  const resultats = [];

  for (const serie of suivies) {
    try {
      const s = await season(serie.tmdbId, serie.prochaine);
      const episode = s.episodes.find((e) => e.episode_number === serie.prochain);
      if (episode?.air_date) {
        resultats.push({
          tmdbId: serie.tmdbId,
          title: serie.title,
          posterPath: serie.posterPath,
          saison: serie.prochaine,
          episode: episode.episode_number,
          titreEpisode: episode.name,
          airDate: episode.air_date,
        });
      }
    } catch { /* une série sans donnée de diffusion ne bloque pas les autres */ }
  }

  const aujourdHui = new Date().toISOString().slice(0, 10);
  return resultats
    .filter((r) => r.airDate >= aujourdHui)
    .sort((a, b) => a.airDate.localeCompare(b.airDate));
}
