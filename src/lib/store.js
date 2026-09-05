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
      if (!db.objectStoreNames.contains('items')) {
        const items = db.createObjectStore('items', { keyPath: 'localId', autoIncrement: true });
        items.createIndex('tmdb', ['tmdbId', 'mediaType'], { unique: true });
      }
      if (!db.objectStoreNames.contains('entries')) {
        const entries = db.createObjectStore('entries', { keyPath: 'localId', autoIncrement: true });
        entries.createIndex('item', 'itemId');
      }
      if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences', { keyPath: 'localId', autoIncrement: true });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'localId', autoIncrement: true });
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
const local = (nom, valeur) => tx(nom, 'readwrite', (s) => s.put(valeur));
async function ecrire(nom, valeur) {
  const id = await local(nom, valeur);
  await tx('outbox', 'readwrite', (s) => s.put({ table: nom, valeur, at: Date.now() }));
  planifierSync();
  return id;
}
export const items = () => all('items');
export const entries = () => all('entries');
export const preferences = () => all('preferences');
export const itemParTmdb = async (tmdbId, mediaType) => (await items()).find((i) => i.tmdbId === tmdbId && i.mediaType === mediaType) ?? null;
export const entriesDe = async (itemId) => (await entries()).filter((e) => e.itemId === itemId);
export async function ajouterItem(titre) { const existant = await itemParTmdb(titre.tmdbId, titre.mediaType); if (existant) return existant.localId; return ecrire('items', { ...titre, status: 'watching', addedAt: Date.now() }); }
export async function majStatut(localId, status) { const item=(await items()).find(i=>i.localId===localId); if(!item)return; return ecrire('items',{...item,status,updatedAt:Date.now()}); }
export async function cocher({ itemId, season, episode, runtimeMin, airDate, platform }) { return ecrire('entries',{itemId,season,episode,runtimeMin,airDate,platform,watchedAt:Date.now()}); }
export async function decocher(localId) { const existante=(await entries()).find(e=>e.localId===localId); await tx('entries','readwrite',s=>s.delete(localId)); await tx('outbox','readwrite',s=>s.put({table:'entries',suppression:localId,remoteId:existante?.remoteId??null,at:Date.now()})); planifierSync(); }
export async function cocherSaison({itemId,season,episodes}){const deja=await entriesDe(itemId);const vus=new Set(deja.filter(e=>e.season===season).map(e=>e.episode));for(const ep of episodes){if(vus.has(ep.numero))continue;await cocher({itemId,season,episode:ep.numero,runtimeMin:ep.duree,airDate:ep.diffusion});}}
export async function annoter(entryLocalId,{rating,comment}){const e=(await entries()).find(x=>x.localId===entryLocalId);if(!e)return;return ecrire('entries',{...e,rating,comment});}
export async function jugerTitre({tmdbId,mediaType,verdict,source='swipe'}){return ecrire('preferences',{tmdbId,mediaType,verdict,source,decidedAt:Date.now()});}

// Retourne le premier épisode connu non vu de chaque série suivie.
// On s'appuie sur les épisodes effectivement vus et, quand disponibles,
// sur la structure de saison persistée dans item. Sans structure complète,
// on conserve le comportement historique (dernier épisode + 1).
export async function aSuivre(){
  const [is,es]=await Promise.all([items(),entries()]);
  return is.filter(i=>i.mediaType==='tv'&&i.status==='watching').map(i=>{
    const vus=es.filter(e=>e.itemId===i.localId&&e.episode!=null).sort((a,b)=>a.season-b.season||a.episode-b.episode);
    const dernier=vus.at(-1);
    const saisonItems=Array.isArray(i.episodesBySeason)?i.episodesBySeason:null;
    if(saisonItems?.length){
      for(const s of saisonItems){
        const nums=new Set(vus.filter(e=>e.season===s.season).map(e=>e.episode));
        const next=Array.from({length:s.episodeCount},(_,idx)=>idx+1).find(n=>!nums.has(n));
        if(next)return {...i,prochaine:s.season,prochain:next,vuLe:dernier?.watchedAt??null};
      }
      return {...i,prochaine:saisonItems.at(-1).season,prochain:saisonItems.at(-1).episodeCount+1,vuLe:dernier?.watchedAt??null};
    }
    return {...i,prochaine:dernier?.season??1,prochain:(dernier?.episode??0)+1,vuLe:dernier?.watchedAt??null};
  }).sort((a,b)=>(b.vuLe??0)-(a.vuLe??0));
}
export async function journal(){const[is,es]=await Promise.all([items(),entries()]);const parId=new Map(is.map(i=>[i.localId,i]));return es.filter(e=>e.comment||e.rating).sort((a,b)=>b.watchedAt-a.watchedAt).map(e=>({...e,item:parId.get(e.itemId)}));}
export async function exporter(){const[is,es,ps]=await Promise.all([items(),entries(),preferences()]);return{version:1,exporte_le:new Date().toISOString(),items:is,entries:es,preferences:ps};}
export async function telechargerExport(){const data=await exporter();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`tracker-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);}
let timer;function planifierSync(){clearTimeout(timer);timer=setTimeout(vider,3000);}
async function pousserItem(valeur){const{data,error}=await supabase.from('items').upsert({tmdb_id:valeur.tmdbId,media_type:valeur.mediaType,title:valeur.title,poster_path:valeur.posterPath??null,genres:valeur.genres??[],status:valeur.status},{onConflict:'user_id,tmdb_id,media_type'}).select('id').single();if(error)throw error;return data.id;}
async function pousserPreference(valeur){const{error}=await supabase.from('preferences').upsert({tmdb_id:valeur.tmdbId,media_type:valeur.mediaType,verdict:valeur.verdict,source:valeur.source},{onConflict:'user_id,tmdb_id,media_type'});if(error)throw error;}
async function pousserEntree(valeur){const item=(await items()).find(i=>i.localId===valeur.itemId);if(!item)return null;const itemRemoteId=await pousserItem(item);const ligne={item_id:itemRemoteId,season:valeur.season??null,episode:valeur.episode??null,watched_at:new Date(valeur.watchedAt).toISOString(),runtime_min:valeur.runtimeMin??null,platform:valeur.platform??null,rating:valeur.rating??null,comment:valeur.comment??null,air_date:valeur.airDate??null};if(valeur.remoteId){const{error}=await supabase.from('entries').update(ligne).eq('id',valeur.remoteId);if(error)throw error;return valeur.remoteId;}const{data,error}=await supabase.from('entries').insert(ligne).select('id').single();if(error)throw error;return data.id;}
async function supprimerEntree(remoteId){if(!remoteId)return;const{error}=await supabase.from('entries').delete().eq('id',remoteId);if(error)throw error;}
async function envoyerLot(lot){if(lot.suppression!=null){if(lot.table==='entries')await supprimerEntree(lot.remoteId);return;}if(lot.table==='items')return pousserItem(lot.valeur);if(lot.table==='preferences')return pousserPreference(lot.valeur);if(lot.table==='entries'){const remoteId=await pousserEntree(lot.valeur);if(remoteId&&remoteId!==lot.valeur.remoteId)await local('entries',{...lot.valeur,remoteId});}}
async function vider(){if(!supabase||!navigator.onLine)return;const{data:{session}}=await supabase.auth.getSession();if(!session)return;const lots=await all('outbox');for(const lot of lots){try{await envoyerLot(lot);await tx('outbox','readwrite',s=>s.delete(lot.localId));}catch{}}}
window.addEventListener('online',vider);
export const synchroniser=vider;
