import type { DeliveryType, LiveDeal, NetContent } from '../../domain/types'
import { formatDealTime } from '../../lib/format'

/** 할인율(%). 할인 전 가격이 없거나 같으면 null. */
export function discountRate(before: number | null, price: number) {
  return before && before > price ? Math.round((1 - price / before) * 100) : null
}

/** 라이브 할인 남은 시간. 하루 안이면 "3시간 남음"(1시간 안이면 분), 그보다 길면 "11/17 23:59까지". */
export function dealRemaining(deal: Pick<LiveDeal, 'endsAt'>, now = Date.now()) {
  const left = Date.parse(deal.endsAt) - now
  if (left <= 0) return null
  if (left < 60 * 60 * 1000) return `${Math.max(1, Math.floor(left / 60000))}분 남음`
  if (left < 24 * 60 * 60 * 1000) return `${Math.floor(left / 3600000)}시간 남음`
  return `${formatDealTime(deal.endsAt)}까지`
}

/** 단위가격. g, ml 은 100 단위, 개는 1개 단위로 나눠 "(100g당 757원)"처럼 보인다. 1개짜리 상품은 null. */
export function unitPriceLabel(content: NetContent | null | undefined, price: number) {
  if (!content || content.amount <= 0) return null
  if (content.unit === '개') return content.amount > 1 ? `(1개당 ${Math.round(price / content.amount).toLocaleString('ko-KR')}원)` : null
  return `(100${content.unit}당 ${Math.round(price / content.amount * 100).toLocaleString('ko-KR')}원)`
}

export const DELIVERY_LABEL: Record<DeliveryType, string> = { DAWN: '새벽도착', TODAY: '오늘출발' }

/** 상품 카드 종류. ProductCard 의 설명을 함께 본다. */
export const CARD_VARIANTS = ['standard', 'deal', 'compact', 'value'] as const

/** 상품 번호로 카드 종류를 고른다. 무작위처럼 섞이지만 같은 상품은 어느 화면에서든 같은 카드다. */
export function randomCardVariant(productId: string): (typeof CARD_VARIANTS)[number] {
  let hash = 0
  for (const char of productId) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b)
  return CARD_VARIANTS[((hash ^ (hash >>> 16)) >>> 0) % CARD_VARIANTS.length]
}
