import type { IncomingMessage } from 'node:http'
import type { MockProduct } from './mockCatalog.ts'
import type { MockReply } from './mockServer.ts'

// 기획전(카탈로그)과 매일 선착순 쿠폰(commercecore)은 아직 Backend 계약에 없다.
// 로컬 Prism 모드에서만 화면을 확인할 수 있게 같은 모양의 응답을 직접 만든다.

const DAY_MS = 24 * 60 * 60 * 1000
const KST_MS = 9 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
/** 오늘 0시(한국 시간)의 UTC 시각 */
const kstToday = (now: number) => Math.floor((now + KST_MS) / DAY_MS) * DAY_MS - KST_MS

type Tone = 'lavender' | 'sky' | 'blush' | 'mint' | 'slate' | 'peach'
interface ExhibitionSpec {
  id: string; title: string; headline: string[]; description: string; art: string[]; tone: Tone; category: MockProduct['category']
  /** 묶음 이름과 그 묶음에 넣을 상품 조건. 위에서부터 묶음 탭 순서다 */
  sections: [title: string, pick: (product: MockProduct) => boolean][]
}

const of = (category: MockProduct['category'], ...subcategories: string[]) => (product: MockProduct) => product.category === category && (!subcategories.length || subcategories.includes(product.subcategory))
const brand = (name: string) => (product: MockProduct) => product.brandName === name

/** 홈 "오직 베리온에서만" 배너 6개가 그대로 기획전 6개가 된다. */
const EXHIBITIONS: ExhibitionSpec[] = [
  { id: 'winter-moisture', title: '겨울 보습 기획전', headline: ['11월 베리PICK', '&수분크림 1+1'], description: '본품 증정 특별주간!', art: ['🧴', '💄', '🎁'], tone: 'lavender', category: 'BEAUTY',
    sections: [['수분결 단독', brand('수분결')], ['스킨케어', of('BEAUTY', 'skin')], ['바디, 헤어', of('BEAUTY', 'body')]] },
  { id: 'winter-outer', title: '겨울 아우터 기획전', headline: ['겨울 아우터는', '지금 준비할 때'], description: '라온 단독 기획전', art: ['🧥', '🧣'], tone: 'sky', category: 'FASHION',
    sections: [['라온 단독', brand('라온')], ['여성의류', of('FASHION', 'women')], ['남성의류', of('FASHION', 'men')], ['가방, 잡화', of('FASHION', 'bag')]] },
  { id: 'strawberry', title: '딸기 간식 선물전', headline: ['11월 간식선물', '센스있게!'], description: '과일상회 딸기 프로젝트', art: ['🍓', '🍫'], tone: 'blush', category: 'FOOD',
    sections: [['과일상회', brand('과일상회')], ['신선식품', of('FOOD', 'fresh')], ['가공식품', of('FOOD', 'processed')]] },
  { id: 'camping', title: '캠핑 준비 기획전', headline: ['캠핑 가기 좋은 날', '최대 40% 할인'], description: '원터치 텐트 모아보기', art: ['⛺', '🏕️'], tone: 'mint', category: 'LIVING',
    sections: [['캠핑, 취미', of('LIVING', 'camping', 'hobby', 'bike', 'toy')], ['주방, 수납', of('LIVING', 'kitchen', 'interior', 'storage')], ['침구, 가구', of('LIVING', 'bedding', 'furniture', 'pet')]] },
  { id: 'wireless-audio', title: '무선 음향 기획전', headline: ['무선으로', '더 자유롭게'], description: '소닉랩 헤드폰 기획전', art: ['🎧', '🔊'], tone: 'slate', category: 'DIGITAL',
    sections: [['소닉랩 단독', brand('소닉랩')], ['음향, 카메라', of('DIGITAL', 'audio', 'camera')], ['휴대폰 액세서리', of('DIGITAL', 'mobile')]] },
  { id: 'winter-appliance', title: '겨울 가전 특가전', headline: ['라이브로 만나는', '겨울 가전 특가'], description: '방송 알림 받고 쿠폰까지', art: ['📺', '🎟️'], tone: 'peach', category: 'DIGITAL',
    sections: [['생활, 주방가전', of('DIGITAL', 'home', 'kitchen', 'camera')], ['PC 주변기기', of('DIGITAL', 'pc')], ['모바일', of('DIGITAL', 'mobile')]] },
]
/** 한 묶음에 넣는 상품 수 */
const PER_SECTION = 8

/** 기획전 기간은 이번 달 1일부터 말일 23:59(한국 시간)까지다. */
function period(now: number) {
  const today = new Date(kstToday(now) + KST_MS)
  const first = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1) - KST_MS
  const next = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1) - KST_MS
  return { startsAt: new Date(first).toISOString(), endsAt: new Date(next - 60_000).toISOString() }
}

/** GET /v1/exhibitions, /v1/exhibitions/{id} 에 답한다. 상품은 판매 중인 것만 쓴다. */
export function exhibitionMock(products: MockProduct[], decorate: (items: MockProduct[]) => object[] = items => items) {
  const onSale = products.filter(product => product.salesStatus === 'ON_SALE')
  const picked = (spec: ExhibitionSpec) => spec.sections.map(([title, pick]) => ({ title, products: onSale.filter(pick).slice(0, PER_SECTION) }))
  const summary = (spec: ExhibitionSpec) => {
    const { id, title, headline, description, art, tone, category } = spec
    // 대표 상품은 묶음 순서대로 겹치지 않게 3개
    const preview = [...new Map(picked(spec).flatMap(section => section.products).map(product => [product.productId, product])).values()].slice(0, 3)
    return { id, title, headline, description, art, tone, category, ...period(Date.now()), previewProducts: decorate(preview) }
  }
  return (url: URL, req: IncomingMessage): MockReply | undefined => {
    if (req.method !== 'GET') return
    if (url.pathname === '/v1/exhibitions') return { body: EXHIBITIONS.map(summary) }
    const id = url.pathname.match(/^\/v1\/exhibitions\/([\w-]+)$/)?.[1]
    const spec = id && EXHIBITIONS.find(item => item.id === id)
    if (!spec) return
    // 상세는 묶음 상품을 주므로 대표 상품은 뺀다(undefined 는 JSON 에 실리지 않는다).
    return { body: { ...summary(spec), previewProducts: undefined, sections: picked(spec).map(section => ({ ...section, products: decorate(section.products) })) } }
  }
}

interface DropSpec { couponId: number; name: string; fixedDiscount: number; condition: string; issuanceLimit: number }
/** 매일 오픈 시각(한국 시간)과 받기 마감 */
export const DROP_HOUR = 10
const DROPS: DropSpec[] = [
  { couponId: 9001, name: '뷰티 선착순 5,000원 쿠폰', fixedDiscount: 5000, condition: '뷰티 3만원 이상', issuanceLimit: 100 },
  { couponId: 9002, name: '식품 선착순 3,000원 쿠폰', fixedDiscount: 3000, condition: '식품 2만원 이상', issuanceLimit: 100 },
  { couponId: 9003, name: '가전 선착순 10,000원 쿠폰', fixedDiscount: 10000, condition: '가전 10만원 이상', issuanceLimit: 50 },
]

/**
 * 오늘의 선착순 쿠폰. 매일 10시에 열린다. 오픈 전, 진행 중, 마감을 한 화면에서 볼 수 있게 첫 쿠폰만 추가 오픈으로 다음 정각에 연다.
 * 진행 중 쿠폰의 남은 수량은 오픈 뒤 지난 시간만큼 줄고, 세 번째 쿠폰은 이미 모두 나갔다.
 */
export function couponDrops(now = Date.now()) {
  const today = kstToday(now)
  const opensAt = today + DROP_HOUR * 60 * 60 * 1000
  const endsAt = today + DAY_MS - 60_000
  return DROPS.map((drop, index) => {
    const nextHour = Math.min(today + 23 * HOUR_MS, Math.ceil((now + 1) / HOUR_MS) * HOUR_MS)
    const opens = index === 0 ? Math.max(opensAt, nextHour) : Math.min(opensAt, now - 10 * 60 * 1000)
    // 진행 중 쿠폰은 60~79장 사이에서 30초마다 한 장씩 더 나가고, 10분마다 처음으로 돌아간다.
    const claimed = index === 2 ? drop.issuanceLimit : now < opens ? 0 : Math.floor(drop.issuanceLimit * 0.6) + Math.floor(now / 30_000) % 20
    return { ...drop, opensAt: new Date(opens).toISOString(), endsAt: new Date(endsAt).toISOString(), remaining: drop.issuanceLimit - claimed }
  })
}

/** GET /v1/coupon-drops/today 에 답한다. */
export function couponDropMock() {
  return (url: URL, req: IncomingMessage): MockReply | undefined => {
    if (req.method === 'GET' && url.pathname === '/v1/coupon-drops/today') return { body: couponDrops() }
  }
}

/** 오픈 알림 신청 상태. 로컬 모의 서버가 켜져 있는 동안만 기억한다. */
export function couponDropAlertMock() {
  let subscribed = false
  return (url: URL, req: IncomingMessage): MockReply | undefined => {
    if (url.pathname !== '/v1/coupon-drop-alerts') return
    if (req.method === 'POST') subscribed = true
    if (req.method === 'DELETE') subscribed = false
    return { body: { subscribed } }
  }
}

/** 여러 모의 응답을 차례로 물어보고 처음 답한 것을 쓴다. */
export const firstOf = (...handlers: ((url: URL, req: IncomingMessage) => MockReply | undefined)[]) =>
  (url: URL, req: IncomingMessage) => handlers.reduce<MockReply | undefined>((reply, handle) => reply ?? handle(url, req), undefined)
