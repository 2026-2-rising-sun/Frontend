import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { Api } from '../src/domain/ports'
import type { LiveSummary } from '../src/domain/types'
import { loadUpcomingLives, weekSchedule } from '../src/features/live/liveSchedule'
import { formatScheduleTime } from '../src/lib/format'
import { msUntilNextHour, rankingHour } from '../src/features/shopping/rankingProducts'

const live = (id: string, scheduledAt: string): LiveSummary => ({ id, title: id, thumbnailUrl: null, status: 'READY', scheduledAt, startedAt: null, endedAt: null, hostName: '진행자' })

test('판매 인기 기준 시각은 한국 시간의 정시다', () => {
  assert.equal(rankingHour(new Date('2026-11-12T08:59:59Z')), 17)
  assert.equal(rankingHour(new Date('2026-11-12T15:00:00Z')), 0)
})

test('다음 정각까지 남은 시간으로 순위를 다시 불러온다', () => {
  assert.equal(msUntilNextHour(new Date('2026-11-12T08:30:00Z')), 30 * 60_000)
  assert.equal(msUntilNextHour(new Date('2026-11-12T08:00:00Z')), 60 * 60_000)
})

test('오직 베리온에서만은 예정 방송만 모든 페이지에서 모아 시작이 빠른 다섯 개를 고른다', async () => {
  const statuses: string[] = []
  const pages = [
    ['f', 'd', 'b', 'g'].map((id, i) => live(id, `2026-11-${13 + i}T10:00:00Z`)),
    [live('a', '2026-11-12T11:00:00Z'), live('c', '2026-11-12T12:00:00Z')],
  ]
  const api = { lives: { list: async ({ status, page }: { status: string; page: number }) => {
    statuses.push(status)
    return { items: pages[page], hasNext: page === 0 }
  } } } as unknown as Api
  assert.deepEqual((await loadUpcomingLives(api, 5)).map(item => item.id), ['a', 'c', 'f', 'd', 'b'])
  assert.deepEqual(statuses, ['READY', 'READY'])
})

test('일주일 날짜 칸은 오늘, 내일, 요일 순서이고 한국 날짜로 예정 방송을 나눈다', () => {
  const now = new Date('2026-11-12T03:00:00Z') // 한국 시간 11월 12일(목) 12:00
  const days = weekSchedule([
    live('late', '2026-11-15T12:00:00Z'), // 한국 시간 15일 21:00
    live('early', '2026-11-15T10:00:00Z'), // 한국 시간 15일 19:00
    live('midnight', '2026-11-12T15:30:00Z'), // 한국 시간 13일 00:30
    { ...live('on-air', '2026-11-12T04:00:00Z'), status: 'LIVE' },
    live('next-week', '2026-11-19T03:00:00Z'),
  ], now)
  assert.deepEqual(days.map(day => `${day.label}${day.date}`), ['오늘12', '내일13', '토14', '일15', '월16', '화17', '수18'])
  assert.deepEqual(days.map(day => day.lives.map(item => item.id)), [[], ['midnight'], [], ['early', 'late'], [], [], []])
})

test('편성 시각은 한국 시간 오전/오후 표기다', () => {
  assert.equal(formatScheduleTime('2026-11-15T10:00:00Z'), '11. 15(일) 오후 7:00')
  assert.equal(formatScheduleTime('2026-11-15T00:05:00Z'), '11. 15(일) 오전 9:05')
})
