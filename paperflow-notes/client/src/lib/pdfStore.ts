const DATABASE_NAME = "paperflow-notes";
const STORE_NAME = "imported-pdfs";
const VERSION = 1;

type PdfRecord = { notebookId: string; name: string; type: string; data: ArrayBuffer; savedAt: number };

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

export async function saveImportedPdf(notebookId: string, file: File) {
  const data = await file.arrayBuffer();
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ notebookId, name: file.name, type: file.type || "application/pdf", data, savedAt: Date.now() } satisfies PdfRecord);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not save imported PDF"));
  });
  database.close();
}

export async function loadImportedPdf(notebookId: string) {
  const database = await openDatabase();
  const record = await new Promise<PdfRecord | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(notebookId);
    request.onsuccess = () => resolve(request.result as PdfRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not load imported PDF"));
  });
  database.close();
  return record ? new File([record.data], record.name, { type: record.type, lastModified: record.savedAt }) : null;
}

export async function deleteImportedPdf(notebookId: string) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(notebookId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not delete imported PDF"));
  });
  database.close();
}
