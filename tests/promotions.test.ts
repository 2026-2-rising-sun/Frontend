import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createPromotions } from '../src/api/http/promotions'
import type { HttpClient } from '../src/api/http/client'
import { promotionCouponId, visiblePromotions, type PublicPromotion } from '../src/domain/promotions'
test('공개 프로모션과 판매자 생성·열기·닫기는 분리된 명세 경로와 멱등 헤더를 사용한다', async () => {
  const calls: { path: string; options: unknown; anonymous: boolean }[] = []
  const dto = { id: 7, broadcastId: 42, title: '안내', attributes: { couponPolicyId: 123 }, type: 'COUPON_DROP', status: 'READY', version: 0 }
  const client = (anonymous: boolean) => (async (path: string, options: unknown) => { calls.push({ path, options, anonymous }); return options ? dto : [dto] }) as HttpClient
  const api = createPromotions(client(false), client(true))
  const items = await api.publicList('42'); assert.equal(items[0].id, '7'); assert.equal(items[0].attributes.couponPolicyId, 123)
  const input = { type: 'ANNOUNCEMENT', title: '안내', durationSeconds: 30 }
  await api.create('42', input, 'stable-key'); await api.open('42', '7'); await api.close('42', '7')
  assert.equal(calls[0].anonymous, true)
  assert.deepEqual(calls[1].options, { method: 'POST', body: input, headers: { 'Idempotency-Key': 'stable-key' } })
  assert.equal(calls[2].path, '/live/v1/seller/broadcasts/42/promotions/7/open'); assert.equal(calls[3].path, '/live/v1/seller/broadcasts/42/promotions/7/close')
})
test('자동 만료된 배너는 재조회 전에도 노출하지 않는다', () => {
  const items = [{ id: '1', closesAt: '2026-10-16T00:00:00Z' }, { id: '2', closesAt: null }, { id: '3', closesAt: '2026-10-17T00:00:00Z' }] as PublicPromotion[]
  assert.deepEqual(visiblePromotions(items, Date.parse('2026-10-16T01:00:00Z')).map(item => item.id), ['2', '3'])
})

test('쿠폰 이벤트 참조는 Commerce 쿠폰 계약의 UUID를 사용한다', () => {
  const couponPolicyId = '12345678-1234-4321-8765-123456789abc'
  assert.equal(promotionCouponId({ type: 'COUPON_DROP', attributes: { couponPolicyId } }), couponPolicyId)
  for (const id of [null, undefined, '7', 7, '', 'invalid', '../../coupons', 0]) {
    assert.equal(promotionCouponId({ type: 'COUPON_DROP', attributes: { couponPolicyId: id } }), null)
  }
  assert.equal(promotionCouponId({ type: 'ANNOUNCEMENT', attributes: { couponPolicyId } }), null)
})
