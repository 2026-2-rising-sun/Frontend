import type { Api } from '../../domain/ports'
import type { Product, ProductCategory } from '../../domain/types'

export const RANK_SIZE = 20

/**
 * 랭킹 상품. 판매량·조회수 집계 API가 아직 없어 판매 중인 최신 상품 순서를 순위로 쓴다.
 * 랭킹 화면과 홈 "요즘 주목 받는 상품" 더보기가 함께 쓴다. 집계 API가 생기면 이 함수만 바꾼다.
 */
export async function loadRanking(api: Api, category?: ProductCategory): Promise<Product[]> {
  return (await api.products.list({ status: 'SELLING', sort: 'LATEST', size: RANK_SIZE, category })).items
}
