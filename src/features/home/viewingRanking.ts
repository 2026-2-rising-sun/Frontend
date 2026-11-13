import type { Api } from '../../domain/ports'
import type { Product } from '../../domain/types'

/** 한 페이지에 보이는 순위 수와 페이지 수 */
export const TRENDING_PER_PAGE = 5
export const TRENDING_PAGES = 2
/** 순위를 고르려고 훑는 판매 중 상품 수 */
const SCAN_SIZE = 50

/** 지금 보고 있는 사람이 많은 순서. 수가 같으면 원래 순서를 지킨다. 보는 사람 수가 없는 상품은 뺀다. */
export function byViewing(products: Product[], size = TRENDING_PER_PAGE * TRENDING_PAGES) {
  return products.filter(product => (product.viewingCount ?? 0) > 0).toSorted((a, b) => (b.viewingCount ?? 0) - (a.viewingCount ?? 0)).slice(0, size)
}

/**
 * "조회 급상승, 인기템". 조회 순위 API가 생기기 전까지 판매 중 상품 첫 50개를 받아 지금 보는 사람 수로 줄 세운다.
 * API가 생기면 이 함수만 그 응답으로 바꾼다.
 */
export async function loadTrending(api: Api) {
  return byViewing((await api.products.list({ status: 'SELLING', size: SCAN_SIZE })).items)
}
