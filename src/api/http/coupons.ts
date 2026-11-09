import type { CouponsPort, SellerCouponsPort } from '../../domain/coupons'
import type { HttpClient } from './client'
export function createCoupons(request: HttpClient): CouponsPort {
  return {
    available: (page = 0) => request('/commercecore/v1/coupons', { query: { page, size: 20 } }),
    mine: (page = 0) => request('/commercecore/v1/me/coupons', { query: { page, size: 20 } }),
    claim: id => request(`/commercecore/v1/coupons/${encodeURIComponent(id)}/claims`, { method: 'POST' }),
    product: id => request(`/catalog/v1/products/${encodeURIComponent(id)}/coupons`, { anonymous: true }),
  }
}
export function createSellerCoupons(request: HttpClient): SellerCouponsPort {
  return {
    list: (page = 0) => request('/commercecore/v1/seller/coupons', { query: { page, size: 20 } }),
    get: id => request(`/commercecore/v1/seller/coupons/${encodeURIComponent(id)}`),
    create: settings => request('/commercecore/v1/seller/coupons', { method: 'POST', body: settings }),
    update: (id, version, settings) => request(`/commercecore/v1/seller/coupons/${encodeURIComponent(id)}`, { method: 'PATCH', body: { version, settings } }),
  }
}
