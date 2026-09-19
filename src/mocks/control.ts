import { useSyncExternalStore } from 'react'

/**
 * mock 동작 제어(개발·시연용). 팀원에게 결제 성공/실패/지연, 조회 오류 화면을 보여주기 위한 스위치.
 * 실제 API 코드는 이 파일을 알지 못한다.
 */
export type PaymentScenario = 'SUCCESS' | 'FAIL' | 'DELAYED_SUCCESS' | 'DELAYED_FAIL'

export interface MockSettings {
  paymentScenario: PaymentScenario
  /** 지연 시나리오에서 결과가 확정되기까지 걸리는 시간(ms) */
  confirmDelayMs: number
  /** 모든 mock 응답에 더하는 네트워크 지연(ms) */
  latencyMs: number
  /** true 면 상품·방송 조회를 실패시킨다 (오류 화면 시연용) */
  failReads: boolean
}

const DEFAULTS: MockSettings = {
  paymentScenario: 'SUCCESS',
  confirmDelayMs: 4000,
  latencyMs: 400,
  failReads: false,
}

let settings: MockSettings = { ...DEFAULTS }
const listeners = new Set<() => void>()

export const getMockSettings = () => settings

export const updateMockSettings = (patch: Partial<MockSettings>) => {
  settings = { ...settings, ...patch }
  listeners.forEach((l) => l())
}

export const useMockSettings = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => settings,
  )
