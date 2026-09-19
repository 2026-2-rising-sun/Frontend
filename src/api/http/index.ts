import type { Api } from '../../domain/ports'
import type { ProductBasicInput } from '../../domain/types'
import { createHttpClient } from './client'

/**
 * 실제 백엔드 어댑터.
 *
 * ⚠️ 엔드포인트 경로는 아직 백엔드 OpenAPI(Backend/contracts/api)가 없어 프론트가 가정한 값이다.
 *    스펙이 나오면 이 파일의 경로/응답 매핑만 맞추면 된다. (화면 코드는 domain/ports 에만 의존)
 */
/** 기본정보(+대표 이미지 파일)는 파일 업로드가 있으므로 multipart 로 보낸다. */
const toBasicForm = ({ name, description, image }: ProductBasicInput, version?: number) => {
  const form = new FormData()
  form.set('name', name)
  form.set('description', description)
  if (image) form.set('image', image)
  if (version !== undefined) form.set('version', String(version))
  return form
}

export function createHttpApi(baseUrl: string): Api {
  const request = createHttpClient(baseUrl)

  return {
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
        list: (params) =>
          request('/shopping/admin/products', {
            query: { status: params?.status, q: params?.query, page: params?.page, size: params?.size },
          }),
        get: (id) => request(`/shopping/admin/products/${encodeURIComponent(id)}`),
        create: (input) => request('/shopping/admin/products', { method: 'POST', body: toBasicForm(input) }),
        updateBasicInfo: (id, { version, ...input }) =>
          request(`/shopping/admin/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: toBasicForm(input, version) }),
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
