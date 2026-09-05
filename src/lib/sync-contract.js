// Stable client identifiers are generated once per local write and sent with the record.
// This module documents the sync contract without changing existing store behavior yet.
export const SYNC_SCHEMA_VERSION = 2;
export const makeClientId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
