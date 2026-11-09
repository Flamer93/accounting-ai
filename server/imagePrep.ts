export interface PreparedImage {
  mime: string
  base64: string
  dataUrl: string
}

const VISION_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

/**
 * Ensure the payload is a clean base64 data URL with a vision-friendly mime.
 * Fixes URL-encoded data URLs (e.g. charset=utf-8,) by converting to base64.
 */
export function prepareImageForVision(dataUrl: string): PreparedImage {
  const base64Match = /^data:([^;,]+(?:;[^;,]+)*)?;base64,(.+)$/s.exec(dataUrl)
  if (base64Match) {
    let mime = (base64Match[1] || 'image/jpeg').split(';')[0].trim().toLowerCase()
    if (mime === 'image/jpg') mime = 'image/jpeg'
    const base64 = base64Match[2].replace(/\s/g, '')
    if (!VISION_MIME.has(mime)) {
      // Keep bytes but label as jpeg if client already normalized; otherwise pass through for error handling
      return { mime, base64, dataUrl: `data:${mime};base64,${base64}` }
    }
    return { mime, base64, dataUrl: `data:${mime};base64,${base64}` }
  }

  const plainMatch = /^data:([^;,]+(?:;[^;,]+)*)?,(.*)$/s.exec(dataUrl)
  if (plainMatch) {
    let mime = (plainMatch[1] || 'application/octet-stream').split(';')[0].trim().toLowerCase()
    if (mime === 'image/jpg') mime = 'image/jpeg'
    const decoded = decodeURIComponent(plainMatch[2])
    const base64 = Buffer.from(decoded, 'utf8').toString('base64')
    return { mime, base64, dataUrl: `data:${mime};base64,${base64}` }
  }

  throw new Error('Expected a data URL image')
}

export function isVisionSupportedMime(mime: string): boolean {
  return VISION_MIME.has(mime.toLowerCase())
}
