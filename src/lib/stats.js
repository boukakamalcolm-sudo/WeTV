import { items, entries } from './store';

// Identifiants de genre TMDB (stables et documentés), fusion films + séries.
// Une correspondance locale plutôt qu'un appel réseau : les statistiques ne
// dépendent de rien d'autre que les données déjà en local.
const GENRES = {
  28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie', 80: 'Crime',
  99: 'Documentaire', 18: 'Drame', 10751: 'Famille', 14: 'Fantastique',
  36: 'Histoire', 27: 'Horreur', 10402: 'Musique', 9648: 'Mystère',
  10749: 'Romance', 878: 'Science-fiction', 10770: 'Téléfilm', 53: 'Thriller',
  10752: 'Guerre', 37: 'Western', 10759: 'Action & Aventure', 10762: 'Jeunesse',
  10763: 'Actualités', 10764: 'Téléréalité', 10765: 'Science-fiction & Fantastique',
  10766: 'Feuilleton', 10767: 'Talk-show', 10768: 'Guerre & Politique',
};

// Tout calculé en local depuis IndexedDB : les statistiques doivent rester
// disponibles sans compte ni réseau, au même titre que le reste de l'app.
export async function statistiques() {
  const [is, es] = await Promise.all([items(), entries()]);

  const minutes = es.reduce((s, e) => s + (e.runtimeMin ?? 42), 0);
  const heures = Math.round((minutes / 60) * 10) / 10;
  const episodesVus = es.filter((e) => e.season != null).length;
  const filmsVus = es.filter((e) => e.season == null).length;

  // Série ou film favori : celui qui cumule le plus de visionnages.
  const parItem = new Map();
  for (const e of es) parItem.set(e.itemId, (parItem.get(e.itemId) ?? 0) + 1);
  let favoriteId = null;
  let max = 0;
  for (const [id, n] of parItem) {
    if (n > max) { max = n; favoriteId = id; }
  }
  const favori = is.find((i) => i.localId === favoriteId) ?? null;

  // Minutes vues par jour, sur les 7 derniers jours.
  const debutJour = (decalage) => {
    const d = new Date();
    d.setDate(d.getDate() - decalage);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const activite = Array.from({ length: 7 }, (_, i) => {
    const decalage = 6 - i;
    const debut = debutJour(decalage);
    const fin = debut + 86400000;
    return es
      .filter((e) => e.watchedAt >= debut && e.watchedAt < fin)
      .reduce((s, e) => s + (e.runtimeMin ?? 42), 0);
  });

  return { heures, episodesVus, filmsVus, favori, activite };
}

// Répartition du temps regardé par genre. Un même visionnage compte pour
// chacun des genres de l'œuvre (une comédie dramatique alimente les deux) :
// le total peut dépasser 100 %, ce qui reflète la réalité d'une œuvre qui
// coche plusieurs cases plutôt que de forcer un genre unique arbitraire.
export async function repartitionGenres(top = 6) {
  const [is, es] = await Promise.all([items(), entries()]);
  const parItem = new Map(is.map((i) => [i.localId, i]));
  const minutesParGenre = new Map();
  for (const e of es) {
    const item = parItem.get(e.itemId);
    if (!item?.genres?.length) continue;
    const minutes = e.runtimeMin ?? 42;
    for (const id of item.genres) {
      minutesParGenre.set(id, (minutesParGenre.get(id) ?? 0) + minutes);
    }
  }
  return [...minutesParGenre.entries()]
    .map(([id, minutes]) => ({ id, label: GENRES[id] ?? 'Autre', minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, top);
}

// Les œuvres les plus regardées, au-delà du seul favori.
export async function topTitres(n = 5) {
  const [is, es] = await Promise.all([items(), entries()]);
  const compte = new Map();
  for (const e of es) compte.set(e.itemId, (compte.get(e.itemId) ?? 0) + 1);
  return [...compte.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([itemId, n]) => ({ item: is.find((i) => i.localId === itemId) ?? null, visionnages: n }))
    .filter((t) => t.item);
}

// Tout l'historique de visionnage, œuvre jointe, du plus récent au plus
// ancien — à segmenter et paginer côté écran (liste potentiellement longue).
export async function historiqueComplet() {
  const [is, es] = await Promise.all([items(), entries()]);
  const parItem = new Map(is.map((i) => [i.localId, i]));
  return es
    .map((e) => ({ ...e, item: parItem.get(e.itemId) ?? null }))
    .sort((a, b) => b.watchedAt - a.watchedAt);
}
