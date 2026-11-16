/**
 * 매일 선착순 쿠폰. 매일 정해진 시각에 수량이 정해진 쿠폰이 열리고, 먼저 받은 사람만 쓴다.
 * 받기는 기존 쿠폰 받기 API(coupons.claim)를 그대로 쓰고, 수량과 1인 1장은 서버가 지킨다.
 */
export interface CouponDrop {
  couponId: string
  name: string
  fixedDiscount: number
  opensAt: string
  /** 받기 마감 시각 */
  endsAt: string
  issuanceLimit: number
  remaining: number
}

export type CouponDropState = 'UPCOMING' | 'OPEN' | 'SOLD_OUT' | 'CLOSED'

/** 화면에 보일 상태. 남은 수량이 0이면 받기 마감 전이어도 마감으로 본다. */
export function couponDropState(drop: CouponDrop, now: number): CouponDropState {
  if (now < Date.parse(drop.opensAt)) return 'UPCOMING'
  if (now >= Date.parse(drop.endsAt)) return 'CLOSED'
  return drop.remaining > 0 ? 'OPEN' : 'SOLD_OUT'
}

export interface CouponDropsPort {
  /** 오늘 열리는(또는 열린) 선착순 쿠폰 */
  today(): Promise<CouponDrop[]>
  /** 매일 오픈 알림을 신청했는지 */
  alertState(): Promise<boolean>
  setAlert(subscribed: boolean): Promise<void>
}
