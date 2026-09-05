import { details } from './tmdb';
import { items, entriesDe, majStatut } from './store';

// Une série ne passe en "Terminé" que si tous les épisodes de toutes les
// saisons (spéciales exclues) sont vus — jamais sur un seul épisode ou une
// seule saison. À l'inverse, décocher un épisode d'une série déjà marquée
// terminée la fait redevenir "watching", pour ne pas laisser un statut faux.
// Appelé après tout cochage/décochage d'épisode, où qu'il ait lieu (fiche,
// calendrier), pour que la règle soit la même partout.
// Renvoie le statut résultant (nouveau ou inchangé), pour que l'appelant
// puisse synchroniser son propre état local sans un aller-retour au store.
export async function verifierCompletionSerie(itemLocalId) {
  const itemActuel = (await items()).find((i) => i.localId === itemLocalId);
  if (!itemActuel || itemActuel.mediaType !== 'tv') return itemActuel?.status;

  let saisons;
  try {
    const d = await details('tv', itemActuel.tmdbId);
    saisons = (d.seasons || []).filter((s) => s.season_number > 0);
  } catch {
    return itemActuel.status; // pas de données fiables sur les saisons : on ne touche pas au statut
  }
  const total = saisons.reduce((s, se) => s + se.episode_count, 0);
  if (!total) return itemActuel.status;

  const saisonsValides = new Set(saisons.map((s) => s.season_number));
  const entriesActuelles = await entriesDe(itemLocalId);
  const vus = new Set(
    entriesActuelles
      .filter((e) => e.episode != null && saisonsValides.has(e.season))
      .map((e) => `${e.season}-${e.episode}`)
  );

  if (vus.size >= total && itemActuel.status !== 'completed') {
    await majStatut(itemLocalId, 'completed');
    return 'completed';
  }
  if (vus.size < total && itemActuel.status === 'completed') {
    await majStatut(itemLocalId, 'watching');
    return 'watching';
  }
  return itemActuel.status;
}
