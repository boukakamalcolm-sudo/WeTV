import { supabase } from './supabase';

const DB = 'tracker';
const VERSION = 2;
const makeClientId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sync_meta')) db.createObjectStore('sync_meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function ensureSyncMeta() {
  const db = await openDb();
  db.close();
  return VERSION;
}

export { makeClientId };
export const syncDatabaseName = DB;
