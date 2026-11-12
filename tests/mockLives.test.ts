import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { seeded, weeklyMockLives } from '../scripts/mockLives'

const KST_DAY = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10)

test('모의 편성은 어떤 시각이든 오늘부터 7일 안에 3일 이상, 지금 이후의 예정 방송이다', () => {
  for (let i = 0; i < 300; i++) {
    const now = new Date(Date.parse('2026-11-01T00:00:00Z') + i * 97 * 60_000) // 97분 간격으로 하루 중 여러 시각
    const lives = weeklyMockLives(now, seeded(i))
    const days = new Set(lives.map(live => KST_DAY(live.scheduledAt)))
    assert.ok(days.size >= 3 && days.size <= 5, `${now.toISOString()} 방송 날짜 ${days.size}일`)
    for (const live of lives) {
      assert.ok(Date.parse(live.scheduledAt) > now.getTime())
      assert.ok(Date.parse(live.scheduledAt) < now.getTime() + 7 * 86_400_000)
      assert.equal(live.status, 'PREPARING')
    }
  }
})

test('같은 시각에는 같은 편성을 돌려준다', () => {
  assert.deepEqual(weeklyMockLives(new Date('2026-11-13T01:00:00Z')), weeklyMockLives(new Date('2026-11-13T01:00:00Z')))
})
