export interface BrandBannerAd {
  key: string
  /** 브랜드 앞에 붙는 문구. 예: "단계별 피부 보습," */
  lead: string
  brand: string
  tags: string[]
  /** 상품 사진 대신 쓰는 그림 */
  art: string[]
  tone: 'sand' | 'fog'
}

/** 브랜드를 누르면 그 브랜드 상품 검색 결과로 간다. */
export const brandSearchPath = (brand: string) => `/?q=${encodeURIComponent(brand)}`

/**
 * 홈 섹션 사이에 한 줄로 들어가는 브랜드 띠 배너. 광고 관리 API가 생기기 전까지 고정 값을 쓴다.
 * 브랜드 이름은 모의 상품의 브랜드와 같아서 검색하면 그 브랜드 상품이 나온다.
 */
export const BRAND_BANNERS = {
  beauty: { key: 'sugyeol', lead: '단계별 피부 보습,', brand: '수분결', tags: ['수분케어', '보습케어', '시카케어'], art: ['🧴', '🌿', '🧼'], tone: 'sand' },
  living: { key: 'cozyhome', lead: '포근한 겨울 침실,', brand: '코지홈', tags: ['극세사이불', '무드등', '수면양말'], art: ['🛏️', '🕯️', '🧸'], tone: 'fog' },
} satisfies Record<string, BrandBannerAd>
