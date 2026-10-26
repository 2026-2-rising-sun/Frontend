const fallback = new Map<string, { value: string; key: string }>()
/** 응답 유실이나 새로고침 뒤에도 요청 식별자를 유지하며, 로그인한 회원별로 구분한다. */
export function requestIdentity(memberId: string, action: string, payload: unknown) {
  const slot = `commerce:${memberId}:${action}`
  const value = JSON.stringify(payload)
  let saved: { value: string; key: string } | null = fallback.get(slot) ?? null
  try { saved = JSON.parse(sessionStorage.getItem(slot) ?? 'null') ?? saved } catch { /* 저장소를 사용할 수 없다 */ }
  const key = saved?.value === value && typeof saved.key === 'string' ? saved.key : crypto.randomUUID()
  fallback.set(slot, { value, key })
  try { sessionStorage.setItem(slot, JSON.stringify({ value, key })) } catch { /* 호출자가 메모리에 키를 유지한다 */ }
  return { key, clear() { fallback.delete(slot); try { sessionStorage.removeItem(slot) } catch { /* 저장소를 사용할 수 없다 */ } } }
}
