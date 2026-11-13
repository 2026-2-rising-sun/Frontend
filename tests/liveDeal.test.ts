import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { liveDeals } from '../scripts/mockLives'
import { activeDeal, dealPeriod, displayPrice } from '../src/features/shopping/liveDeal'

const deal = { broadcastId: '12', broadcastTitle: '겨울 특가 라이브', discount: 3000, startsAt: '2026-11-03T08:00:00Z', endsAt: '2026-11-16T14:59:00Z' }
const at = (iso: string) => Date.parse(iso)

test('베리특가는 라이브 할인 기간 안에서만 붙고, 할인 전 가격에 줄을 긋는다', () => {
  const product = { price: 11900, originalPrice: 27600, liveDeal: deal }
  assert.deepEqual(displayPrice(product, at('2026-11-10T00:00:00Z')), { deal, before: 27600, price: 8900 })
  assert.deepEqual(displayPrice(product, at('2026-11-17T00:00:00Z')), { deal: null, before: 27600, price: 11900 })
  assert.deepEqual(displayPrice({ price: 11900, liveDeal: deal }, at('2026-11-10T00:00:00Z')).before, 11900)
  assert.equal(activeDeal({ liveDeal: deal }, at('2026-11-03T08:00:00Z')), deal) // 시작 시각 포함
  assert.equal(activeDeal({ liveDeal: deal }, at('2026-11-16T14:59:00Z')), deal) // 끝 시각 포함
  assert.equal(activeDeal({ liveDeal: null }), null)
  assert.equal(dealPeriod(deal), '11/3 17:00 ~ 11/16 23:59 까지 한정할인')
})

test('모의 라이브 할인은 방송 전후 기간 안에서만 걸린다', () => {
  for (let h = 0; h < 7 * 24; h += 11) {
    const now = new Date(Date.parse('2026-11-01T00:00:00Z') + h * 3600_000)
    for (const item of liveDeals(now).values()) {
      assert.ok(Date.parse(item.startsAt) <= now.getTime() && now.getTime() <= Date.parse(item.endsAt))
      assert.ok(item.discount > 0)
    }
  }
})
