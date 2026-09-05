import { similar, decouvrir } from './tmdb';
import { items, preferences } from './store';

// Recommandation du premier lot : rapprochement simple, sans modèle.
// Deux tiers de proximité pour la pertinence, un tiers d'exploration
// pour éviter que le système se referme sur lui-même.

const GENRES_EXPLORATION = [99, 18, 80, 878, 35, 9648, 36, 10402];

// Une catégorie thématique = un genre séries + son équivalent film, fusionnés :
// l'utilisateur choisit "Action", pas "Action côté séries" puis "côté films".
// Les identifiants TMDB diffèrent pourtant entre les deux (10759 vs 28, etc.).
const CATEGORIES = [
  { id: 'action', emoji: '💥', label: 'Action', genreTv: 10759, genreMovie: 28 },
  { id: 'comedie', emoji: '😂', label: 'Comédie', genreTv: 35, genreMovie: 35 },
  { id: 'drame', emoji: '🎭', label: 'Drame', genreTv: 18, genreMovie: 18 },
  { id: 'animation', emoji: '🎨', label: 'Animation', genreTv: 16, genreMovie: 16 },
  { id: 'scifi', emoji: '🚀', label: 'Science-fiction', genreTv: 10765, genreMovie: 878 },
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
// Une catégorie à la fois (puces), séries et films mélangés dedans : on choisit
// un thème, pas un type de média. "Tout" ouvre en résumant les autres catégories.
export async function grilleAmorcage(tailleParCategorie = 12) {
  const dejaPlace = new Set();
  const categories = [];
  for (const cat of CATEGORIES) {
    let titres = [];
    try {
      const [tv, films] = await Promise.all([
        decouvrir('tv', { genre: cat.genreTv }),
        decouvrir('movie', { genre: cat.genreMovie }),
      ]);
      // Un titre qui coche plusieurs catégories (une comédie d'action) ne se
      // range que dans la première rencontrée, jamais montré deux fois.
      const brut = melanger([...tv, ...films])
        .filter((t) => !dejaPlace.has(`${t.mediaType}:${t.tmdbId}`));
      titres = brut.slice(0, tailleParCategorie);
      titres.forEach((t) => dejaPlace.add(`${t.mediaType}:${t.tmdbId}`));
    } catch { /* une catégorie indisponible ne bloque pas les autres */ }
    categories.push({ id: cat.id, emoji: cat.emoji, label: cat.label, titres });
  }

  const tout = melanger(categories.flatMap((c) => c.titres)).slice(0, tailleParCategorie);
  return [{ id: 'tout', emoji: '🍿', label: 'Tout', titres: tout }, ...categories];
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
