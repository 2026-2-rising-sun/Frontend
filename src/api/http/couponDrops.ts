import type { CouponDrop, CouponDropsPort } from '../../domain/couponDrops'
import type { HttpClient } from './client'

type CouponDropDto = Omit<CouponDrop, 'couponId'> & { couponId: string | number }

/** 쿠폰 목록은 commercecore, 오픈 알림은 notification 서비스가 맡는다. 목록은 로그인 없이 본다. */
export function createCouponDrops(request: HttpClient, publicRequest: HttpClient): CouponDropsPort {
  return {
    today: async () => (await publicRequest<CouponDropDto[]>('/commercecore/v1/coupon-drops/today')).map(drop => ({ ...drop, couponId: String(drop.couponId) })),
    alertState: async () => (await request<{ subscribed: boolean }>('/notification/v1/coupon-drop-alerts')).subscribed,
    setAlert: subscribed => request('/notification/v1/coupon-drop-alerts', { method: subscribed ? 'POST' : 'DELETE', responseType: 'empty' }),
  }
}
