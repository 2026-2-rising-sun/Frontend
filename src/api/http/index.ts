import type { Api } from '../../domain/ports'
import { createHttpClient } from './client'

/**
 * 실제 백엔드 어댑터.
 *
 * ⚠️ 엔드포인트 경로는 아직 백엔드 OpenAPI(Backend/contracts/api)가 없어 프론트가 가정한 값이다.
 *    스펙이 나오면 이 파일의 경로/응답 매핑만 맞추면 된다. (화면 코드는 domain/ports 에만 의존)
 */
export function createHttpApi(baseUrl: string): Api {
  const request = createHttpClient(baseUrl)

  return {
    products: {
      list: (params) =>
        request('/shopping/products', {
          query: { status: params?.status, sort: params?.sort, q: params?.query },
        }),
      get: (id) => request(`/shopping/products/${encodeURIComponent(id)}`),
    },
    lives: {
      list: (status) => request('/live/broadcasts', { query: { status } }),
      get: (id) => request(`/live/broadcasts/${encodeURIComponent(id)}`),
      listProducts: (id) => request(`/live/broadcasts/${encodeURIComponent(id)}/products`),
    },
    orders: {
      create: (input) => request('/commerce/orders', { method: 'POST', body: input }),
      lookup: (orderNumber, lookupPassword) =>
        request('/commerce/orders/lookup', { method: 'POST', body: { orderNumber, lookupPassword } }),
      cancel: (orderNumber, lookupPassword) =>
        request(`/commerce/orders/${encodeURIComponent(orderNumber)}/cancel`, {
          method: 'POST',
          body: { lookupPassword },
        }),
    },
    payments: {
      start: (orderNumber, lookupPassword) =>
        request(`/commerce/orders/${encodeURIComponent(orderNumber)}/payments`, {
          method: 'POST',
          body: { lookupPassword },
        }),
    },
  }
}
