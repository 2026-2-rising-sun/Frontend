import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createSellerCoupons } from '../src/api/http/coupons'
import { createHttpClient } from '../src/api/http/client'
Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
const settings = { name: '가을 쿠폰', fixedDiscount: 1000, issuanceLimit: 100, startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-02T00:00:00Z', expiresAt: '2026-11-03T00:00:00Z', productIds: [12] }
test('판매자 쿠폰 수정은 전체 설정과 조회 버전을 전송한다', async () => {
  const calls: { url: string; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options }); return Response.json({ success: true, data: { ...settings, id: 'coupon-id', sellerId: 'seller', issuedCount: 0, version: 8 } }) }
  const seller = createSellerCoupons(createHttpClient('/api')); await seller.create(settings); await seller.update('coupon-id', 7, settings)
  assert.equal(calls[0].options?.method, 'POST'); assert.deepEqual(JSON.parse(String(calls[0].options?.body)), settings)
  assert.equal(calls[1].options?.method, 'PATCH'); assert.deepEqual(JSON.parse(String(calls[1].options?.body)), { version: 7, settings })
})
