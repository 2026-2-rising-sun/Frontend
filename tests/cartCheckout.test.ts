import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createHttpApi } from '../src/api/http'
import { requestIdentity } from '../src/features/commerce/checkoutRecovery'
Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
const savedOrder = { orderNumber: 'OD-A', groupNumber: 'PG-1', status: 'PENDING_PAYMENT', productName: '상품 A', quantity: 2, unitPrice: 10000, totalAmount: 20000, buyerName: '회원', createdAt: '2026-10-08T00:00:00Z', expiresAt: '2026-10-08T00:15:00Z' }
const group = { groupNumber: 'PG-1', status: 'PENDING_PAYMENT', totalAmount: 25000, expiresAt: savedOrder.expiresAt, orders: [savedOrder, { ...savedOrder, orderNumber: 'OD-B', productName: '상품 B', quantity: 1, unitPrice: 5000, totalAmount: 5000 }], paymentId: null }
test('cart quote and order send versioned selection once, return each order, and group payment uses one stable key', async () => {
  const calls: { path: string; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => {
    const path = new URL(String(url)).pathname; calls.push({ path, options })
    if (path.endsWith('/checkout')) return Response.json({ items: [{ itemId: 1, version: 3, productId: 4, productName: 'A', quantity: 2, unitPrice: 10000, totalAmount: 20000 }], totalAmount: 25000 })
    if (path.endsWith('/payments')) return Response.json({ paymentId: 7, status: 'PROCESSING' })
    return Response.json(group)
  }
  const api = createHttpApi('/api'); const items = [{ itemId: '1', version: 3 }, { itemId: '2', version: 0 }]
  const quote = await api.cart.checkout(items); assert.equal(quote.items[0].itemId, '1'); assert.equal(quote.items[0].productId, '4')
  assert.deepEqual(JSON.parse(String(calls[0].options?.body)), { items: [{ itemId: 1, version: 3 }, { itemId: 2, version: 0 }] })
  const result = await api.cart.order({ items, buyerName: '회원', buyerPhone: '01012345678', expectedTotalAmount: 25000, idempotencyKey: 'create-key' })
  assert.equal(result.orders.length, 2); assert.equal(result.orders[1].totalPrice, 5000); assert.equal(result.orders[0].groupNumber, 'PG-1')
  assert.equal(new Headers(calls[1].options?.headers).get('X-Idempotency-Key'), 'create-key')
  const first = await api.paymentGroups.start('PG-1', 'pay-key'); const retry = await api.paymentGroups.start('PG-1', 'pay-key')
  assert.equal(first.paymentId, '7'); assert.equal(retry.paymentId, '7')
  for (const call of calls.slice(2)) { assert.ok(call.path.endsWith('/payment-groups/PG-1/payments')); assert.equal(new Headers(call.options?.headers).get('X-Idempotency-Key'), 'pay-key'); assert.deepEqual(JSON.parse(String(call.options?.body)), {}) }
})
test('active group supports 204 and owner recovery restores known payment ID', async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 })
  const api = createHttpApi('/api'); assert.equal(await api.paymentGroups.active(), null)
  globalThis.fetch = async () => Response.json({ ...group, status: 'PAYMENT_CONFIRMING', paymentId: 7 })
  assert.equal((await api.paymentGroups.active())?.paymentId, '7')
})
test('creation identity survives repeated calls and reload storage, changes with input or member, clears for new checkout', () => {
  const values = new Map<string, string>(); Object.assign(globalThis, { sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } })
  const input = { items: [{ itemId: '1', version: 0 }], expectedTotalAmount: 10000 }
  const first = requestIdentity('member-a', 'cart-order', input)
  assert.equal(requestIdentity('member-a', 'cart-order', input).key, first.key)
  assert.notEqual(requestIdentity('member-b', 'cart-order', input).key, first.key)
  assert.notEqual(requestIdentity('member-a', 'cart-order', { ...input, expectedTotalAmount: 11000 }).key, first.key)
  const current = requestIdentity('member-a', 'cart-order', input); current.clear()
  assert.notEqual(requestIdentity('member-a', 'cart-order', input).key, current.key)
})
