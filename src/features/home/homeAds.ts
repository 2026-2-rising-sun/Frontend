export interface HomeAd {
  key: string
  /** 줄바꿈은 배열 원소로 나눈다 */
  title: string[]
  description: string
  to: string
  /** 상품 사진 대신 쓰는 그림 */
  art: string[]
  tone: 'lavender' | 'sky' | 'blush' | 'mint' | 'slate' | 'peach'
}

/** 한 번에 보이는 광고 수 */
export const ADS_PER_PAGE = 3

/**
 * "오직 베리온에서만" 광고 배너. 광고 관리 API가 생기기 전까지 기획전으로 안내하는 고정 배너를 쓴다.
 * 3개씩 한 페이지이고, 페이지 번호(1, 2)를 눌러 넘긴다.
 */
export const HOME_ADS: HomeAd[] = [
  { key: 'beauty-pick', title: ['11월 베리PICK', '&수분크림 1+1'], description: '본품 증정 특별주간!', to: '/categories/beauty?sub=skin', art: ['🧴', '💄', '🎁'], tone: 'lavender' },
  { key: 'winter-outer', title: ['겨울 아우터는', '지금 준비할 때'], description: '라온 단독 기획전', to: '/categories/fashion?sub=women', art: ['🧥', '🧣'], tone: 'sky' },
  { key: 'strawberry', title: ['11월 간식선물', '센스있게!'], description: '과일상회 딸기 프로젝트', to: '/categories/food?sub=fresh', art: ['🍓', '🍫'], tone: 'blush' },
  { key: 'camping', title: ['캠핑 가기 좋은 날', '최대 40% 할인'], description: '원터치 텐트 모아보기', to: '/categories/living?sub=camping', art: ['⛺', '🏕️'], tone: 'mint' },
  { key: 'audio', title: ['무선으로', '더 자유롭게'], description: '소닉랩 헤드폰 기획전', to: '/categories/digital?sub=audio', art: ['🎧', '🔊'], tone: 'slate' },
  { key: 'live-coupon', title: ['라이브로 만나는', '겨울 가전 특가'], description: '방송 알림 받고 쿠폰까지', to: '/lives', art: ['📺', '🎟️'], tone: 'peach' },
]
