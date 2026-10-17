import type { CouponsPort, MemberCoupon } from '../../domain/coupons'
import { ApiError } from '../../domain/errors'

export async function applicableCoupons(
  mine: CouponsPort['mine'],
  canApply: (couponId: string) => Promise<boolean>,
): Promise<MemberCoupon[]> {
  const candidates: MemberCoupon[] = []
  for (let page = 0; ; page++) {
    const items = await mine(page)
    candidates.push(...items.filter(c => c.status === 'AVAILABLE' && Date.parse(c.expiresAt) > Date.now()))
    if (items.length < 20) break
  }
  const usable: MemberCoupon[] = []
  // Preview does not reserve coupons. Limit concurrent requests to the existing checkout API.
  for (let start = 0; start < candidates.length; start += 4) {
    const batch = candidates.slice(start, start + 4)
    const accepted = await Promise.all(batch.map(async coupon => {
      try { return await canApply(coupon.couponId) }
      catch (error) {
        if (error instanceof ApiError && error.code === 'CONFLICT') return false
        throw error
      }
    }))
    usable.push(...batch.filter((_, index) => accepted[index]))
  }
  return usable
}
