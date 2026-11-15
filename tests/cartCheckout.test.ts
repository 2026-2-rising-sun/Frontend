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
test('현재 계약의 할인액·0원 실결제액과 환불 완료 상태를 그대로 유지한다', async () => {
  globalThis.fetch = async () => Response.json({
    ...group, status: 'PAID', couponId: 'coupon-1', discountAmount: 25000, payableAmount: 0,
    orders: [{ ...savedOrder, status: 'REFUNDED', discountAmount: 20000, payableAmount: 0 }],
  })
  const result = await createHttpApi('/api').paymentGroups.get('PG-1')
  assert.equal(result.totalAmount, 25000)
  assert.equal(result.discountAmount, 25000)
  assert.equal(result.payableAmount, 0)
  assert.equal(result.couponId, 'coupon-1')
  assert.equal(result.orders[0].status, 'REFUNDED')
  assert.equal(result.orders[0].discountAmount, 20000)
  assert.equal(result.orders[0].payableAmount, 0)
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


test('상품 그룹 응답은 상품·SKU·Cart 식별자와 현재 가격·수량·버전을 각각 보존한다', async () => {
  globalThis.fetch = async () => Response.json([
    { productId: 41, productName: '상품 묶음', mainImageUrl: '/image.png', saleEnabled: true, items: [
      { id: 11, skuId: 71, quantity: 2, version: 7, unitPrice: 1200, available: 9, skuStatus: 'ON_SALE', purchasable: true },
      { id: 12, skuId: 72, quantity: 3, version: 2, unitPrice: 2400, available: 0, skuStatus: 'SOLD_OUT', purchasable: false },
    ] },
    { productId: 42, productName: null, mainImageUrl: null, saleEnabled: false, items: [
      { id: 13, skuId: null, quantity: 4, version: 9, unitPrice: null, available: null, skuStatus: null, purchasable: false },
    ] },
  ])
  const items = await createHttpApi('/api').cart.list()
  assert.deepEqual(items.map(i => [i.id, i.productId, i.skuId, i.quantity, i.version, i.unitPrice]), [
    ['11', '41', '71', 2, 7, 1200], ['12', '41', '72', 3, 2, 2400], ['13', '42', null, 4, 9, null],
  ])
  assert.equal(items[0].productName, '상품 묶음')
  assert.equal(items[0].mainImageUrl, '/image.png')
  assert.equal(items[0].available, 9)
  assert.equal(items[1].purchasable, false)
  assert.equal(items[2].saleEnabled, false)
  assert.equal(items.slice(0, 2).reduce((sum, item) => sum + item.unitPrice! * item.quantity, 0), 9600)
})

test('그룹에서 읽은 Cart ID와 새 버전으로 수정·견적·주문·삭제하며 상품이나 SKU ID로 대체하지 않는다', async () => {
  const calls: { path: string; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => {
    const path = new URL(String(url)).pathname; calls.push({ path, options })
    if (options?.method === 'DELETE') return new Response(null, { status: 204 })
    if (options?.method === 'PATCH') return Response.json({ id: 11, productId: 41, skuId: 71, quantity: 3, version: 8 })
    if (path.endsWith('/checkout')) return Response.json({ items: [{ itemId: 11, productId: 41, version: 8, quantity: 3, unitPrice: 1200 }], totalAmount: 3600 })
    if (path.endsWith('/cart/orders')) return Response.json(group)
    return Response.json([{ productId: 41, productName: '서버 현재가', mainImageUrl: null, saleEnabled: true, items: [{ id: 11, skuId: 71, quantity: 2, version: 7, unitPrice: 1200, available: 9, skuStatus: 'ON_SALE', purchasable: true }] }])
  }
  const api = createHttpApi('/api'); const [item] = await api.cart.list()
  const changed = await api.cart.update(item.id, 3)
  assert.equal(changed.skuId, '71'); assert.equal(changed.version, 8)
  const selection = [{ itemId: changed.id, version: changed.version }]
  await api.cart.checkout(selection)
  await api.cart.order({ items: selection, buyerName: '회원', buyerPhone: '01012345678', expectedTotalAmount: 3600, idempotencyKey: 'group-contract' })
  await api.cart.remove(changed.id)
  assert.equal(calls[1].path, '/api/commercecore/v1/cart/items/11')
  assert.deepEqual(JSON.parse(String(calls[1].options?.body)), { quantity: 3 })
  assert.deepEqual(JSON.parse(String(calls[2].options?.body)), { items: [{ itemId: 11, version: 8 }] })
  assert.equal(JSON.parse(String(calls[3].options?.body)).expectedTotalAmount, 3600)
  assert.equal(calls[4].path, '/api/commercecore/v1/cart/items/11')
})
