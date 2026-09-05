import { aSuivre, items, entries } from './store';
import { season, details } from './tmdb';

const aujourdHui = () => new Date().toISOString().slice(0, 10);

// Prochain épisode non encore diffusé, pour les séries déjà en cours de visionnage.
async function episodesAVenir() {
  const suivies = await aSuivre();
  const resultats = [];
  for (const serie of suivies) {
    try {
      const s = await season(serie.tmdbId, serie.prochaine);
      const episode = s.episodes.find((e) => e.episode_number === serie.prochain);
      if (episode?.air_date) {
        resultats.push({
          tmdbId: serie.tmdbId,
          mediaType: 'tv',
          title: serie.title,
          posterPath: serie.posterPath,
          saison: serie.prochaine,
          episode: episode.episode_number,
          titreEpisode: episode.name,
          date: episode.air_date,
        });
      }
    } catch { /* une série sans donnée de diffusion ne bloque pas les autres */ }
  }
  return resultats;
}

// Date de sortie des films et séries ajoutés à la liste ("à voir"), qu'elle
// soit passée — déjà disponible, en attente d'être commencé — ou à venir.
async function sortiesListe() {
  const is = await items();
  const enListe = is.filter((i) => i.status === 'watchlist');
  const resultats = [];
  for (const it of enListe) {
    try {
      const d = await details(it.mediaType, it.tmdbId);
      const date = it.mediaType === 'movie' ? d.release_date : d.first_air_date;
      if (date) resultats.push({ tmdbId: it.tmdbId, mediaType: it.mediaType, title: it.title, posterPath: it.posterPath, date });
    } catch { /* un titre sans date connue ne bloque pas les autres */ }
  }
  return resultats;
}

// Vue "à venir" : prochains épisodes des séries suivies, plus les films et
// séries de la liste "à voir" — à venir ou déjà sortis et oubliés.
export async function calendrier() {
  const jour = aujourdHui();
  const [episodes, sorties] = await Promise.all([episodesAVenir(), sortiesListe()]);
  const aVenir = [...episodes.filter((e) => e.date >= jour), ...sorties.filter((s) => s.date >= jour)]
    .sort((a, b) => a.date.localeCompare(b.date));
  const dejaSorti = sorties
    .filter((s) => s.date < jour)
    .sort((a, b) => b.date.localeCompare(a.date));
  return { aVenir, dejaSorti };
}

// Vue "historique" : ce qui a réellement été regardé un mois donné, à partir
// des horodatages déjà enregistrés localement — aucun appel réseau.
export async function historiqueMois(annee, mois) {
  const [es, is] = await Promise.all([entries(), items()]);
  const parItem = new Map(is.map((i) => [i.localId, i]));
  const parJour = new Map();
  for (const e of es) {
    const d = new Date(e.watchedAt);
    if (d.getFullYear() !== annee || d.getMonth() !== mois) continue;
    const cle = d.getDate();
    if (!parJour.has(cle)) parJour.set(cle, []);
    parJour.get(cle).push({ ...e, item: parItem.get(e.itemId) });
  }
  for (const liste of parJour.values()) liste.sort((a, b) => new Date(a.watchedAt) - new Date(b.watchedAt));
  return parJour;
}

// Toutes les dates de sortie connues des œuvres suivies, peu importe le
// statut : chargé une fois pour toute la session, puis filtré localement
// mois par mois (sortiesDuMois) — pas de nouvel appel réseau à chaque page.
export async function sortiesConnues() {
  const is = await items();
  const resultats = [];
  for (const it of is) {
    try {
      if (it.mediaType === 'movie') {
        const d = await details('movie', it.tmdbId);
        if (d.release_date) resultats.push({ tmdbId: it.tmdbId, mediaType: 'movie', title: it.title, date: d.release_date });
        continue;
      }
      const d = await details('tv', it.tmdbId);
      const saisons = (d.seasons || []).filter((s) => s.season_number > 0);
      for (const s of saisons) {
        const sd = await season(it.tmdbId, s.season_number);
        for (const ep of sd.episodes || []) {
          if (ep.air_date) resultats.push({ tmdbId: it.tmdbId, mediaType: 'tv', title: it.title, saison: s.season_number, episode: ep.episode_number, titreEpisode: ep.name, date: ep.air_date });
        }
      }
    } catch { /* un titre sans données TMDB ne bloque pas les autres */ }
  }
  return resultats;
}

// Filtre local (aucun appel réseau) des sorties connues sur un mois donné,
// groupées par jour. Comparaison sur la chaîne AAAA-MM-JJ pour éviter tout
// décalage de fuseau horaire lié à un parsing en Date.
export function sortiesDuMois(sorties, annee, mois) {
  const prefixe = `${annee}-${String(mois + 1).padStart(2, '0')}-`;
  const parJour = new Map();
  for (const s of sorties) {
    if (!s.date.startsWith(prefixe)) continue;
    const jour = Number(s.date.slice(8, 10));
    if (!parJour.has(jour)) parJour.set(jour, []);
    parJour.get(jour).push(s);
  }
  return parJour;
}
