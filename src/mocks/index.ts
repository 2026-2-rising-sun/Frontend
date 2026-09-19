import type { Api } from '../domain/ports'
import { mockLivesApi } from './mockLivesApi'
import { mockOrdersApi, mockPaymentsApi } from './mockOrdersApi'
import { mockProductsApi } from './mockProductsApi'

/**
 * mock 계층의 유일한 진입점.
 * 이 폴더(src/mocks) 밖에서는 src/bootstrap 만 이 파일을 import 한다. (scripts/check-mock-boundary.mjs 가 검사)
 * 백엔드가 준비되면: src/mocks 삭제 + src/bootstrap/createApi.ts 의 mock 분기 삭제.
 */
export function createMockApi(): Api {
  return {
    products: mockProductsApi,
    lives: mockLivesApi,
    orders: mockOrdersApi,
    payments: mockPaymentsApi,
  }
}

export { MockControlPanel } from './MockControlPanel'
