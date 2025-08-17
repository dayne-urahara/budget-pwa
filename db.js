// db.js — IndexedDB minimal + migration localStorage -> IDB

const DB_NAME = "budget-db";
const DB_VER  = 3; // v3 : mêmes stores + champs étendus pour savings
const STORE   = { meta: "meta", cats: "cats", tx: "tx", savings: "savings" };

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE.meta))    db.createObjectStore(STORE.meta);
      if (!db.objectStoreNames.contains(STORE.cats))    db.createObjectStore(STORE.cats, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE.tx))      db.createObjectStore(STORE.tx, { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains(STORE.savings)) db.createObjectStore(STORE.savings, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function getMeta(key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE.meta, "readonly").objectStore(STORE.meta).get(key);
    tx.onsuccess = () => res(tx.result ?? null);
    tx.onerror   = () => rej(tx.error);
  });
}
async function setMeta(key, val) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE.meta, "readwrite").objectStore(STORE.meta).put(val, key);
    tx.onsuccess = () => res(true);
    tx.onerror   = () => rej(tx.error);
  });
}

async function getAll(store) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(store, "readonly").objectStore(store).getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => rej(req.error);
  });
}
async function put(store, obj) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(store, "readwrite").objectStore(store).put(obj);
    req.onsuccess = () => res(true);
    req.onerror   = () => rej(req.error);
  });
}
async function del(store, key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(store, "readwrite").objectStore(store).delete(key);
    req.onsuccess = () => res(true);
    req.onerror   = () => rej(req.error);
  });
}

// Migration localStorage -> IndexedDB (une seule fois)
async function migrateIfNeeded() {
  const migrated = await getMeta("migrated");
  if (migrated) return;

  const salaryLS = localStorage.getItem("salary");
  const catsLS   = JSON.parse(localStorage.getItem("cats") || "[]");
  const txLS     = JSON.parse(localStorage.getItem("tx")   || "[]");

  if (salaryLS) await setMeta("salary", Number(salaryLS));
  for (const c of catsLS) await put(STORE.cats, c);
  for (const t of txLS)   await put(STORE.tx,  { ...t, id: undefined }); // autoIncrement

  await setMeta("migrated", true);
}
