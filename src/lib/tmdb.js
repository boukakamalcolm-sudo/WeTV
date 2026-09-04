// Client TMDB. Les métadonnées sont mises en cache, jamais considérées comme des données propres.
// Clé gratuite pour un usage non commercial : themoviedb.org, Paramètres > API.

const BASE = 'https://api.themoviedb.org/3';
const KEY = import.meta.env.VITE_TMDB_KEY;
const LANG = 'fr-FR';

const IMG = 'https://image.tmdb.org/t/p';
// w185 pour les listes, w500 seulement pour la fiche. Sur mobile, w500 partout se voit.
export const poster = (path, size = 'w185') =>
  path ? `${IMG}/${size}${path}` : null;

const cache = new Map();

async function get(path, params = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set('api_key', KEY);
  url.searchParams.set('language', LANG);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const key = url.toString();
  if (cache.has(key)) return cache.get(key);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} sur ${path}`);
  const data = await res.json();
  cache.set(key, data);
  return data;
}

// Recherche séries et films d'un coup. Les personnes sont écartées.
export async function search(query) {
  const data = await get('/search/multi', { query, include_adult: false });
  return data.results
    .filter((r) => r.media_type === 'tv' || r.media_type === 'movie')
    .map(normalise);
}

export const details = (type, id) =>
  get(`/${type}/${id}`, { append_to_response: 'credits,watch/providers' });

export const season = (id, n) => get(`/tv/${id}/season/${n}`);

// Titres proches. Suffit largement pour recommander tant qu'on a peu de données.
export const similar = (type, id) =>
  get(`/${type}/${id}/similar`).then((d) => d.results.map(normalise));

// Exploration : un genre ou une décennie que je n'ai jamais touchés.
export const decouvrir = (type, { genre, avant, apres, page = 1 }) =>
  get(`/discover/${type}`, {
    page,
    with_genres: genre ?? '',
    'vote_count.gte': 200,
    sort_by: 'popularity.desc',
    ...(type === 'tv'
      ? { 'first_air_date.gte': apres ?? '', 'first_air_date.lte': avant ?? '' }
      : { 'primary_release_date.gte': apres ?? '', 'primary_release_date.lte': avant ?? '' }),
  }).then((d) => d.results.map(normalise));

// Une seule forme d'objet dans toute l'app, quelle que soit la route TMDB.
function normalise(r) {
  const type = r.media_type ?? (r.title ? 'movie' : 'tv');
  return {
    tmdbId: r.id,
    mediaType: type,
    title: r.title ?? r.name,
    posterPath: r.poster_path,
    year: (r.release_date ?? r.first_air_date ?? '').slice(0, 4) || null,
    genres: r.genre_ids ?? [],
    documentaire: (r.genre_ids ?? []).includes(99),
    note: r.vote_average,
  };
}
