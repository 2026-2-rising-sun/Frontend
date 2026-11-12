import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createHttpApi } from '../src/api/http'
import { requestIdentity } from '../src/features/commerce/checkoutRecovery'
Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
test('쿠폰 적용 주문은 할인 전 원금·정책 ID·동일 멱등키를 전송하고 0원 견적을 보존한다', async () => {
  const calls: { url: URL; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => { calls.push({ url: new URL(String(url)), options }); return Response.json(String(url).includes('/checkout') ? { unitPrice: 500, totalAmount: 1000, discountAmount: 1000, payableAmount: 0, orderable: true, couponId: 'policy-coupon' } : { orderNumber: 'OD-1', productName: '상품', quantity: 2, unitPrice: 500, totalAmount: 1000, discountAmount: 1000, payableAmount: 0, status: 'PENDING_PAYMENT', buyerName: '회원', createdAt: '2026-10-16T00:00:00Z', expiresAt: null }) }
  const orders = createHttpApi('/api').orders; const quote = await orders.checkout('12', 2, 'policy-coupon'); assert.equal(quote.payableAmount, 0)
  const input = { productId: '12', quantity: 2, expectedUnitPrice: 500, ordererName: '회원', ordererPhone: '01012345678', couponId: 'policy-coupon' }
  const identity = requestIdentity('coupon-test-member', 'direct-order', input)
  await orders.create({ ...input, idempotencyKey: identity.key }); await orders.create({ ...input, idempotencyKey: requestIdentity('coupon-test-member', 'direct-order', input).key })
  assert.equal(calls[0].url.searchParams.get('couponId'), 'policy-coupon')
  for (const call of calls.slice(1)) { const body = JSON.parse(String(call.options?.body)); assert.equal(body.expectedTotalAmount, 1000); assert.equal(body.couponId, 'policy-coupon'); assert.equal(new Headers(call.options?.headers).get('X-Idempotency-Key'), identity.key) }
  assert.notEqual(requestIdentity('coupon-test-member', 'direct-order', { ...input, couponId: 'another-policy' }).key, identity.key)
})
test('장바구니 쿠폰 견적은 동일 항목 버전을 유지하고 할인 금액을 재계산 요청한다', async () => {
  let body: unknown
  globalThis.fetch = async (_url, options) => { body = JSON.parse(String(options?.body)); return Response.json({ items: [{ itemId: 1, version: 7, productId: 12, productName: '상품', quantity: 1, unitPrice: 1000, totalAmount: 1000 }], totalAmount: 1000, discountAmount: 1000, payableAmount: 0, couponId: 'policy-coupon' }) }
  const result = await createHttpApi('/api').cart.checkout([{ itemId: '1', version: 7 }], 'policy-coupon')
  assert.deepEqual(body, { items: [{ itemId: 1, version: 7 }], couponId: 'policy-coupon' }); assert.equal(result.payableAmount, 0)
})
