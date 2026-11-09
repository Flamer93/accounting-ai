/** Browser fetch wrapper with timeout + clearer network errors. */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 65_000,
): Promise<Response> {
  const controller = new AbortController()
  const external = init.signal
  const onExternalAbort = () => controller.abort()
  if (external) {
    if (external.aborted) controller.abort()
    else external.addEventListener('abort', onExternalAbort, { once: true })
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        'Extract timed out waiting for the server. The AI provider may be slow or unreachable — retry with a smaller JPEG/PNG.',
      )
    }
    if (err instanceof TypeError) {
      throw new Error(
        'Network error: could not reach the extract server (unreachable, connection dropped, or timed out). Confirm the preview is still running on port 5173, then retry.',
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
    if (external) external.removeEventListener('abort', onExternalAbort)
  }
}
