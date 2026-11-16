import type { PaymentAuthentication } from '../../domain/orderSheets'
/** 명시적으로 선택한 개발용 인증 대역. 실제 SDK/PG 인증을 뜻하지 않는다. */
export function authenticationDouble(baseUrl: string): PaymentAuthentication {
  const url = new URL(baseUrl)
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('인증 대역은 로컬 전용입니다.')
  return {
    label: '테스트 인증 대역 — 실제 PG 인증 아님',
    async authenticate(input) {
      const { signal, ...payment } = input
      const params = new URLSearchParams(window.location.search)
      const scenario = params.get('authDoubleScenario') ?? 'normal'
      const outcome = params.get('authDoubleOutcome') ?? 'authenticated'
      if (!['normal', 'pending', 'late', 'declined'].includes(scenario) || !['authenticated', 'cancelled', 'failed'].includes(outcome)) throw new Error('검증 대역 설정을 확인해 주세요.')
      const response = await fetch(new URL('/fixture/authentications', url), { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payment, scenario, outcome }) })
      if (!response.ok) throw new Error('테스트 인증 대역에 연결하지 못했어요.')
      const result = await response.json()
      if (result.label !== 'PG_AUTH_DOUBLE') throw new Error('테스트 인증 대역 응답이 아니에요.')
      if (result.outcome === 'cancelled') return null
      if (result.outcome !== 'authenticated') throw new Error('결제 인증에 실패했어요. 승인 요청은 보내지 않았어요.')
      return { paymentKey: result.paymentKey, pgOrderId: result.orderId, amount: result.amount }
    },
  }
}
