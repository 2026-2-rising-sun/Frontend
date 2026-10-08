const fallback = new Map<string, { value: string; key: string }>()
/** Retain a request identity across a lost response and page reload. Scope it to the signed-in member. */
export function requestIdentity(memberId: string, action: string, payload: unknown) {
  const slot = `commerce:${memberId}:${action}`
  const value = JSON.stringify(payload)
  let saved: { value: string; key: string } | null = fallback.get(slot) ?? null
  try { saved = JSON.parse(sessionStorage.getItem(slot) ?? 'null') ?? saved } catch { /* unavailable storage */ }
  const key = saved?.value === value && typeof saved.key === 'string' ? saved.key : crypto.randomUUID()
  fallback.set(slot, { value, key })
  try { sessionStorage.setItem(slot, JSON.stringify({ value, key })) } catch { /* in-memory caller retains the key */ }
  return { key, clear() { fallback.delete(slot); try { sessionStorage.removeItem(slot) } catch { /* unavailable storage */ } } }
}
