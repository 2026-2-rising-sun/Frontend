import type { LiveDeal, Product } from '../../domain/types'
import { formatDealTime } from '../../lib/format'

/** 지금 기간 안인 라이브 할인. 없거나 기간 밖이면 null. */
export function activeDeal(product: Pick<Product, 'liveDeal'>, now = Date.now()): LiveDeal | null {
  const deal = product.liveDeal
  return deal && deal.discount > 0 && Date.parse(deal.startsAt) <= now && now <= Date.parse(deal.endsAt) ? deal : null
}

/**
 * 화면에 보일 가격. 라이브 할인 중이면 "베리특가"로 할인가를 보이고 원래 가격(원가가 있으면 원가)에 줄을 긋는다.
 * 할인이 없으면 판매가를 그대로 보이고, 원가가 있을 때만 줄 그은 원가를 함께 보인다.
 */
export function displayPrice(product: Pick<Product, 'price' | 'originalPrice' | 'liveDeal'>, now = Date.now()) {
  const deal = activeDeal(product, now)
  if (!deal) return { deal: null, before: product.originalPrice ?? null, price: product.price }
  return { deal, before: product.originalPrice ?? product.price, price: Math.max(product.price - deal.discount, 0) }
}

/** "11/3 17:00 ~ 11/16 23:59 까지 한정할인" */
export const dealPeriod = (deal: LiveDeal) => `${formatDealTime(deal.startsAt)} ~ ${formatDealTime(deal.endsAt)} 까지 한정할인`
