import type { AuthenticatedPayment } from '../../domain/orderSheets'
interface WidgetIntent { memberId: string; orderNumber: string; pgOrderId: string; amount: number; state: string }
export type WidgetReturn = { outcome: 'success'; payment: AuthenticatedPayment } | { outcome: 'failure'; message: string }
const invalid = new Set<string>()
const invalidKey = (number: string) => `payment-widget:invalid:${number}`
const intentKey = (state: string) => `payment-widget:intent:${state}`
const returnKey = (member: string, number: string) => `payment-widget:return:${member}:${number}`
export function beginWidgetReturn(input: Omit<WidgetIntent, 'state'>, origin: string) {
  const state = crypto.randomUUID() // 고객키가 아닌 리다이렉트 위조 방지용 일회성 값이다.
  const intent: WidgetIntent = { ...input, state }
  sessionStorage.setItem(intentKey(state), JSON.stringify(intent))
  const url = new URL(`/order-sheets/${encodeURIComponent(input.orderNumber)}/payment-return`, origin)
  url.searchParams.set('state', state)
  const success = new URL(url); success.searchParams.set('outcome', 'success')
  const failure = new URL(url); failure.searchParams.set('outcome', 'failure')
  return { state, successUrl: success.href, failUrl: failure.href }
}
export const discardWidgetIntent = (state: string) => { try { sessionStorage.removeItem(intentKey(state)) } catch { /* 저장소가 제한됐다 */ } }
/** 로그인 복원 HTTP보다 먼저 인증키를 주소에서 제거하고, 저장한 창·금액·nonce와 대조한다. */
export function captureWidgetReturn() {
  const url = new URL(window.location.href)
  const match = /^\/order-sheets\/([^/]+)\/payment-return$/.exec(url.pathname)
  if (!match || !url.search) return
  const number = decodeURIComponent(match[1])
  invalid.add(number)
  try {
    sessionStorage.setItem(invalidKey(number), '1')
    const state = url.searchParams.get('state') ?? ''
    const raw = sessionStorage.getItem(intentKey(state))
    if (!raw) return
    const intent: WidgetIntent = JSON.parse(raw)
    if (intent.orderNumber !== decodeURIComponent(match[1]) || intent.state !== state) return
    let result: WidgetReturn = { outcome: 'failure', message: '인증 결과와 저장한 결제창이 일치하지 않아요. 주문 상태를 확인해 주세요.' }
    const unique = ['state', 'outcome', 'paymentKey', 'orderId', 'amount'].every(key => url.searchParams.getAll(key).length <= 1)
    if (unique && url.searchParams.get('outcome') === 'failure') {
      result = { outcome: 'failure', message: url.searchParams.get('code') === 'PAY_PROCESS_CANCELED' ? '결제 인증을 취소했어요. 승인 요청은 보내지 않았어요.' : '결제 인증에 실패했어요. 승인 요청은 보내지 않았어요.' }
    } else if (unique && url.searchParams.get('outcome') === 'success') {
      const amount = Number(url.searchParams.get('amount')); const paymentKey = url.searchParams.get('paymentKey') ?? ''; const pgOrderId = url.searchParams.get('orderId') ?? ''
      if (/^[0-9]+$/.test(url.searchParams.get('amount') ?? '') && Number.isSafeInteger(amount) && amount > 0 && amount === intent.amount && pgOrderId === intent.pgOrderId && paymentKey.length > 0 && paymentKey.length <= 200) result = { outcome: 'success', payment: { paymentKey, pgOrderId, amount } }
    }
    sessionStorage.setItem(returnKey(intent.memberId, intent.orderNumber), JSON.stringify(result))
    sessionStorage.removeItem(invalidKey(number)); invalid.delete(number)
    discardWidgetIntent(state)
  } catch { /* 복구 정보가 없거나 저장소가 제한되면 승인하지 않는다 */ }
  finally { window.history.replaceState(window.history.state, '', url.pathname) }
}
export function readWidgetReturn(member: string, number: string): WidgetReturn | null {
  try {
    if (invalid.has(number) || sessionStorage.getItem(invalidKey(number))) return { outcome: 'failure', message: '인증 복구 정보를 확인할 수 없어요. 주문 상태를 확인해 주세요.' }
    return JSON.parse(sessionStorage.getItem(returnKey(member, number)) ?? 'null')
  } catch { return null }
}
export function clearWidgetReturn(member: string, number: string) { try { sessionStorage.removeItem(returnKey(member, number)) } catch { /* 저장소가 제한됐다 */ } }
