/**
 * Persiste a última planilha importada no IndexedDB do navegador
 * (sobrevive a F5 e novas sessões; dados ficam só neste dispositivo/navegador).
 */

const DB_NAME = 'relatorios-dashboard-absences'
const DB_VERSION = 1
const STORE = 'imports'
const KEY_LAST = 'last-import'

export type CachedSpreadsheetMeta = {
  buffer: ArrayBuffer
  fileName: string
  savedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponível'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

export async function saveImportedSpreadsheetCache(buffer: ArrayBuffer, fileName: string): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const payload: CachedSpreadsheetMeta = {
        buffer,
        fileName: fileName || 'planilha.xlsx',
        savedAt: Date.now(),
      }
      const put = store.put(payload, KEY_LAST)
      put.onerror = () => reject(put.error)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function getImportedSpreadsheetCache(): Promise<CachedSpreadsheetMeta | null> {
  if (typeof indexedDB === 'undefined') return null
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return null
  }
  try {
    return await new Promise<CachedSpreadsheetMeta | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const store = tx.objectStore(STORE)
      const get = store.get(KEY_LAST)
      get.onerror = () => reject(get.error)
      get.onsuccess = () => {
        const v = get.result as CachedSpreadsheetMeta | undefined
        if (!v?.buffer || !(v.buffer instanceof ArrayBuffer) || v.buffer.byteLength === 0) {
          resolve(null)
          return
        }
        resolve(v)
      }
    })
  } catch {
    return null
  } finally {
    db.close()
  }
}

export async function clearImportedSpreadsheetCache(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch {
    return
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(KEY_LAST)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* noop */
  } finally {
    db.close()
  }
}
