import type { Promotion, PromotionsPort, PublicPromotion } from '../../domain/promotions'
import type { HttpClient } from './client'
type Dto<T> = Omit<T, 'id' | 'broadcastId'> & { id: number | string; broadcastId: number | string }
const mapPublic = (item: Dto<PublicPromotion>): PublicPromotion => ({ ...item, id: String(item.id), broadcastId: String(item.broadcastId) })
const map = (item: Dto<Promotion>): Promotion => ({ ...item, id: String(item.id), broadcastId: String(item.broadcastId) })
export function createPromotions(request: HttpClient, publicRequest: HttpClient): PromotionsPort {
  const path = (id: string) => `/live/v1/seller/broadcasts/${encodeURIComponent(id)}/promotions`
  return {
    claim: (broadcastId, promotionId) => request(`/live/v1/broadcasts/${encodeURIComponent(broadcastId)}/promotions/${encodeURIComponent(promotionId)}/claims`, { method: 'POST' }),
    publicList: async id => (await publicRequest<Dto<PublicPromotion>[]>(`/live/v1/broadcasts/${encodeURIComponent(id)}/promotions`)).map(mapPublic),
    list: async id => (await request<Dto<Promotion>[]>(path(id))).map(map),
    create: async (id, input, key) => map(await request<Dto<Promotion>>(path(id), { method: 'POST', body: input, headers: { 'Idempotency-Key': key } })),
    open: async (id, promotionId) => map(await request<Dto<Promotion>>(`${path(id)}/${encodeURIComponent(promotionId)}/open`, { method: 'POST' })),
    close: async (id, promotionId) => map(await request<Dto<Promotion>>(`${path(id)}/${encodeURIComponent(promotionId)}/close`, { method: 'POST' })),
  }
}
