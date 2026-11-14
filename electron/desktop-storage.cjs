'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { ipcMain } = require('electron')

const STORE_NAME = 'web-storage.json'
const KEY_PREFIX = 'receipt-ledger:'

/** @type {Record<string, string> | null} */
let cache = null
/** @type {string | null} */
let storePath = null
/** @type {ReturnType<typeof setTimeout> | null} */
let writeTimer = null
let handlersRegistered = false

function ensureLoaded(userDataPath) {
  if (cache && storePath) return cache
  storePath = path.join(userDataPath, STORE_NAME)
  cache = {}
  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof key === 'string' && typeof value === 'string' && key.startsWith(KEY_PREFIX)) {
            cache[key] = value
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to read desktop web-storage.json', err)
    cache = {}
  }
  return cache
}

function writeNow() {
  if (!storePath || !cache) return
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  try {
    const dir = path.dirname(storePath)
    fs.mkdirSync(dir, { recursive: true })
    const tmp = `${storePath}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(cache, null, 0)}\n`, 'utf8')
    fs.renameSync(tmp, storePath)
  } catch (err) {
    console.error('Failed to write desktop web-storage.json', err)
    try {
      // Fallback without atomic rename (some Windows portable/temp edges).
      fs.writeFileSync(storePath, `${JSON.stringify(cache, null, 0)}\n`, 'utf8')
    } catch (err2) {
      console.error('Fallback write also failed', err2)
    }
  }
}

function scheduleWrite() {
  if (writeTimer) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = null
    writeNow()
  }, 40)
}

/**
 * Persist Chromium localStorage keys under userData so data survives
 * random localhost ports and portable relaunches.
 * @param {string} userDataPath
 */
function registerDesktopStorage(userDataPath) {
  ensureLoaded(userDataPath)
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle('desktop-storage:get-all', () => {
    return { ...ensureLoaded(userDataPath) }
  })

  ipcMain.handle('desktop-storage:set', (_event, key, value) => {
    if (typeof key !== 'string' || !key.startsWith(KEY_PREFIX)) return false
    if (typeof value !== 'string') return false
    ensureLoaded(userDataPath)[key] = value
    scheduleWrite()
    return true
  })

  ipcMain.handle('desktop-storage:remove', (_event, key) => {
    if (typeof key !== 'string' || !key.startsWith(KEY_PREFIX)) return false
    delete ensureLoaded(userDataPath)[key]
    scheduleWrite()
    return true
  })

  ipcMain.handle('desktop-storage:replace-all', (_event, data) => {
    const next = {}
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (typeof key === 'string' && typeof value === 'string' && key.startsWith(KEY_PREFIX)) {
          next[key] = value
        }
      }
    }
    cache = next
    storePath = path.join(userDataPath, STORE_NAME)
    writeNow()
    return true
  })

  ipcMain.handle('desktop-storage:flush', () => {
    writeNow()
    return true
  })
}

function flushDesktopStorage() {
  writeNow()
}

module.exports = {
  registerDesktopStorage,
  flushDesktopStorage,
  KEY_PREFIX,
}
