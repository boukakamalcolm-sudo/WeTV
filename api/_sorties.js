// Sorties connues des favoris, calculées à chaque lecture du flux à partir de
// TMDB : c'est ce qui rend le calendrier « vivant » — une date déplacée sur
// TMDB ou un favori ajouté se retrouve au prochain rafraîchissement.

const TMDB = 'https://api.themoviedb.org/3';
const PAYS = 'FR';
// On garde un peu de passé pour que l'agenda ne soit pas vide en arrière.
const JOURS_PASSES = 30;

const cleTmdb = () => process.env.TMDB_KEY || process.env.VITE_TMDB_KEY;

async function tmdb(chemin, params = {}) {
  const url = new URL(TMDB + chemin);
  url.searchParams.set('api_key', cleTmdb());
  url.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} sur ${chemin}`);
  return res.json();
}

const isoJour = (d) => d.toISOString().slice(0, 10);

function limiteBasse(maintenant) {
  const d = new Date(maintenant);
  d.setUTCDate(d.getUTCDate() - JOURS_PASSES);
  return isoJour(d);
}

const code = (s, e) => `S${s}E${e}`;

function libelleEpisode(ep, serieNouvelle) {
  if (ep.episode_number === 1 && serieNouvelle) return 'nouvelle série';
  if (ep.episode_number === 1) return 'début de saison';
  if (ep.episode_type === 'finale') return 'final de saison';
  if (ep.episode_type === 'mid_season') return 'mi-saison';
  return null;
}

// Un titre d'épisode générique (« Épisode 3 ») n'apprend rien, on l'écarte.
const titreUtile = (nom, n) => nom && !/^(é|e)pisode\s*\d+$/i.test(nom.trim()) && nom.trim() !== String(n);

async function sortiesSerie(fav, depuis) {
  const d = await tmdb(`/tv/${fav.tmdb_id}`);
  const terminee = d.status === 'Ended' || d.status === 'Canceled';
  if (terminee && (d.last_air_date ?? '') < depuis) return { sorties: [], enAttente: false };

  // Saisons utiles : celle du dernier épisode diffusé, celle du prochain, et
  // toute saison annoncée après. Les anciennes saisons n'ont rien à apporter.
  const derniere = d.last_episode_to_air?.season_number ?? 0;
  const numeros = (d.seasons || [])
    .map((s) => s.season_number)
    .filter((n) => n > 0 && n >= derniere);
  const saisons = await Promise.all(numeros.map((n) => tmdb(`/tv/${fav.tmdb_id}/season/${n}`).catch(() => null)));

  const sorties = [];
  for (const saison of saisons) {
    for (const ep of saison?.episodes || []) {
      if (!ep.air_date || ep.air_date < depuis) continue;
      const s = ep.season_number;
      const e = ep.episode_number;
      const marque = libelleEpisode(ep, s === 1);
      sorties.push({
        uid: `tv-${fav.tmdb_id}-s${s}e${e}@wetv`,
        tmdbId: fav.tmdb_id,
        mediaType: 'tv',
        date: ep.air_date,
        titre: `${fav.title} · ${code(s, e)}${marque ? ` (${marque})` : ''}`,
        serie: fav.title,
        episode: titreUtile(ep.name, e) ? ep.name : null,
        description: [titreUtile(ep.name, e) ? ep.name : null, ep.overview || null].filter(Boolean).join('\n\n') || null,
        url: `https://www.themoviedb.org/tv/${fav.tmdb_id}/season/${s}/episode/${e}`,
        posterPath: fav.poster_path,
      });
    }
  }
  // Série renouvelée sans date connue : rien à mettre dans l'agenda, mais la
  // console le signale pour qu'on ne croie pas à un oubli.
  const aVenir = sorties.some((s) => s.date >= isoJour(new Date()));
  return { sorties, enAttente: !terminee && !aVenir };
}

// Types TMDB de release_dates : 2 salles (limitée), 3 salles, 4 numérique.
function datesFrance(releaseDates) {
  const fr = releaseDates?.results?.find((r) => r.iso_3166_1 === PAYS)?.release_dates || [];
  const premiere = (types) =>
    fr.filter((r) => types.includes(r.type)).map((r) => r.release_date.slice(0, 10)).sort()[0] ?? null;
  return { cinema: premiere([3]) ?? premiere([2]), numerique: premiere([4]) };
}

async function sortiesFilm(fav, depuis) {
  const d = await tmdb(`/movie/${fav.tmdb_id}`, { append_to_response: 'release_dates' });
  const { cinema, numerique } = datesFrance(d.release_dates);
  const url = `https://www.themoviedb.org/movie/${fav.tmdb_id}`;
  const base = { tmdbId: fav.tmdb_id, mediaType: 'movie', serie: fav.title, episode: null, description: d.overview || null, url, posterPath: fav.poster_path };
  const sorties = [];
  if (cinema) sorties.push({ ...base, uid: `movie-${fav.tmdb_id}-cinema@wetv`, date: cinema, titre: `${fav.title} (au cinéma)` });
  if (numerique) sorties.push({ ...base, uid: `movie-${fav.tmdb_id}-numerique@wetv`, date: numerique, titre: `${fav.title} (en VOD / streaming)` });
  // Aucune date française connue : la date de sortie internationale vaut
  // mieux que rien, en le disant dans le titre.
  if (!cinema && !numerique && d.release_date) {
    sorties.push({ ...base, uid: `movie-${fav.tmdb_id}-sortie@wetv`, date: d.release_date, titre: `${fav.title} (sortie hors France)` });
  }
  const gardees = sorties.filter((s) => s.date >= depuis);
  const aVenir = gardees.some((s) => s.date >= isoJour(new Date()));
  return { sorties: gardees, enAttente: !numerique && !aVenir && d.status !== 'Released' };
}

// Quelques appels TMDB en parallèle, pas tous d'un coup : TMDB limite le débit.
async function parLots(liste, taille, fn) {
  const resultats = [];
  for (let i = 0; i < liste.length; i += taille) {
    resultats.push(...(await Promise.all(liste.slice(i, i + taille).map(fn))));
  }
  return resultats;
}

export async function sortiesDesFavoris(favoris, maintenant = new Date()) {
  const depuis = limiteBasse(maintenant);
  const sorties = [];
  const enAttente = [];
  const erreurs = [];
  await parLots(favoris, 8, async (fav) => {
    try {
      const r = fav.media_type === 'tv' ? await sortiesSerie(fav, depuis) : await sortiesFilm(fav, depuis);
      sorties.push(...r.sorties);
      if (r.enAttente) enAttente.push({ tmdbId: fav.tmdb_id, mediaType: fav.media_type, title: fav.title });
    } catch {
      // Un titre introuvable ne doit pas faire tomber tout le calendrier.
      erreurs.push({ tmdbId: fav.tmdb_id, mediaType: fav.media_type, title: fav.title });
    }
  });
  sorties.sort((a, b) => a.date.localeCompare(b.date) || a.titre.localeCompare(b.titre));
  return { sorties, enAttente, erreurs };
}
