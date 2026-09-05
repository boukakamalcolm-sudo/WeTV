import { details, season as saisonTmdb } from './tmdb';
import { items, entriesDe, cocher, cocherSaison, majStatut } from './store';

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

// "Déjà vu" ne doit pas se contenter de coller l'étiquette "Terminé" sans
// rien derrière : ça fausserait les statistiques (0 minute, 0 épisode pour
// une œuvre soi-disant vue). La seule action que ce verdict déclenche est
// de cocher réellement chaque épisode de chaque saison — le statut
// "Terminé" en découle ensuite via verifierCompletionSerie, comme pour un
// cochage manuel. Pour un film, il n'y a qu'un seul visionnage à créer.
export async function marquerToutVu(itemLocalId) {
  const item = (await items()).find((i) => i.localId === itemLocalId);
  if (!item) return;

  if (item.mediaType === 'movie') {
    let runtime = null;
    try { runtime = (await details('movie', item.tmdbId)).runtime || null; } catch { /* pas de durée connue, tant pis */ }
    await cocher({ itemId: itemLocalId, season: null, episode: null, runtimeMin: runtime });
    await majStatut(itemLocalId, 'completed');
    return;
  }

  let saisons = [];
  let dureeParDefaut = null;
  try {
    const d = await details('tv', item.tmdbId);
    saisons = (d.seasons || []).filter((s) => s.season_number > 0);
    dureeParDefaut = d.episode_run_time?.[0] || null;
  } catch {
    return; // pas de données fiables sur les saisons : impossible de tout cocher correctement
  }

  for (const s of saisons) {
    try {
      const sd = await saisonTmdb(item.tmdbId, s.season_number);
      await cocherSaison({
        itemId: itemLocalId,
        season: s.season_number,
        episodes: (sd.episodes || []).map((ep) => ({ numero: ep.episode_number, duree: ep.runtime || dureeParDefaut, diffusion: ep.air_date })),
      });
    } catch { /* une saison indisponible ne bloque pas les autres */ }
  }
  await verifierCompletionSerie(itemLocalId);
}
