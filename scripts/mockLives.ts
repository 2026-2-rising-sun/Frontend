import type { IncomingMessage } from 'node:http'
import { mockProducts } from './mockCatalog.ts'
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

/** 방송 목록과 방송 소개 상품에 답한다. 그 밖의 방송 요청은 undefined 를 돌려 Prism 에 맡긴다. */
export function liveMock(products = mockProducts().filter(product => product.salesStatus === 'ON_SALE')) {
  return (url: URL, req: IncomingMessage): MockReply | undefined => {
    if (req.method !== 'GET') return
    const linked = url.pathname.match(/^\/v1\/broadcasts\/(\d+)\/products$/)
    if (linked) {
      const id = Number(linked[1])
      return { body: [0, 1, 2].map(n => products[(id * 7 + n * 13) % products.length]).map((product, n) => ({ ...product, linkId: id * 10 + n })) }
    }
    if (url.pathname !== '/v1/broadcasts') return
    const status = url.searchParams.get('status')
    const all = status === 'LIVE' || status === 'ENDED' ? [] : weeklyMockLives()
    const page = Number(url.searchParams.get('page') ?? 0), size = Number(url.searchParams.get('size') ?? 20)
    return { body: { content: all.slice(page * size, page * size + size), number: page, size, totalElements: all.length, totalPages: Math.ceil(all.length / size) } }
  }
}
