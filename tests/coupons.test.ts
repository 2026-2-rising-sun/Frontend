import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createCoupons } from '../src/api/http/coupons'
import { createHttpClient } from '../src/api/http/client'
Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
test('쿠폰 경로·페이지와 공개 상품 조회 권한을 분리하고 기존 수령 응답을 지원한다', async () => {
  const calls: { url: URL; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => { calls.push({ url: new URL(String(url)), options }); return Response.json({ success: true, data: String(url).includes('claims') ? { id: 'member-coupon', couponId: 'policy-coupon', status: 'AVAILABLE' } : [] }, { status: 200 }) }
  const coupons = createCoupons(createHttpClient('/api', { accessToken: () => 'token', unauthorized() {} }))
  await coupons.available(2); await coupons.mine(3); await coupons.product('12'); const owned = await coupons.claim('policy-coupon')
  assert.equal(calls[0].url.pathname, '/api/commerce/v1/coupons'); assert.equal(calls[0].url.searchParams.get('page'), '2')
  assert.equal(calls[1].url.pathname, '/api/commerce/v1/me/coupons'); assert.equal(calls[1].url.searchParams.get('page'), '3')
  assert.equal(calls[2].url.pathname, '/api/shopping/v1/products/12/coupons'); assert.equal(new Headers(calls[2].options?.headers).has('Authorization'), false)
  assert.equal(calls[3].options?.method, 'POST'); assert.equal(owned.couponId, 'policy-coupon'); assert.notEqual(owned.id, owned.couponId)
})
