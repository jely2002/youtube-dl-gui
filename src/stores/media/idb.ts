export const DB_NAME = 'media-store';
export const STORE_NAME = 'groups';
export const DB_VERSION = 1;

// Cache database promises by name to support multiple databases (e.g., for testing)
const dbPromises: Map<string, Promise<IDBDatabase>> = new Map();

function getDB(dbName: string = DB_NAME): Promise<IDBDatabase> {
  const existing = dbPromises.get(dbName);
  if (existing) return existing;

  const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  dbPromises.set(dbName, dbPromise);
  return dbPromise;
}

export async function saveGroup(id: string, data: unknown, dbName: string = DB_NAME): Promise<void> {
  // Strip Vue reactivity by serializing to a plain JSON object
  const plainData = JSON.parse(JSON.stringify(data));
  const db = await getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(plainData, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeGroup(id: string, dbName: string = DB_NAME): Promise<void> {
  const db = await getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllGroups(dbName: string = DB_NAME): Promise<unknown[]> {
  const db = await getDB(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
