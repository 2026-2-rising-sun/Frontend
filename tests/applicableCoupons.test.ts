import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applicableCoupons } from '../src/features/coupons/applicableCoupons'
import { ApiError } from '../src/domain/errors'
import type { MemberCoupon } from '../src/domain/coupons'
const coupon = (id: string, overrides: Partial<MemberCoupon> = {}): MemberCoupon => ({ id, couponId: id, name: id, fixedDiscount: 1000, status: 'AVAILABLE', claimedAt: '2026-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z', ...overrides })
test('checks later pages and excludes unavailable, expired and wrong-product coupons', async () => {
  const pages = [Array.from({ length: 20 }, (_, i) => coupon(String(i), { status: 'USED' })), [coupon('valid'), coupon('other-product'), coupon('expired', { expiresAt: '2000-01-01T00:00:00Z' }), coupon('reserved', { status: 'RESERVED' })]]
  const checked: string[] = []
  const result = await applicableCoupons(async page => pages[page ?? 0], async id => { checked.push(id); if (id === 'other-product') throw new ApiError('CONFLICT', 'wrong product'); return true })
  assert.deepEqual(result.map(c => c.couponId), ['valid'])
  assert.deepEqual(checked, ['valid', 'other-product'])
})
test('does not turn a failed eligibility lookup into an empty success', async () => {
  await assert.rejects(applicableCoupons(async () => [coupon('valid')], async () => { throw new ApiError('NETWORK', 'offline') }), { code: 'NETWORK' })
})
test('excludes previews without a discount and bounds concurrent lookups', async () => {
  let active = 0; let max = 0
  const result = await applicableCoupons(async () => Array.from({ length: 9 }, (_, i) => coupon(String(i))), async id => {
    active++; max = Math.max(max, active)
    await new Promise(resolve => setTimeout(resolve, 1)); active--
    return id !== '0'
  })
  assert.equal(result.length, 8); assert.ok(max <= 4)
})
