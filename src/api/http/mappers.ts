import type { Product, AdminProduct, AdminProductStatus, LiveDetail, Order, Paged } from '../../domain/types'
import { ApiError } from '../../domain/errors'
export const states: Record<string, AdminProductStatus> = { NOT_REGISTERED: 'DRAFT', READY: 'READY', ON_SALE: 'SELLING', SOLD_OUT: 'SOLD_OUT', PRIVATE: 'HIDDEN' }
export type ProductDto = { productId: number; name: string | null; description?: string; mainImageUrl: string | null; version?: number; salesStatus?: string; status?: string | null; price: number | null; available?: number | null; purchasable?: boolean; linkId?: number; missing?: boolean }
export const imageUrl = (url: string | null) => url
export function product(p: ProductDto): Product {
  const status = states[p.salesStatus ?? p.status ?? 'PRIVATE']
  if (!status || status === 'DRAFT') throw new ApiError('NETWORK', '상품 판매 정보를 확인하지 못했어요.')
  return { id: String(p.productId), name: p.name ?? '조회할 수 없는 상품', description: p.description ?? '', imageUrl: imageUrl(p.mainImageUrl), price: p.price ?? 0, stock: p.available ?? 0, status, purchasable: p.purchasable, linkId: p.linkId === undefined ? undefined : String(p.linkId), missing: p.missing }
}
export function adminProduct(p: ProductDto, salesId: string | null = null): AdminProduct {
  const status = states[p.salesStatus ?? 'NOT_REGISTERED']
  if (!status) throw new ApiError('NETWORK', '판매 정보를 조회하지 못했어요. 잠시 후 다시 시도해 주세요.')
  return { id: String(p.productId), name: p.name ?? '', description: p.description ?? '', imageUrl: imageUrl(p.mainImageUrl), hasImage: !!p.mainImageUrl, version: p.version ?? 0, status, price: p.price, stock: p.available ?? null, salesId }
}
export type LiveDto = { id: number; title: string; status: string; scheduledAt: string; startedAt?: string | null; endedAt?: string | null; playbackUrl: string | null; playbackAllowed?: boolean; channelArn?: string; version?: number }
export function live(l: LiveDto): LiveDetail {
  const status = ({ 예정: 'READY', 진행: 'LIVE', 종료: 'ENDED', PREPARING: 'READY', READY: 'READY', LIVE: 'LIVE', ENDED: 'ENDED' } as const)[l.status as 'LIVE']
  if (!status) throw new ApiError('UNKNOWN', '방송 상태를 확인하지 못했어요.')
  return { id: String(l.id), title: l.title, status, scheduledAt: l.scheduledAt, startedAt: l.startedAt ?? null, endedAt: l.endedAt ?? null, thumbnailUrl: null, hostName: '', description: '', playbackUrl: l.playbackUrl, playbackAllowed: l.playbackAllowed, channelArn: l.channelArn }
}
export type PageDto<T> = { items: T[]; page: number; size: number; totalElements: number; totalPages: number }
export const page = <T, R>(p: PageDto<T>, map: (x: T) => R): Paged<R> => ({ items: p.items.map(map), page: p.page, size: p.size, totalCount: p.totalElements, hasNext: p.page + 1 < p.totalPages })
export type OrderDto = { orderNumber: string; productName: string; unitPrice: number; quantity: number; totalAmount: number; buyerName: string; createdAt: string; expiresAt: string | null; status: string }
export function order(o: OrderDto): Order {
  const status = ({ PENDING_PAYMENT: 'UNPAID', PAYMENT_CONFIRMING: 'CONFIRMING', PAID: 'PAID', FAILED: 'FAILED', CANCELLED: 'CANCELED', EXPIRED: 'CANCELED' } as const)[o.status as 'PAID']
  if (!status) throw new ApiError('UNKNOWN', '주문 상태를 확인하지 못했어요.')
  return { orderNumber: o.orderNumber, status, productName: o.productName, unitPrice: o.unitPrice, quantity: o.quantity, totalPrice: o.totalAmount, ordererName: o.buyerName, orderedAt: o.createdAt, expiresAt: o.expiresAt, cancelReason: o.status === 'EXPIRED' ? 'EXPIRED' : o.status === 'CANCELLED' ? 'USER' : null }
}
