import type { CouponsPort } from '../../domain/coupons'
import type { HttpClient } from './client'
export function createCoupons(request: HttpClient): CouponsPort {
  return {
    available: (page = 0) => request('/commerce/v1/coupons', { query: { page, size: 20 } }),
    mine: (page = 0) => request('/commerce/v1/me/coupons', { query: { page, size: 20 } }),
    claim: id => request(`/commerce/v1/coupons/${encodeURIComponent(id)}/claims`, { method: 'POST' }),
    product: id => request(`/shopping/v1/products/${encodeURIComponent(id)}/coupons`, { anonymous: true }),
  }
}
