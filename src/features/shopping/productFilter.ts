import type { ProductSort } from '../../domain/types'

/** 상품 목록의 정렬과 필터. 주소(?sort=&free=1&min=&max=)에 담아 새로고침, 뒤로가기에도 유지한다. */
export interface ProductFilter { sort: ProductSort; freeShipping: boolean; minPrice?: number; maxPrice?: number }

export const SORT_OPTIONS: { value: ProductSort; label: string; description?: string }[] = [
  { value: 'RANKING', label: '랭킹순', description: '상품의 판매량, 리뷰 수, 등록일 등을 반영해 일정 시간마다 순위가 업데이트됩니다.' },
  { value: 'SALES', label: '누적 판매량순' },
  { value: 'REVIEWS', label: '리뷰 많은순' },
  { value: 'LATEST', label: '신상품순' },
  { value: 'PRICE_ASC', label: '낮은 가격순' },
  { value: 'PRICE_DESC', label: '높은 가격순' },
]

/** 가격 범위 미리 정한 값. 양 끝을 포함한다. */
export const PRICE_RANGES: { label: string; min?: number; max?: number }[] = [
  { label: '1만원 이하', max: 10000 },
  { label: '1만원 ~ 2만원', min: 10000, max: 20000 },
  { label: '2만원 ~ 3만원', min: 20000, max: 30000 },
  { label: '3만원 ~ 4만원', min: 30000, max: 40000 },
  { label: '4만원 ~ 8만원', min: 40000, max: 80000 },
  { label: '8만원 이상', min: 80000 },
]

const price = (value: string | null) => {
  const n = Number(value)
  return value && Number.isInteger(n) && n >= 0 ? n : undefined
}

export function readFilter(params: URLSearchParams): ProductFilter {
  const sort = SORT_OPTIONS.find(option => option.value === params.get('sort'))?.value ?? 'RANKING'
  return { sort, freeShipping: params.get('free') === '1', minPrice: price(params.get('min')), maxPrice: price(params.get('max')) }
}

/** 기존 주소 값은 두고 정렬, 필터 값만 바꾼다. 기본값(랭킹순, 필터 없음)은 주소에서 뺀다. */
export function writeFilter(params: URLSearchParams, filter: ProductFilter) {
  const next = new URLSearchParams(params)
  const set = (key: string, value: string | undefined) => { if (value) next.set(key, value); else next.delete(key) }
  set('sort', filter.sort === 'RANKING' ? undefined : filter.sort)
  set('free', filter.freeShipping ? '1' : undefined)
  set('min', filter.minPrice === undefined ? undefined : String(filter.minPrice))
  set('max', filter.maxPrice === undefined ? undefined : String(filter.maxPrice))
  return next
}

/** 가격 칩에 쓸 이름. 미리 정한 범위면 그 이름, 직접 입력이면 "12,000원 ~ 30,000원", 없으면 null. */
export function priceLabel(filter: Pick<ProductFilter, 'minPrice' | 'maxPrice'>) {
  const { minPrice: min, maxPrice: max } = filter
  if (min === undefined && max === undefined) return null
  const preset = PRICE_RANGES.find(range => range.min === min && range.max === max)
  if (preset) return preset.label
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
  return min === undefined ? `${won(max!)} 이하` : max === undefined ? `${won(min)} 이상` : `${won(min)} ~ ${won(max)}`
}
