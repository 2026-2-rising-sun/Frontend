import type { Api } from '../../domain/ports'
import type { LiveStatus, LiveSummary } from '../../domain/types'
import { toKstInputValue } from '../../lib/format'

const PAGE_SIZE = 50
/** 한 상태에서 최대로 훑는 페이지 수. 예정 방송이 아주 많아도 화면이 멈추지 않게 막는다. */
const MAX_PAGES = 10

export interface LiveSchedule {
  /** 진행 중 먼저, 그다음 예정 방송을 시작이 빠른 순서로 */
  items: LiveSummary[]
  /** 진행 중·예정 목록 중 하나라도 불러오지 못했으면 true */
  incomplete: boolean
}

async function listAll(api: Api, status: LiveStatus) {
  const items: LiveSummary[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await api.lives.list({ status, page, size: PAGE_SIZE })
    items.push(...result.items)
    if (!result.hasNext) break
  }
  return items
}

const time = (live: LiveSummary) => Date.parse(live.status === 'LIVE' ? live.startedAt ?? live.scheduledAt : live.scheduledAt)

/** 오늘 이후의 방송 시간표. 진행 중 방송이 가장 앞에 오고, 예정 방송은 시작이 임박한 순서다. */
export async function loadLiveSchedule(api: Api): Promise<LiveSchedule> {
  const [live, ready] = await Promise.allSettled([listAll(api, 'LIVE'), listAll(api, 'READY')])
  if (live.status === 'rejected' && ready.status === 'rejected') throw live.reason
  const onAir = live.status === 'fulfilled' ? live.value.toSorted((a, b) => time(a) - time(b)) : []
  const upcoming = ready.status === 'fulfilled' ? ready.value.toSorted((a, b) => time(a) - time(b)) : []
  const items = [...new Map([...onAir, ...upcoming].map(item => [item.id, item])).values()]
  return { items, incomplete: live.status === 'rejected' || ready.status === 'rejected' }
}

/** 한국 시간 기준 날짜 키. 예: 2026-11-12 */
export const kstDay = (iso: string) => toKstInputValue(iso).slice(0, 10)

/** 진행 중이거나 오늘(한국 시간) 시작 예정인 방송인지 */
export const isTodayLive = (live: LiveSummary, now = new Date()) =>
  live.status === 'LIVE' || (live.status === 'READY' && kstDay(live.scheduledAt) === kstDay(now.toISOString()))

/** 시작 예정 방송을 예정 시각이 빠른 순서로. 진행 중 방송은 메인 배너가 따로 보여 준다. */
export async function loadUpcomingLives(api: Api, limit?: number): Promise<LiveSummary[]> {
  return (await listAll(api, 'READY')).toSorted((a, b) => time(a) - time(b)).slice(0, limit)
}

const DAY_MS = 24 * 60 * 60 * 1000
const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' })

export interface ScheduleDay {
  /** 한국 시간 날짜. 예: 2026-11-15 */
  key: string
  /** 오늘, 내일, 그다음은 요일(토, 일 ...) */
  label: string
  /** 날짜 숫자. 예: 15 */
  date: number
  /** 이날 시작 예정 방송, 시작이 빠른 순서 */
  lives: LiveSummary[]
}

/** 오늘부터 7일(한국 시간)의 날짜 칸. 예정 방송을 날짜별로 나눠 담는다. */
export function weekSchedule(lives: LiveSummary[], now = new Date()): ScheduleDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const at = new Date(now.getTime() + i * DAY_MS)
    const key = kstDay(at.toISOString())
    return {
      key,
      label: i === 0 ? '오늘' : i === 1 ? '내일' : weekdayFormatter.format(at),
      date: Number(key.slice(8, 10)),
      lives: lives.filter(live => live.status === 'READY' && kstDay(live.scheduledAt) === key).toSorted((a, b) => time(a) - time(b)),
    }
  })
}
