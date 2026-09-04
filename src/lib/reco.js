import { similar, populaires, decouvrir } from './tmdb';
import { items, preferences } from './store';

// Recommandation du premier lot : rapprochement simple, sans modèle.
// Deux tiers de proximité pour la pertinence, un tiers d'exploration
// pour éviter que le système se referme sur lui-même.

const GENRES_EXPLORATION = [99, 18, 80, 878, 35, 9648, 36, 10402];

async function dejaVus() {
  const [is, ps] = await Promise.all([items(), preferences()]);
  return new Set([
    ...is.map((i) => `${i.mediaType}:${i.tmdbId}`),
    ...ps.map((p) => `${p.mediaType}:${p.tmdbId}`),
  ]);
}

// Grille d'amorçage : des titres très connus, qu'on reconnaît d'un coup d'oeil.
// Plus rapide que le tri carte à carte pour démarrer, parce qu'on balaye l'ensemble.
// Rangée par type plutôt que mélangés : on reconnaît plus vite dans sa propre catégorie.
export async function grilleAmorcage(tailleParType = 20) {
  const [series, films] = await Promise.all([populaires('tv'), populaires('movie')]);
  return [
    { cle: 'tv', emoji: '📺', label: 'Séries', titres: melanger(series).slice(0, tailleParType) },
    { cle: 'movie', emoji: '🎬', label: 'Films', titres: melanger(films).slice(0, tailleParType) },
  ];
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
