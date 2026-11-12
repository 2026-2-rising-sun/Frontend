import type { Api } from '../../domain/ports'
import type { Product, ProductCategory } from '../../domain/types'
import { toKstInputValue } from '../../lib/format'

export const RANK_SIZE = 20
const HOUR_MS = 60 * 60 * 1000

/**
 * 랭킹 상품. 판매량·조회수 집계 API가 아직 없어 판매 중인 최신 상품 순서를 순위로 쓴다.
 * 랭킹 화면, 홈 "요즘 주목 받는 상품" 더보기, 홈 "시간별 판매 인기"가 함께 쓴다. 집계 API가 생기면 이 함수만 바꾼다.
 */
export async function loadRanking(api: Api, category?: ProductCategory, size = RANK_SIZE): Promise<Product[]> {
  return (await api.products.list({ status: 'SELLING', sort: 'LATEST', size, category })).items
}

/** 판매 인기 순위의 기준 시각(한국 시간, 0~23시). */
export const rankingHour = (now: Date) => Number(toKstInputValue(now.toISOString()).slice(11, 13))

/** 다음 정각까지 남은 시간(ms). 한국 시간은 UTC와 정각 단위로 맞물려 UTC 기준으로 계산해도 같다. */
export const msUntilNextHour = (now: Date) => HOUR_MS - (now.getTime() % HOUR_MS)
