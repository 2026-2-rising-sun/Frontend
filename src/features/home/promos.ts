export interface Promo {
  key: string
  eyebrow: string
  /** 줄바꿈은 배열 원소로 나눈다 */
  title: string[]
  description: string
  to: string
  cta: string
  tone: 'berry' | 'raspberry' | 'plum'
}

/**
 * 기획전 배너. 배너 관리 API가 생기기 전까지는 서비스 메뉴로 안내하는 고정 배너를 쓴다.
 * API가 생기면 이 목록 대신 서버 응답으로 같은 모양의 슬라이드를 만든다.
 */
export const PROMOS: Promo[] = [
  { key: 'today', eyebrow: '오특', title: ['오늘만 만나는', '라이브 특가'], description: '오늘 진행하는 라이브를 한곳에 모았어요.', to: '/today', cta: '오늘의 라이브 보기', tone: 'berry' },
  { key: 'sale', eyebrow: '세일', title: ['쿠폰 받고', '더 가볍게 쇼핑'], description: '지금 쿠폰 할인을 받을 수 있는 상품이에요.', to: '/sale', cta: '세일 상품 보기', tone: 'raspberry' },
  { key: 'ranking', eyebrow: '랭킹', title: ['지금 BERRY ON에서', '주목 받는 상품'], description: '카테고리별 순위를 한눈에 확인하세요.', to: '/ranking', cta: '랭킹 보기', tone: 'plum' },
]
