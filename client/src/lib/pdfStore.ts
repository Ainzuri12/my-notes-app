const DATABASE_NAME = "paperflow-notes";
const STORE_NAME = "imported-pdfs";
const VERSION = 1;

type ImportedFileRecord = { notebookId: string; name: string; type: string; data: ArrayBuffer; savedAt: number };

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "notebookId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open document storage"));
  });
}

export async function saveImportedFile(notebookId: string, file: File) {
  const data = await file.arrayBuffer();
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ notebookId, name: file.name, type: file.type || "application/octet-stream", data, savedAt: Date.now() } satisfies ImportedFileRecord);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not save imported file"));
  });
  database.close();
}

export async function loadImportedFile(notebookId: string) {
  const database = await openDatabase();
  const record = await new Promise<ImportedFileRecord | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(notebookId);
    request.onsuccess = () => resolve(request.result as ImportedFileRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not load imported file"));
  });
  database.close();
  return record ? new File([record.data], record.name, { type: record.type, lastModified: record.savedAt }) : null;
}

export const saveImportedPdf = saveImportedFile;
export const loadImportedPdf = loadImportedFile;

export async function deleteImportedPdf(notebookId: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(notebookId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not delete imported PDF"));
  });
  database.close();
}
