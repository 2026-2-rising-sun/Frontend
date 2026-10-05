import { requireSeller } from '../domain/auth'
import { createMockAuth } from './mockAuth'
import type { Api } from '../domain/ports'
import { mockAdminLivesApi, mockAdminProductsApi } from './mockAdminApi'
import { mockLivesApi } from './mockLivesApi'
import { mockOrdersApi, mockPaymentsApi } from './mockOrdersApi'
import { mockProductsApi } from './mockProductsApi'

/**
 * mock 계층의 유일한 진입점.
 * 이 폴더(src/mocks) 밖에서는 src/bootstrap 만 이 파일을 import 한다. (scripts/check-mock-boundary.mjs 가 검사)
 * 백엔드가 준비되면: src/mocks 삭제 + src/bootstrap/createApi.ts 의 mock 분기 삭제.
 */
export function createMockApi(): Api {
  const auth = createMockAuth()
  function protect<T extends object>(port: T): T {
    return new Proxy(port, {
      get(target, key) {
        const method = Reflect.get(target, key)
        if (typeof method !== 'function') return method
        return async (...args: unknown[]) => {
          requireSeller(auth.getSession())
          return Reflect.apply(method, target, args)
        }
      },
    })
  }
  return {
    auth,
    products: mockProductsApi,
    lives: mockLivesApi,
    orders: mockOrdersApi,
    payments: mockPaymentsApi,
    admin: { products: protect(mockAdminProductsApi), lives: protect(mockAdminLivesApi) },
  }
}

export { MockControlPanel } from './MockControlPanel'
