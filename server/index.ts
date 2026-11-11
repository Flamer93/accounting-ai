import cors from 'cors'
import express from 'express'
import multer from 'multer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractFromUpload } from './extract.ts'

/** Works under tsx (ESM) and the Electron CJS bundle (no import.meta). */
function serverDir(): string {
  if (process.env.ELECTRON_SERVER_DIR) {
    return path.resolve(process.env.ELECTRON_SERVER_DIR)
  }
  try {
    const metaUrl = import.meta.url
    if (typeof metaUrl === 'string' && metaUrl.startsWith('file:')) {
      return path.dirname(fileURLToPath(metaUrl))
    }
  } catch {
    /* CJS bundle */
  }
  // Bundled server.cjs — Node provides __dirname in CommonJS
  const cjsDir = (globalThis as { __dirname?: string }).__dirname
  if (typeof cjsDir === 'string' && cjsDir) return cjsDir
  return process.cwd()
}

const root = path.resolve(process.env.APP_ROOT || path.join(serverDir(), '..'))
const staticRoot = process.env.STATIC_ROOT
  ? path.resolve(process.env.STATIC_ROOT)
  : path.join(root, 'dist')
const isProd = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT || 5173)
const host = process.env.HOST || '0.0.0.0'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf'
    cb(null, ok)
  },
})

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

export async function createApp() {
  const app = express()
  app.use(
    cors({
      origin: true,
      allowedHeaders: ['Content-Type', 'X-Google-Api-Key', 'X-OpenAI-Api-Key'],
    }),
  )
  // Receipt dataUrls (JPEG/PNG) can be several MB when JSON-wrapped
  app.use(express.json({ limit: '20mb' }))

  app.get('/api/health', (req, res) => {
    const googleHeader = String(req.header('x-google-api-key') || '').trim()
    const openaiHeader = String(req.header('x-openai-api-key') || '').trim()
    res.json({
      ok: true,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      googleKeyPresent: Boolean(googleHeader),
      openaiKeyPresent: Boolean(openaiHeader),
      firebaseConfigured: Boolean(
        process.env.FIREBASE_API_KEY &&
          process.env.FIREBASE_AUTH_DOMAIN &&
          process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_APP_ID,
      ),
      extractPriority: [
        'google (request key)',
        'openai (request key or host env)',
        'mock',
      ],
    })
  })

  /** Public Firebase web config from host env (no VITE_/NEXT_PUBLIC_ prefixes). */
  app.get('/api/firebase-config', (_req, res) => {
    const config = {
      apiKey: String(process.env.FIREBASE_API_KEY || '').trim(),
      authDomain: String(process.env.FIREBASE_AUTH_DOMAIN || '').trim(),
      projectId: String(process.env.FIREBASE_PROJECT_ID || '').trim(),
      storageBucket: String(process.env.FIREBASE_STORAGE_BUCKET || '').trim(),
      messagingSenderId: String(process.env.FIREBASE_MESSAGING_SENDER_ID || '').trim(),
      appId: String(process.env.FIREBASE_APP_ID || '').trim(),
    }
    const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)
    if (!configured) {
      res.json({ configured: false })
      return
    }
    res.json({ configured: true, config })
  })

  app.post('/api/extract', upload.single('file'), async (req, res) => {
    try {
      const file = req.file
      let dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : ''
      const bottomDataUrl =
        typeof req.body?.bottomDataUrl === 'string' && req.body.bottomDataUrl.startsWith('data:')
          ? req.body.bottomDataUrl
          : undefined
      let filename = typeof req.body?.filename === 'string' ? req.body.filename : 'receipt'
      let size = Number(req.body?.size || 0)

      if (file) {
        filename = file.originalname || filename
        size = file.size
        dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
      }

      if (!dataUrl) {
        res.status(400).json({ error: 'Missing file or dataUrl' })
        return
      }

      let fields: unknown = req.body?.fields
      if (typeof fields === 'string') {
        try {
          fields = JSON.parse(fields)
        } catch {
          fields = undefined
        }
      }

      // Request-scoped only — never log or persist
      const googleApiKey = String(req.header('x-google-api-key') || req.body?.googleApiKey || '').trim()
      const openaiApiKey = String(req.header('x-openai-api-key') || req.body?.openaiApiKey || '').trim()

      const result = await withTimeout(
        extractFromUpload({
          filename,
          size: size || dataUrl.length,
          dataUrl,
          bottomDataUrl,
          fields,
          googleApiKey: googleApiKey || undefined,
          openaiApiKey: openaiApiKey || undefined,
        }),
        190_000,
        'Extract',
      )
      res.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extract failed'
      console.error('Extract failed:', message)
      const timedOut = /timed out/i.test(message)
      res.status(timedOut ? 504 : 500).json({ error: message })
    }
  })

  if (isProd) {
    app.use(express.static(staticRoot))
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      if (req.path.startsWith('/api')) {
        next()
        return
      }
      res.sendFile(path.join(staticRoot, 'index.html'))
    })
  } else {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      root,
      server: { middlewareMode: true },
      appType: 'custom',
    })
    app.use(vite.middlewares)
    app.use(async (req, res, next) => {
      try {
        const url = req.originalUrl
        const template = await vite.transformIndexHtml(
          url,
          await fs.readFile(path.join(root, 'index.html'), 'utf-8'),
        )
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template)
      } catch (e) {
        vite.ssrFixStacktrace(e as Error)
        next(e)
      }
    })
  }

  return app
}

export async function startServer(options?: { port?: number; host?: string }) {
  const listenPort = options?.port ?? port
  const listenHost = options?.host ?? host
  const app = await createApp()
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const s = app.listen(listenPort, listenHost, () => resolve(s))
    s.on('error', reject)
  })
  // Keep sockets alive long enough for Gemini (~180s budget + retries)
  server.requestTimeout = 200_000
  server.headersTimeout = 205_000
  server.keepAliveTimeout = 10_000
  console.log(`Receipt Ledger listening on http://127.0.0.1:${listenPort}`)
  console.log(
    process.env.OPENAI_API_KEY
      ? 'Host OpenAI extraction available; Google key may be sent per request'
      : 'OPENAI_API_KEY unset — Google request key or mock extractor',
  )
  return server
}

// Direct run (`tsx server/index.ts`) and Electron child (`ELECTRON_RUN_AS_NODE` + bundled server.cjs)
startServer().catch((err) => {
  console.error(err)
  process.exit(1)
})
