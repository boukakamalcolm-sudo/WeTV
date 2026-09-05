import { similar, decouvrir } from './tmdb';
import { items, preferences } from './store';

// Recommandation du premier lot : rapprochement simple, sans modèle.
// Deux tiers de proximité pour la pertinence, un tiers d'exploration
// pour éviter que le système se referme sur lui-même.

const GENRES_EXPLORATION = [99, 18, 80, 878, 35, 9648, 36, 10402];

// Identifiants de genre TMDB : distincts entre séries et films pour certaines
// catégories (l'action des séries est "10759", celle des films "28").
const GENRES_SERIES = [
  { id: 10759, label: 'Action & Aventure' },
  { id: 35, label: 'Comédie' },
  { id: 18, label: 'Drame' },
  { id: 16, label: 'Animation' },
  { id: 10765, label: 'Science-fiction & Fantastique' },
];
const GENRES_FILMS = [
  { id: 28, label: 'Action' },
  { id: 35, label: 'Comédie' },
  { id: 18, label: 'Drame' },
  { id: 16, label: 'Animation' },
  { id: 878, label: 'Science-fiction' },
];

async function dejaVus() {
  const [is, ps] = await Promise.all([items(), preferences()]);
  return new Set([
    ...is.map((i) => `${i.mediaType}:${i.tmdbId}`),
    ...ps.map((p) => `${p.mediaType}:${p.tmdbId}`),
  ]);
}

// Grille d'amorçage : des titres très connus, qu'on reconnaît d'un coup d'oeil.
// Plus rapide que le tri carte à carte pour démarrer, parce qu'on balaye l'ensemble.
// Deux grandes catégories (Séries, Films), chacune détaillée en sous-rangées par
// genre : on reconnaît plus vite un titre dans une catégorie qui a du sens pour lui.
export async function grilleAmorcage(tailleParGenre = 10) {
  const [genresSeries, genresFilms] = await Promise.all([
    genresVersRangees('tv', GENRES_SERIES, tailleParGenre),
    genresVersRangees('movie', GENRES_FILMS, tailleParGenre),
  ]);
  return [
    { cle: 'tv', emoji: '📺', label: 'Séries', genres: genresSeries },
    { cle: 'movie', emoji: '🎬', label: 'Films', genres: genresFilms },
  ];
}

// Un titre coche souvent plusieurs genres à la fois (une comédie d'action, par
// exemple) : on le range dans la première rangée où il apparaît, jamais dans
// les suivantes, pour ne pas le montrer deux fois sur le même écran.
async function genresVersRangees(type, genresDef, taille) {
  const dejaPlace = new Set();
  const rangees = [];
  for (const { id, label } of genresDef) {
    let titres = [];
    try {
      const brut = await decouvrir(type, { genre: id });
      titres = melanger(brut.filter((t) => !dejaPlace.has(t.tmdbId))).slice(0, taille);
      titres.forEach((t) => dejaPlace.add(t.tmdbId));
    } catch { /* un genre indisponible ne bloque pas les autres rangées */ }
    rangees.push({ id, label, titres });
  }
  return rangees;
}

export async function propositions(taille = 20) {
  const [is, ps] = await Promise.all([items(), preferences()]);
  const exclus = await dejaVus();

  const aimes = [
    ...is.filter((i) => i.status !== 'dropped'),
    ...ps.filter((p) => p.verdict === 'like'),
  ];

  const nProches = Math.round(taille * 0.67);
  const proches = [];

  // Proximité : les titres voisins de ce que j'ai déjà retenu.
  for (const base of melanger(aimes).slice(0, 6)) {
    try {
      const voisins = await similar(base.mediaType, base.tmdbId);
      for (const t of voisins) {
        if (exclus.has(`${t.mediaType}:${t.tmdbId}`)) continue;
        proches.push({ ...t, raison: `proche de ${base.title}` });
      }
    } catch { /* un titre sans voisins ne bloque pas le lot */ }
  }

  // Exploration : un genre absent de la bibliothèque, choisi au hasard.
  const connus = new Set(is.flatMap((i) => i.genres ?? []));
  const inconnus = GENRES_EXPLORATION.filter((g) => !connus.has(g));
  const genre = inconnus.length
    ? inconnus[Math.floor(Math.random() * inconnus.length)]
    : GENRES_EXPLORATION[Math.floor(Math.random() * GENRES_EXPLORATION.length)];

  let ailleurs = [];
  try {
    const brut = await decouvrir('tv', { genre });
    ailleurs = brut
      .filter((t) => !exclus.has(`${t.mediaType}:${t.tmdbId}`))
      .map((t) => ({ ...t, raison: 'un genre que tu ne regardes jamais' }));
  } catch { /* l'exploration est un bonus, pas un prérequis */ }

  return dedoublonner([
    ...melanger(proches).slice(0, nProches),
    ...melanger(ailleurs).slice(0, taille - nProches),
  ]);
}

const melanger = (a) => [...a].sort(() => Math.random() - 0.5);

function dedoublonner(liste) {
  const vus = new Set();
  return liste.filter((t) => {
    const cle = `${t.mediaType}:${t.tmdbId}`;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}
