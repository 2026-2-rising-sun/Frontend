export interface PromotionInput { type: string; title: string; attributes?: Record<string, unknown>; durationSeconds?: number | null }
export interface PublicPromotion { id: string; broadcastId: string; type: string; title: string; attributes: Record<string, unknown>; openedAt?: string | null; closesAt?: string | null }
export interface Promotion extends PublicPromotion { status: 'READY' | 'OPEN' | 'CLOSED'; durationSeconds?: number | null; closedAt?: string | null; closeReason?: string | null; version: number }
export interface PromotionsPort {
  publicList(broadcastId: string): Promise<PublicPromotion[]>
  list(broadcastId: string): Promise<Promotion[]>
  create(broadcastId: string, input: PromotionInput, key: string): Promise<Promotion>
  open(broadcastId: string, id: string): Promise<Promotion>
  close(broadcastId: string, id: string): Promise<Promotion>
}
export function visiblePromotions(items: PublicPromotion[], now = Date.now()) {
  return items.filter(item => !item.closesAt || Date.parse(item.closesAt) > now)
}

/** 프로모션 attributes는 서버가 해석하지 않으므로 쿠폰 참조를 화면에서 검증한다. */
export function promotionCouponId(promotion: Pick<PublicPromotion, 'type' | 'attributes'>): string | null {
  const id = promotion.attributes?.couponPolicyId
  return promotion.type === 'COUPON_DROP' && typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null
}
