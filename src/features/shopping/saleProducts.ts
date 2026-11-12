import type { ProductCoupon } from '../../domain/coupons'
import type { Api } from '../../domain/ports'
import type { Paged, Product, ProductSort } from '../../domain/types'

export interface SaleProduct { product: Product; discount: number }

const PRODUCT_PAGE_SIZE = 20
/** 한 번에 보여 줄 세일 상품 수와, 그만큼 찾으려고 훑는 최대 상품 페이지 수 */
const BATCH_TARGET = 12
const MAX_PAGES_PER_BATCH = 5

/** 지금 발급 기간이고 수량이 남은 쿠폰 중 가장 큰 할인액. 없으면 0 */
export function bestActiveDiscount(coupons: ProductCoupon[], now = Date.now()) {
  return coupons
    .filter(c => !c.soldOut && Date.parse(c.startsAt) <= now && Date.parse(c.endsAt) > now && Date.parse(c.expiresAt) > now)
    .reduce((max, c) => Math.max(max, c.fixedDiscount), 0)
}

/**
 * 판매 중 상품을 정렬 순서대로 훑으며 쿠폰 할인이 있는 상품만 모은다.
 * 쿠폰 조회에 실패한 상품은 세일로 단정하지 않고 건너뛴다. 전체 개수는 알 수 없어 totalCount 는 -1 이다.
 */
export async function fetchSalePage(api: Api, sort: ProductSort, page: number, cursor: string | null = null, now = Date.now()): Promise<Paged<SaleProduct>> {
  const items: SaleProduct[] = []
  let next = cursor
  let hasNext = true
  for (let i = 0; i < MAX_PAGES_PER_BATCH && hasNext && items.length < BATCH_TARGET; i++) {
    const products = await api.products.list({ status: 'SELLING', sort, size: PRODUCT_PAGE_SIZE, cursor: next })
    const coupons = await Promise.allSettled(products.items.map(product => api.coupons.product(product.id)))
    products.items.forEach((product, index) => {
      const result = coupons[index]
      const discount = result.status === 'fulfilled' ? bestActiveDiscount(result.value, now) : 0
      if (discount > 0) items.push({ product, discount })
    })
    next = products.nextCursor ?? null
    hasNext = products.hasNext && next !== null
  }
  return { items, page, size: items.length, totalCount: -1, nextCursor: next, hasNext }
}
