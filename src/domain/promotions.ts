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
