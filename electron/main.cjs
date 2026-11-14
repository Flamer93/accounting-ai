'use strict'

const { app, BrowserWindow, shell, dialog, session } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')
const { loadDesktopEnv } = require('./load-env.cjs')
const { registerDesktopStorage, flushDesktopStorage } = require('./desktop-storage.cjs')

const isDev = !app.isPackaged
const projectRoot = path.resolve(__dirname, '..')
/** Stable packaged port so Chromium origin/localStorage stays consistent when possible. */
const PREFERRED_PORT = 47823
let storageFlushed = false

/** @type {import('node:child_process').ChildProcess | null} */
let serverProcess = null
/** @type {BrowserWindow | null} */
let mainWindow = null
let quitting = false
/** @type {number | null} */
let serverPort = null
/** @type {string | null} */
let startUrl = null

function tryListen(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      const bound = typeof address === 'object' && address ? address.port : port
      server.close((err) => {
        if (err) reject(err)
        else resolve(bound)
      })
    })
    server.on('error', reject)
  })
}

async function findServerPort() {
  try {
    return await tryListen(PREFERRED_PORT)
  } catch {
    return tryListen(0)
  }
}

function waitForHealth(port, timeoutMs = 60_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve()
          return
        }
        retry()
      })
      req.on('error', retry)
      req.setTimeout(2000, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Local extract server did not become ready on port ${port}`))
        return
      }
      setTimeout(tryOnce, 250)
    }
    tryOnce()
  })
}

function appendDesktopLog(line) {
  try {
    const logPath = path.join(app.getPath('userData'), 'desktop.log')
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${line}\n`, 'utf8')
  } catch {
    /* ignore logging failures */
  }
}

function startPackagedServer(port) {
  const serverPath = path.join(process.resourcesPath, 'server.cjs')
  const staticRoot = path.join(process.resourcesPath, 'app-dist')
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Missing packaged server at ${serverPath}`)
  }
  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      ELECTRON_SERVER_DIR: process.resourcesPath,
      NODE_ENV: 'production',
      PORT: String(port),
      HOST: '127.0.0.1',
      STATIC_ROOT: staticRoot,
      APP_ROOT: process.resourcesPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverProcess.stdout?.on('data', (chunk) => {
    const text = String(chunk)
    process.stdout.write(`[server] ${text}`)
    appendDesktopLog(`[server] ${text.trimEnd()}`)
  })
  serverProcess.stderr?.on('data', (chunk) => {
    const text = String(chunk)
    process.stderr.write(`[server] ${text}`)
    appendDesktopLog(`[server:err] ${text.trimEnd()}`)
  })
  serverProcess.on('exit', (code, signal) => {
    serverProcess = null
    serverPort = null
    if (!quitting) {
      const msg = `Extract server exited (code=${code}, signal=${signal})`
      console.error(msg)
      appendDesktopLog(msg)
    }
  })
}

function createWindow(url) {
  // macOS Electron builds feel snappier without Chromium paint invalidation on every resize.
  const isMac = process.platform === 'darwin'
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 520,
    title: 'Accounting AI',
    show: false,
    autoHideMenuBar: true,
    fullscreenable: true,
    backgroundColor: '#0f1613',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: true,
      enableBlinkFeatures: '',
    },
  })

  if (!isMac) {
    mainWindow.on('resize', () => {
      mainWindow?.webContents.invalidate?.()
    })
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    try {
      const target = new URL(openUrl)
      const local = new URL(url)
      if (target.origin === local.origin) {
        return { action: 'allow' }
      }
    } catch {
      /* fall through */
    }
    shell.openExternal(openUrl)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  void mainWindow.loadURL(url)
}

async function ensureServer() {
  if (isDev) {
    startUrl = process.env.ELECTRON_START_URL || 'http://127.0.0.1:5173'
    return startUrl
  }

  if (serverProcess && serverPort && startUrl) {
    return startUrl
  }

  const port = await findServerPort()
  startPackagedServer(port)
  await waitForHealth(port)
  serverPort = port
  startUrl = `http://127.0.0.1:${port}`
  appendDesktopLog(`extract server ready on ${startUrl}`)
  return startUrl
}

async function bootstrap() {
  const loaded = loadDesktopEnv({
    userDataPath: app.getPath('userData'),
    resourcesPath: process.resourcesPath,
    projectRoot,
    isPackaged: app.isPackaged,
  })
  if (loaded.length) {
    console.log(`Loaded desktop env from:\n  ${loaded.join('\n  ')}`)
  }

  const url = await ensureServer()
  createWindow(url)
}

function stopServer() {
  if (!serverProcess) return
  const child = serverProcess
  serverProcess = null
  serverPort = null
  try {
    child.kill('SIGTERM')
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    if (!child.killed) {
      try {
        child.kill('SIGKILL')
      } catch {
        /* ignore */
      }
    }
  }, 2000).unref?.()
}

// Headless/CI Linux often lacks a usable GPU — keep the window usable under xvfb.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
}

async function failStartup(err) {
  const message = err instanceof Error ? err.stack || err.message : String(err)
  console.error(message)
  appendDesktopLog(`startup failed: ${message}`)
  const logHint = (() => {
    try {
      return `\n\nLog file:\n${path.join(app.getPath('userData'), 'desktop.log')}`
    } catch {
      return ''
    }
  })()
  try {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Accounting AI failed to start',
      message: 'The desktop app could not start.',
      detail: `${message}${logHint}`,
      buttons: ['OK'],
    })
  } catch {
    /* ignore dialog failures */
  }
  app.quit()
}

async function flushPersistentState() {
  if (storageFlushed) return
  storageFlushed = true
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop-storage:request-flush')
      // Give the renderer a beat to dump localStorage → userData.
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  } catch {
    /* ignore */
  }
  try {
    flushDesktopStorage()
  } catch {
    /* ignore */
  }
  try {
    await session.defaultSession.flushStorageData()
  } catch {
    /* ignore */
  }
  appendDesktopLog('flushed desktop storage + session')
}

app.whenReady().then(() => {
  registerDesktopStorage(app.getPath('userData'))
  appendDesktopLog(
    `starting packaged=${app.isPackaged} platform=${process.platform} userData=${app.getPath('userData')}`,
  )
  bootstrap().catch((err) => {
    void failStartup(err)
  })

  app.on('activate', () => {
    // macOS: re-open a window when clicking the dock icon
    if (BrowserWindow.getAllWindows().length === 0) {
      storageFlushed = false
      bootstrap().catch((err) => {
        void failStartup(err)
      })
    }
  })
})

app.on('window-all-closed', () => {
  // Keep the extract server alive on macOS until real quit (dock remains)
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  if (!storageFlushed) {
    event.preventDefault()
    quitting = true
    void flushPersistentState()
      .catch(() => undefined)
      .finally(() => {
        stopServer()
        app.quit()
      })
    return
  }
  quitting = true
  stopServer()
})
