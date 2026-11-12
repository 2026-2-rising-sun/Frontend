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
