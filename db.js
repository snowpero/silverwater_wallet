const DATABASE_NAME = "eunsoo_jigab_db";
const DATABASE_VERSION = 1;
const RECEIPTS_STORE = "receipts";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECEIPTS_STORE)) {
        const store = database.createObjectStore(RECEIPTS_STORE, { keyPath: "id" });
        store.createIndex("purchaseDate", "purchaseDate", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveReceipt(receipt) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RECEIPTS_STORE, "readwrite");
    const store = transaction.objectStore(RECEIPTS_STORE);
    const request = store.put(receipt);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllReceipts() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RECEIPTS_STORE, "readonly");
    const store = transaction.objectStore(RECEIPTS_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
