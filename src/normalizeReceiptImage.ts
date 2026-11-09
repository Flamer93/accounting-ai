/** Default longest-edge cap — enough for typical phone photos. */
const MAX_EDGE = 2400
/** Taller receipts get a higher cap so bottom TOTAL/tax text stays readable. */
const MAX_EDGE_TALL = 3200
const TALL_ASPECT = 1.5
const BOTTOM_FRACTION = 0.45
const JPEG_QUALITY = 0.92

export interface NormalizedReceiptImage {
  dataUrl: string
  mimeType: string
  /** Optional bottom detail crop for very tall receipts (never replaces the full image). */
  bottomDataUrl?: string
  width: number
  height: number
}

/**
 * Normalize a receipt data URL for vision APIs:
 * - Never crop the primary image — always send the full frame
 * - Downscale longest edge (higher cap for tall receipts) so small footer text stays readable
 * - For very tall receipts, also produce a bottom detail crop (totals/tax/tip zone)
 * - Re-encode as image/jpeg (or image/png if jpeg fails) with clean base64
 */
export async function normalizeReceiptImage(
  dataUrl: string,
  maxEdge = MAX_EDGE,
): Promise<NormalizedReceiptImage> {
  if (!dataUrl.startsWith('data:')) {
    return { dataUrl, mimeType: 'application/octet-stream', width: 0, height: 0 }
  }

  const img = await loadImage(dataUrl)
  const { width, height } = img
  if (!width || !height) {
    return { dataUrl, mimeType: sniffMime(dataUrl), width: 0, height: 0 }
  }

  const tall = height / width >= TALL_ASPECT
  const edgeCap = Math.max(maxEdge, tall ? MAX_EDGE_TALL : MAX_EDGE)
  const full = renderScaled(img, width, height, edgeCap)

  let bottomDataUrl: string | undefined
  if (tall && height >= 900) {
    // Detail pass: lower portion only — totals/tax/tip/payment often live here
    const cropY = Math.floor(height * (1 - BOTTOM_FRACTION))
    const cropH = height - cropY
    bottomDataUrl = renderRegion(img, 0, cropY, width, cropH, edgeCap).dataUrl
  }

  return {
    dataUrl: full.dataUrl,
    mimeType: full.mimeType,
    bottomDataUrl,
    width: full.width,
    height: full.height,
  }
}

function renderScaled(
  img: HTMLImageElement,
  width: number,
  height: number,
  maxEdge: number,
): { dataUrl: string; mimeType: string; width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))
  return drawToDataUrl(img, 0, 0, width, height, targetW, targetH)
}

function renderRegion(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  maxEdge: number,
): { dataUrl: string; mimeType: string; width: number; height: number } {
  // Scale crop so its longest edge hits maxEdge (allow mild upscale for small bottoms)
  const cropScale = Math.min(2, maxEdge / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * cropScale))
  const h = Math.max(1, Math.round(sh * cropScale))
  return drawToDataUrl(img, sx, sy, sw, sh, w, h)
}

function drawToDataUrl(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  targetW: number,
  targetH: number,
): { dataUrl: string; mimeType: string; width: number; height: number } {
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { dataUrl: img.src, mimeType: sniffMime(img.src), width: sw, height: sh }
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)

  try {
    const jpeg = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    if (jpeg.startsWith('data:image/jpeg;base64,')) {
      return { dataUrl: jpeg, mimeType: 'image/jpeg', width: targetW, height: targetH }
    }
  } catch {
    // fall through to PNG
  }

  const png = canvas.toDataURL('image/png')
  return { dataUrl: png, mimeType: 'image/png', width: targetW, height: targetH }
}

function sniffMime(dataUrl: string): string {
  const match = /^data:([^;,]+)/.exec(dataUrl)
  return match?.[1] || 'application/octet-stream'
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode receipt image for normalization'))
    img.src = dataUrl
  })
}
