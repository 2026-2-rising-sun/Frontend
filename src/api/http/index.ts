import { createSellerProducts } from './sellerProducts'
import type { Api } from '../../domain/ports'
import { createHttpAuth } from './auth'

/**
 * 실제 백엔드 어댑터.
 *
 * 회원 인증과 Shopping 판매자 기본정보는 현재 백엔드 계약에 맞춘다.
 * 주문·결제·방송·판매 설정의 나머지 P1 어댑터는 기존 계약을 유지하며 P2 전환이 별도로 필요하다.
 */
export function createHttpApi(baseUrl: string, testAccounts = false): Api {
  const { auth, request } = createHttpAuth(baseUrl, testAccounts)

  return {
    auth,
    products: {
      list: (params) =>
        request('/shopping/products', {
          query: { status: params?.status, sort: params?.sort, q: params?.query, page: params?.page, size: params?.size },
        }),
      get: (id) => request(`/shopping/products/${encodeURIComponent(id)}`),
    },
    lives: {
      list: (params) => request('/live/broadcasts', { query: { status: params?.status, page: params?.page, size: params?.size } }),
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
    admin: {
      products: {
        ...createSellerProducts(request),
        setSaleInfo: (id, input) =>
          request(`/commerce/admin/products/${encodeURIComponent(id)}/sale-info`, { method: 'POST', body: input }),
        changePrice: (id, price) =>
          request(`/commerce/admin/products/${encodeURIComponent(id)}/price`, { method: 'PATCH', body: { price } }),
        setStock: (id, input) =>
          request(`/commerce/admin/products/${encodeURIComponent(id)}/stock`, { method: 'PATCH', body: input }),
        changeSaleStatus: (id, action) =>
          request(`/commerce/admin/products/${encodeURIComponent(id)}/sale-status`, { method: 'POST', body: { action } }),
      },
      lives: {
        list: (params) => request('/live/admin/broadcasts', { query: { status: params?.status, page: params?.page, size: params?.size } }),
        get: (id) => request(`/live/admin/broadcasts/${encodeURIComponent(id)}`),
        create: (input) => request('/live/admin/broadcasts', { method: 'POST', body: input }),
        update: (id, input) => request(`/live/admin/broadcasts/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
        linkProduct: (id, productId) =>
          request(`/live/admin/broadcasts/${encodeURIComponent(id)}/products`, { method: 'POST', body: { productId } }),
        unlinkProduct: (id, productId) =>
          request(`/live/admin/broadcasts/${encodeURIComponent(id)}/products/${encodeURIComponent(productId)}`, { method: 'DELETE' }),
        reorderProducts: (id, productIds) =>
          request(`/live/admin/broadcasts/${encodeURIComponent(id)}/products/order`, { method: 'PATCH', body: { productIds } }),
        start: (id) => request(`/live/admin/broadcasts/${encodeURIComponent(id)}/start`, { method: 'POST' }),
        end: (id) => request(`/live/admin/broadcasts/${encodeURIComponent(id)}/end`, { method: 'POST' }),
      },
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
