import type { IncomingMessage } from 'node:http'
import { mockProducts, type MockProduct } from './mockCatalog.ts'
import { seeded, type MockReply } from './mockServer.ts'

export { seeded }

// Prism 모의 서버의 방송 목록은 계약 예시(2019년) 하나뿐이라 메인 주간 편성표가 늘 비어 보인다.
// 로컬 Prism 모드에서만 방송 목록을 "오늘부터 7일 중 3~5일, 하루 1~2개" 예정 방송으로 바꿔 준다.
// 한국 날짜를 씨앗으로 써서 같은 날 같은 시간대에는 같은 편성이 나온다. 방송 소개 상품은 모의 상품 중 3개를 고른다.
// 나머지 요청은 Prism으로 그대로 넘긴다.

const DAY_MS = 24 * 60 * 60 * 1000
const KST_MS = 9 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const LAST_HOUR = 22
const TITLES = ['윈터 아우터 라이브', '니트 신상 라이브 전용 이벤트', '겨울 가전 특가', '수분 크림 1+1 라이브', '홈카페 원두 기획전', '러닝화 신상 첫 공개', '키즈 겨울 내복 특가', '주방 정리 꿀템 라이브']
const HOSTS = ['베리 호스트', '라이브 한정 쿠폰', '오늘만 특가', '사은품 증정']

export interface MockLive { id: number; title: string; scheduledAt: string; status: 'PREPARING'; playbackUrl: null; playbackAllowed: false; videoStatus: 'READY'; createdAt: string; hostName: string; description: string; thumbnailUrl: null }

/** 오늘(한국 날짜)부터 7일 중 3~5일을 골라 하루 1~2개씩, 10~22시 정각에 시작하는 예정 방송. 오늘은 지금 이후 시각만 쓴다. */
export function weeklyMockLives(now = new Date(), random = seeded(Math.floor((now.getTime() + KST_MS) / DAY_MS))): MockLive[] {
  const todayStart = Math.floor((now.getTime() + KST_MS) / DAY_MS) * DAY_MS - KST_MS // 오늘 0시(한국 시간)의 UTC 시각
  const firstHour = (day: number) => day > 0 ? 10 : Math.max(10, Math.floor((now.getTime() - todayStart) / HOUR_MS) + 1)
  const candidates = [0, 1, 2, 3, 4, 5, 6].filter(day => firstHour(day) <= LAST_HOUR) // 오늘 남은 시간이 없으면 오늘은 뺀다
  const days = candidates.toSorted(() => random() - 0.5).slice(0, 3 + Math.floor(random() * 3))
  return days.toSorted((a, b) => a - b).flatMap(day => {
    const from = firstHour(day)
    const hours = new Set(Array.from({ length: 1 + Math.floor(random() * 2) }, () => from + Math.floor(random() * (LAST_HOUR - from + 1))))
    return [...hours].toSorted((a, b) => a - b).map(hour => todayStart + day * DAY_MS + hour * HOUR_MS)
  }).map((at, n) => ({
    id: 1001 + n, title: TITLES[Math.floor(random() * TITLES.length)], scheduledAt: new Date(at).toISOString(), status: 'PREPARING', playbackUrl: null, playbackAllowed: false,
    videoStatus: 'READY', createdAt: now.toISOString(), hostName: HOSTS[Math.floor(random() * HOSTS.length)], description: '로컬 모의 편성 방송', thumbnailUrl: null,
  }))
}

const onSale = () => mockProducts().filter(product => product.salesStatus === 'ON_SALE')

/** 방송마다 소개하는 판매 중 상품 3개 */
export const liveProducts = (liveId: number, products: MockProduct[]) => [0, 1, 2].map(n => products[(liveId * 7 + n * 13) % products.length])

/** 라이브 할인(베리특가). 방송이 정한 기간 동안 소개 상품에 쿠폰 할인이 붙는다. */
export interface MockLiveDeal { broadcastId: number; broadcastTitle: string; discount: number; startsAt: string; endsAt: string }

/**
 * 방송마다 할인 기간과 할인율을 정한다. 시작은 방송 2~4일 전 17시, 끝은 방송 1~3일 뒤 23:59(한국 시간)이고 할인율은 10~30%다.
 * 이번 주 예정 방송과 지난주 방송(방송 뒤 할인이 남아 있을 수 있다)을 함께 본다.
 * now 가 기간 안인 할인만 돌려준다. 한 상품이 여러 방송에 걸리면 할인액이 큰 쪽을 쓴다.
 */
export function liveDeals(now = new Date(), products = onSale()): Map<number, MockLiveDeal> {
  const deals = new Map<number, MockLiveDeal>()
  const lastWeek = weeklyMockLives(new Date(now.getTime() - 7 * DAY_MS)).map(live => ({ ...live, id: live.id + 100 }))
  for (const live of [...lastWeek, ...weeklyMockLives(now)]) {
    const random = seeded(Date.parse(live.scheduledAt) / HOUR_MS)
    const liveDay = Math.floor((Date.parse(live.scheduledAt) + KST_MS) / DAY_MS) * DAY_MS - KST_MS
    const startsAt = liveDay - (2 + Math.floor(random() * 3)) * DAY_MS + 17 * HOUR_MS
    const endsAt = liveDay + (2 + Math.floor(random() * 3)) * DAY_MS - 60_000
    const rate = 0.1 + Math.floor(random() * 5) * 0.05
    if (now.getTime() < startsAt || now.getTime() > endsAt) continue
    for (const product of liveProducts(live.id, products)) {
      const discount = Math.round(product.price * rate / 100) * 100
      if ((deals.get(product.productId)?.discount ?? 0) >= discount) continue
      deals.set(product.productId, { broadcastId: live.id, broadcastTitle: live.title, discount, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() })
    }
  }
  return deals
}

/** 상품 응답에 지금 걸린 라이브 할인을 붙인다. 없으면 null. */
export function withLiveDeals<T extends MockProduct>(items: T[], now = new Date()): (T & { liveDeal: MockLiveDeal | null })[] {
  const deals = liveDeals(now)
  return items.map(item => ({ ...item, liveDeal: deals.get(item.productId) ?? null }))
}

/** 방송 목록과 방송 소개 상품에 답한다. 그 밖의 방송 요청은 undefined 를 돌려 Prism 에 맡긴다. */
export function liveMock(products = onSale()) {
  return (url: URL, req: IncomingMessage): MockReply | undefined => {
    if (req.method !== 'GET') return
    const linked = url.pathname.match(/^\/v1\/broadcasts\/(\d+)\/products$/)
    if (linked) {
      const id = Number(linked[1])
      return { body: withLiveDeals(liveProducts(id, products)).map((product, n) => ({ ...product, linkId: id * 10 + n })) }
    }
    if (url.pathname !== '/v1/broadcasts') return
    const status = url.searchParams.get('status')
    const all = status === 'LIVE' || status === 'ENDED' ? [] : weeklyMockLives()
    const page = Number(url.searchParams.get('page') ?? 0), size = Number(url.searchParams.get('size') ?? 20)
    return { body: { content: all.slice(page * size, page * size + size), number: page, size, totalElements: all.length, totalPages: Math.ceil(all.length / size) } }
  }
}
