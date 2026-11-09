const MAX_EDGE = 2000
const JPEG_QUALITY = 0.92

/**
 * Normalize a receipt data URL for vision APIs:
 * - Decode URL-encoded data URLs into proper images
 * - Downscale so the longest edge is <= 2000px (keeps text readable)
 * - Re-encode as image/jpeg (or image/png if jpeg fails) with clean base64
 */
export async function normalizeReceiptImage(
  dataUrl: string,
  maxEdge = MAX_EDGE,
): Promise<{ dataUrl: string; mimeType: string }> {
  if (!dataUrl.startsWith('data:')) {
    return { dataUrl, mimeType: 'application/octet-stream' }
  }

  const img = await loadImage(dataUrl)
  const { width, height } = img
  if (!width || !height) {
    return { dataUrl, mimeType: sniffMime(dataUrl) }
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { dataUrl, mimeType: sniffMime(dataUrl) }
  }

  // White background helps OCR when source has transparency
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, targetW, targetH)

  try {
    const jpeg = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    if (jpeg.startsWith('data:image/jpeg;base64,')) {
      return { dataUrl: jpeg, mimeType: 'image/jpeg' }
    }
  } catch {
    // fall through to PNG
  }

  const png = canvas.toDataURL('image/png')
  return { dataUrl: png, mimeType: 'image/png' }
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
