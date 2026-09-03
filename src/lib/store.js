// Local d'abord. L'écran lit et écrit dans IndexedDB, jamais sur le réseau.
// La synchro part en arrière-plan et n'a pas le droit de bloquer un geste.

import { supabase } from './supabase';

const DB = 'tracker';
const VERSION = 1;

function ouvrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const items = db.createObjectStore('items', { keyPath: 'localId', autoIncrement: true });
      items.createIndex('tmdb', ['tmdbId', 'mediaType'], { unique: true });
      const entries = db.createObjectStore('entries', { keyPath: 'localId', autoIncrement: true });
      entries.createIndex('item', 'itemId');
      db.createObjectStore('preferences', { keyPath: 'localId', autoIncrement: true });
      db.createObjectStore('outbox', { keyPath: 'localId', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const dbp = ouvrir();

async function tx(nom, mode, fn) {
  const db = await dbp;
  return new Promise((resolve, reject) => {
    const t = db.transaction(nom, mode);
    const out = fn(t.objectStore(nom));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

const all = (nom) => tx(nom, 'readonly', (s) => s.getAll());

// Écrit sans passer par l'outbox : sert uniquement à la synchro elle-même,
// pour noter localement l'id distant obtenu après un envoi réussi.
const local = (nom, valeur) => tx(nom, 'readwrite', (s) => s.put(valeur));

// Toute écriture locale dépose sa jumelle dans l'outbox. La synchro vide l'outbox plus tard.
async function ecrire(nom, valeur) {
  const id = await local(nom, valeur);
  await tx('outbox', 'readwrite', (s) => s.put({ table: nom, valeur, at: Date.now() }));
  planifierSync();
  return id;
}

export const items = () => all('items');
export const entries = () => all('entries');
export const preferences = () => all('preferences');

export const itemParTmdb = async (tmdbId, mediaType) =>
  (await items()).find((i) => i.tmdbId === tmdbId && i.mediaType === mediaType) ?? null;

export const entriesDe = async (itemId) =>
  (await entries()).filter((e) => e.itemId === itemId);

export async function ajouterItem(titre) {
  const existant = await itemParTmdb(titre.tmdbId, titre.mediaType);
  if (existant) return existant.localId;
  return ecrire('items', { ...titre, status: 'watching', addedAt: Date.now() });
}

export async function majStatut(localId, status) {
  const item = (await items()).find((i) => i.localId === localId);
  if (!item) return;
  return ecrire('items', { ...item, status, updatedAt: Date.now() });
}

// Le geste central de l'application. Retour immédiat, aucune attente réseau.
export async function cocher({ itemId, season, episode, runtimeMin, airDate, platform }) {
  return ecrire('entries', {
    itemId, season, episode, runtimeMin, airDate, platform,
    watchedAt: Date.now(),
  });
}

export async function decocher(localId) {
  // L'id distant part avec la suppression : une fois le local effacé, plus rien
  // ne permettra de retrouver la ligne à retirer côté Supabase.
  const existante = (await entries()).find((e) => e.localId === localId);
  await tx('entries', 'readwrite', (s) => s.delete(localId));
  await tx('outbox', 'readwrite', (s) => s.put({
    table: 'entries', suppression: localId, remoteId: existante?.remoteId ?? null, at: Date.now(),
  }));
  planifierSync();
}

export async function cocherSaison({ itemId, season, episodes }) {
  const deja = await entriesDe(itemId);
  const vus = new Set(deja.filter((e) => e.season === season).map((e) => e.episode));
  for (const ep of episodes) {
    if (vus.has(ep.numero)) continue;
    await cocher({ itemId, season, episode: ep.numero, runtimeMin: ep.duree, airDate: ep.diffusion });
  }
}

// Note et commentaire s'attachent à un visionnage existant. Toujours facultatifs,
// jamais un préalable au cochage.
export async function annoter(entryLocalId, { rating, comment }) {
  const e = (await entries()).find((x) => x.localId === entryLocalId);
  if (!e) return;
  return ecrire('entries', { ...e, rating, comment });
}

export async function jugerTitre({ tmdbId, mediaType, verdict, source = 'swipe' }) {
  return ecrire('preferences', { tmdbId, mediaType, verdict, source, decidedAt: Date.now() });
}

// Prochain épisode non vu de chaque série suivie. C'est l'écran d'accueil réel.
export async function aSuivre() {
  const [is, es] = await Promise.all([items(), entries()]);
  return is
    .filter((i) => i.mediaType === 'tv' && i.status === 'watching')
    .map((i) => {
      const vus = es.filter((e) => e.itemId === i.localId);
      const dernier = [...vus].sort((a, b) => b.watchedAt - a.watchedAt)[0];
      return {
        ...i,
        prochaine: dernier ? dernier.season : 1,
        prochain: dernier ? dernier.episode + 1 : 1,
        vuLe: dernier?.watchedAt ?? null,
      };
    })
    .sort((a, b) => (b.vuLe ?? 0) - (a.vuLe ?? 0));
}

// Journal : tous mes commentaires, du plus récent au plus ancien.
export async function journal() {
  const [is, es] = await Promise.all([items(), entries()]);
  const parId = new Map(is.map((i) => [i.localId, i]));
  return es
    .filter((e) => e.comment || e.rating)
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .map((e) => ({ ...e, item: parId.get(e.itemId) }));
}

// Export intégral. Livré dans le premier lot : c'est la raison d'être du projet.
export async function exporter() {
  const [is, es, ps] = await Promise.all([items(), entries(), preferences()]);
  return { version: 1, exporte_le: new Date().toISOString(), items: is, entries: es, preferences: ps };
}

export async function telechargerExport() {
  const data = await exporter();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Synchro : différée, silencieuse, un lot à la fois. Sans clé Supabase configurée,
// l'app reste pleinement fonctionnelle en local, la file grossit sans jamais se vider.
let timer;
function planifierSync() {
  clearTimeout(timer);
  timer = setTimeout(vider, 3000);
}

// items et preferences ont une clé naturelle (tmdb_id, media_type) côté Supabase :
// l'upsert suffit, aucun id distant à conserver localement.
async function pousserItem(valeur) {
  const { data, error } = await supabase
    .from('items')
    .upsert({
      tmdb_id: valeur.tmdbId,
      media_type: valeur.mediaType,
      title: valeur.title,
      poster_path: valeur.posterPath ?? null,
      genres: valeur.genres ?? [],
      status: valeur.status,
    }, { onConflict: 'tmdb_id,media_type' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function pousserPreference(valeur) {
  const { error } = await supabase
    .from('preferences')
    .upsert({
      tmdb_id: valeur.tmdbId,
      media_type: valeur.mediaType,
      verdict: valeur.verdict,
      source: valeur.source,
    }, { onConflict: 'tmdb_id,media_type' });
  if (error) throw error;
}

// entries n'a pas de clé naturelle (revoir un épisode doit pouvoir créer une
// seconde ligne) : on garde son id distant localement pour les mises à jour
// futures (ex. annoter), et on résout l'item parent au passage.
async function pousserEntree(valeur) {
  const item = (await items()).find((i) => i.localId === valeur.itemId);
  if (!item) return null; // l'item a disparu localement, rien à rattacher
  const itemRemoteId = await pousserItem(item);

  const ligne = {
    item_id: itemRemoteId,
    season: valeur.season ?? null,
    episode: valeur.episode ?? null,
    watched_at: new Date(valeur.watchedAt).toISOString(),
    runtime_min: valeur.runtimeMin ?? null,
    platform: valeur.platform ?? null,
    rating: valeur.rating ?? null,
    comment: valeur.comment ?? null,
    air_date: valeur.airDate ?? null,
  };

  if (valeur.remoteId) {
    const { error } = await supabase.from('entries').update(ligne).eq('id', valeur.remoteId);
    if (error) throw error;
    return valeur.remoteId;
  }

  const { data, error } = await supabase.from('entries').insert(ligne).select('id').single();
  if (error) throw error;
  return data.id;
}

async function supprimerEntree(remoteId) {
  if (!remoteId) return; // jamais envoyée, rien à retirer côté serveur
  const { error } = await supabase.from('entries').delete().eq('id', remoteId);
  if (error) throw error;
}

async function envoyerLot(lot) {
  if (lot.suppression != null) {
    if (lot.table === 'entries') await supprimerEntree(lot.remoteId);
    return;
  }
  if (lot.table === 'items') return pousserItem(lot.valeur);
  if (lot.table === 'preferences') return pousserPreference(lot.valeur);
  if (lot.table === 'entries') {
    const remoteId = await pousserEntree(lot.valeur);
    // On note l'id distant sur l'enregistrement local, pour que la prochaine
    // modification (ex. annoter) mette à jour la même ligne au lieu d'en créer une autre.
    if (remoteId && remoteId !== lot.valeur.remoteId) {
      await local('entries', { ...lot.valeur, remoteId });
    }
  }
}

// Chaque lot est retiré de la file dès qu'il réussit : un échec isolé n'entraîne
// ni doublon (les lots déjà passés ne repartent pas) ni blocage des suivants.
async function vider() {
  if (!supabase || !navigator.onLine) return;
  const lots = await all('outbox');
  for (const lot of lots) {
    try {
      await envoyerLot(lot);
      await tx('outbox', 'readwrite', (s) => s.delete(lot.localId));
    } catch {
      // Ce lot reste dans la file, on le retentera au prochain passage.
      // L'utilisateur n'en sait rien.
    }
  }
}

window.addEventListener('online', vider);
