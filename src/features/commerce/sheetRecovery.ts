import type { AuthenticatedPayment } from '../../domain/orderSheets'
const memory = new Map<string, string>()
function read(key: string) { try { return sessionStorage.getItem(key) ?? memory.get(key) ?? null } catch { return memory.get(key) ?? null } }
function write(key: string, value: string | null) {
  if (value === null) memory.delete(key); else memory.set(key, value)
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value) } catch { /* 회원별 메모리로 복구한다 */ }
}
export const recentSheet = (member: string) => read(`sheet:${member}:recent`)
export const rememberSheet = (member: string, number: string) => write(`sheet:${member}:recent`, number)
export function savedApproval(member: string, number: string): AuthenticatedPayment | null {
  try { return JSON.parse(read(`sheet:${member}:${number}:approval`) ?? 'null') } catch { return null }
}
/** 인증 결과는 URL/로그에 노출하지 않고 탭의 회원별 복구 저장소에만 유지한다. */
export const saveApproval = (member: string, number: string, value: AuthenticatedPayment | null) => write(`sheet:${member}:${number}:approval`, value ? JSON.stringify(value) : null)
