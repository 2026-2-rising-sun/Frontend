import type { OrderSheetsPort, SheetInput } from '../../domain/orderSheets'
import type { HttpClient } from './client'
const path = (number: string) => `/commercecore/v1/order-sheets/${encodeURIComponent(number)}`
export function createOrderSheets(request: HttpClient): OrderSheetsPort {
  return {
    create: (input: SheetInput, key) => request('/commercecore/v1/order-sheets', { timeoutMs: 15000, method: 'POST', headers: { 'X-Idempotency-Key': key }, body: {
      ...input,
      ...(input.items ? { items: input.items.map(i => ({ ...i, skuId: Number(i.skuId) })) } : {}),
      ...(input.cartItems ? { cartItems: input.cartItems.map(i => ({ ...i, itemId: Number(i.itemId) })) } : {}),
      ...(input.couponSkuId ? { couponSkuId: Number(input.couponSkuId) } : {}),
    } }),
    active: async () => await request<import('../../domain/orderSheets').SheetView | undefined>('/commercecore/v1/order-sheets/active', { timeoutMs: 15000 }) ?? null,
    get: number => request(path(number), { timeoutMs: 15000 }),
    prepare: number => request(`${path(number)}/payment`, { timeoutMs: 15000, method: 'POST' }),
    checkout: number => request(`${path(number)}/payment/checkouts`, { timeoutMs: 15000, method: 'POST' }),
    approve: (number, body, key) => request(`${path(number)}/payment/approval`, { timeoutMs: 15000, method: 'POST', headers: { 'X-Idempotency-Key': key }, body }),
    cancel: number => request(`${path(number)}/cancel`, { timeoutMs: 15000, method: 'POST', responseType: 'empty' }),
  }
}
