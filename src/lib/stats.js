import { items, entries } from './store';

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
