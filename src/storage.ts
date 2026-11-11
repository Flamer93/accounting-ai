/** Shared id helper — book data lives in Firestore / per-uid localStorage, not global keys. */
export function uid(prefix = 'id'): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}
