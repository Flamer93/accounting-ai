/** Electron desktop: mirror receipt-ledger:* localStorage into userData. */

const KEY_PREFIX = 'receipt-ledger:'

type DesktopBridge = {
  isDesktop: true
  storageGetAll: () => Promise<Record<string, string>>
  storageSet: (key: string, value: string) => Promise<boolean | void>
  storageRemove: (key: string) => Promise<boolean | void>
  storageReplaceAll: (data: Record<string, string>) => Promise<boolean | void>
  storageFlush: () => Promise<boolean | void>
  onFlushRequest: (cb: () => void) => () => void
}

declare global {
  interface Window {
    accountingDesktop?: DesktopBridge
  }
}

/** In-memory fallback when Chromium localStorage quota rejects a write. */
const memoryFallback = new Map<string, string>()

function collectReceiptKeys(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of memoryFallback) {
    out[key] = value
  }
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(KEY_PREFIX)) continue
      const value = localStorage.getItem(key)
      if (typeof value === 'string') out[key] = value
    }
  } catch {
    /* private mode / blocked */
  }
  return out
}

function getDesktop(): DesktopBridge | null {
  const bridge = window.accountingDesktop
  return bridge?.isDesktop ? bridge : null
}

let patched = false

/**
 * Hydrate localStorage from the desktop userData mirror, then write-through
 * every receipt-ledger:* mutation. Safe no-op in the browser.
 */
export async function hydrateDesktopStorage(): Promise<void> {
  const desktop = getDesktop()
  if (!desktop) return

  try {
    const remote = await desktop.storageGetAll()
    for (const [key, value] of Object.entries(remote)) {
      if (!key.startsWith(KEY_PREFIX) || typeof value !== 'string') continue
      memoryFallback.set(key, value)
      try {
        // Use the native setter so we don't echo back to disk during hydrate.
        Storage.prototype.setItem.call(localStorage, key, value)
      } catch {
        /* quota — keep memoryFallback so reads still work this session */
      }
    }
  } catch (err) {
    console.error('Desktop storage hydrate failed', err)
  }

  if (!patched) {
    patched = true
    const nativeSet = Storage.prototype.setItem
    const nativeRemove = Storage.prototype.removeItem
    const nativeClear = Storage.prototype.clear
    const nativeGet = Storage.prototype.getItem

    Storage.prototype.getItem = function patchedGetItem(key: string) {
      const fromStore = nativeGet.call(this, key)
      if (fromStore != null) return fromStore
      if (this === localStorage && key.startsWith(KEY_PREFIX) && memoryFallback.has(key)) {
        return memoryFallback.get(key)!
      }
      return null
    }

    Storage.prototype.setItem = function patchedSetItem(key: string, value: string) {
      const str = String(value)
      if (this === localStorage && key.startsWith(KEY_PREFIX)) {
        memoryFallback.set(key, str)
        void desktop.storageSet(key, str)
      }
      try {
        nativeSet.call(this, key, str)
      } catch (err) {
        // userData + memory still hold the value on desktop
        if (!(this === localStorage && key.startsWith(KEY_PREFIX))) throw err
      }
    }

    Storage.prototype.removeItem = function patchedRemoveItem(key: string) {
      nativeRemove.call(this, key)
      if (this === localStorage && key.startsWith(KEY_PREFIX)) {
        memoryFallback.delete(key)
        void desktop.storageRemove(key)
      }
    }

    Storage.prototype.clear = function patchedClear() {
      const keys = collectReceiptKeys()
      nativeClear.call(this)
      if (this === localStorage) {
        memoryFallback.clear()
        for (const key of Object.keys(keys)) {
          void desktop.storageRemove(key)
        }
      }
    }
  }

  desktop.onFlushRequest(() => {
    void flushDesktopStorage()
  })

  const flushSoon = () => {
    void flushDesktopStorage()
  }
  window.addEventListener('pagehide', flushSoon)
  window.addEventListener('beforeunload', flushSoon)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSoon()
  })

  // Merge local keys into the mirror — never wipe remote-only keys.
  try {
    const local = collectReceiptKeys()
    for (const [key, value] of Object.entries(local)) {
      await desktop.storageSet(key, value)
    }
    await desktop.storageFlush()
  } catch {
    /* ignore */
  }
}

export async function flushDesktopStorage(): Promise<void> {
  const desktop = getDesktop()
  if (!desktop) return
  try {
    const remote = await desktop.storageGetAll()
    const merged = { ...remote, ...collectReceiptKeys() }
    await desktop.storageReplaceAll(merged)
    await desktop.storageFlush()
  } catch (err) {
    console.error('Desktop storage flush failed', err)
  }
}
