/** 플랫폼 추상화: 웹(IndexedDB) / Electron(userData 파일, v0.3) */
export interface SaveMeta {
  slot: number;
  updatedAt: string;
  label: string;
}

export interface SaveStorage {
  save(slot: number, data: string, label: string): Promise<void>;
  load(slot: number): Promise<string | null>;
  list(): Promise<SaveMeta[]>;
  remove(slot: number): Promise<void>;
}

declare global {
  interface Window {
    platform?: SaveStorage; // Electron preload에서 contextBridge로 노출 예정
  }
}

const DB_NAME = 'grad-sim';
const STORE = 'saves';

interface Row {
  slot: number;
  data: string;
  label: string;
  updatedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }).finally(() => db.close());
}

const indexedDbStorage: SaveStorage = {
  async save(slot, data, label) {
    await tx('readwrite', (s) => s.put({ slot, data, label, updatedAt: new Date().toISOString() } satisfies Row));
  },
  async load(slot) {
    const row = await tx<Row | undefined>('readonly', (s) => s.get(slot));
    return row?.data ?? null;
  },
  async list() {
    const rows = await tx<Row[]>('readonly', (s) => s.getAll());
    return rows.map(({ slot, updatedAt, label }) => ({ slot, updatedAt, label })).sort((a, b) => a.slot - b.slot);
  },
  async remove(slot) {
    await tx('readwrite', (s) => s.delete(slot));
  },
};

export const storage: SaveStorage = typeof window !== 'undefined' && window.platform ? window.platform : indexedDbStorage;
