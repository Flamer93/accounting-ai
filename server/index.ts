import cors from 'cors'
import express from 'express'
import multer from 'multer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractFromUpload } from './extract.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const isProd = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT || 5173)

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

async function createApp() {
  const app = express()
  app.use(
    cors({
      origin: true,
      allowedHeaders: ['Content-Type', 'X-Google-Api-Key'],
    }),
  )
  // Receipt dataUrls (JPEG/PNG) can be several MB when JSON-wrapped
  app.use(express.json({ limit: '20mb' }))

  app.get('/api/health', (req, res) => {
    const headerKey = String(req.header('x-google-api-key') || '').trim()
    res.json({
      ok: true,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
      googleKeyPresent: Boolean(headerKey),
      extractPriority: ['google (request key)', 'openai (host env)', 'mock'],
    })
  })

  app.post('/api/extract', upload.single('file'), async (req, res) => {
    try {
      const file = req.file
      let dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : ''
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

      const result = await withTimeout(
        extractFromUpload({
          filename,
          size: size || dataUrl.length,
          dataUrl,
          fields,
          googleApiKey: googleApiKey || undefined,
        }),
        60_000,
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
    const dist = path.join(root, 'dist')
    app.use(express.static(dist))
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      if (req.path.startsWith('/api')) {
        next()
        return
      }
      res.sendFile(path.join(dist, 'index.html'))
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

createApp()
  .then((app) => {
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`Receipt Ledger listening on http://127.0.0.1:${port}`)
      console.log(
        process.env.OPENAI_API_KEY
          ? 'Host OpenAI extraction available; Google key may be sent per request'
          : 'OPENAI_API_KEY unset — Google request key or mock extractor',
      )
    })
    // Keep sockets alive long enough for Gemini retries, but don't hang forever
    server.requestTimeout = 70_000
    server.headersTimeout = 75_000
    server.keepAliveTimeout = 10_000
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
