export type StoredStrokePoint = { x: number; y: number; p: number };
export type StoredStroke = { points: StoredStrokePoint[]; color: string; width: number; opacity: number };

type StrokeRecord = { pageKey: string; strokes: StoredStroke[] };

const DATABASE_NAME = "paperflow-handwriting";
const STORE_NAME = "handwriting-strokes";
const VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DATABASE_NAME, VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "pageKey" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open handwriting storage"));
    } catch (error) {
      reject(error);
    }
  });
}

export async function loadStoredStrokes(): Promise<Record<string, StoredStroke[]>> {
  const database = await openDatabase();
  try {
    const records = await new Promise<StrokeRecord[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as StrokeRecord[]);
      request.onerror = () => reject(request.error ?? new Error("Could not load handwriting storage"));
    });
    return Object.fromEntries(records.map((record) => [record.pageKey, record.strokes]));
  } finally {
    database.close();
  }
}

export async function saveStoredStrokes(pageKey: string, strokes: StoredStroke[]): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ pageKey, strokes } satisfies StrokeRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Could not save handwriting storage"));
    });
  } finally {
    database.close();
  }
}
