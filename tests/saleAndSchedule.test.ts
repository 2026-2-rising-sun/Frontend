import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { ProductCoupon } from '../src/domain/coupons'
import type { Api } from '../src/domain/ports'
import type { LiveSummary, Product } from '../src/domain/types'
import { isTodayLive, loadLiveSchedule } from '../src/features/live/liveSchedule'
import { bestActiveDiscount, fetchSalePage } from '../src/features/shopping/saleProducts'

const NOW = Date.parse('2026-11-12T03:00:00Z') // 한국 시간 2026-11-12 12:00
const iso = (offsetHours: number) => new Date(NOW + offsetHours * 3600_000).toISOString()
const coupon = (over: Partial<ProductCoupon> = {}): ProductCoupon => ({ couponId: 'c', name: '쿠폰', fixedDiscount: 1000, startsAt: iso(-1), endsAt: iso(24), expiresAt: iso(48), soldOut: false, ...over })
const product = (id: string): Product => ({ id, name: id, description: '', imageUrl: null, price: 10000, stock: 1, status: 'SELLING' })
const live = (id: string, status: LiveSummary['status'], scheduledAt: string): LiveSummary => ({ id, title: id, thumbnailUrl: null, status, scheduledAt, startedAt: status === 'LIVE' ? scheduledAt : null, endedAt: null, hostName: '진행자' })

test('세일 할인액은 발급 중이고 수량이 남은 쿠폰 중 가장 큰 값이다', () => {
  assert.equal(bestActiveDiscount([coupon({ fixedDiscount: 1000 }), coupon({ fixedDiscount: 3000 })], NOW), 3000)
  assert.equal(bestActiveDiscount([coupon({ fixedDiscount: 5000, soldOut: true })], NOW), 0)
  assert.equal(bestActiveDiscount([coupon({ fixedDiscount: 5000, startsAt: iso(1) })], NOW), 0)
  assert.equal(bestActiveDiscount([coupon({ fixedDiscount: 5000, endsAt: iso(-1) })], NOW), 0)
  assert.equal(bestActiveDiscount([], NOW), 0)
})

test('세일 목록은 쿠폰 있는 판매 상품만 고르고 쿠폰 조회 실패 상품은 건너뛴다', async () => {
  const requests: Record<string, unknown>[] = []
  const coupons: Record<string, ProductCoupon[] | Error> = { '1': [coupon()], '2': [], '3': new Error('down'), '4': [coupon({ fixedDiscount: 2000 })] }
  const api = {
    products: { list: async (params: Record<string, unknown>) => { requests.push(params); return params.cursor ? { items: [product('4')], page: 1, size: 20, totalCount: 4, nextCursor: null, hasNext: false } : { items: ['1', '2', '3'].map(product), page: 0, size: 20, totalCount: 4, nextCursor: 'next', hasNext: true } } },
    coupons: { product: async (id: string) => { const value = coupons[id]; if (value instanceof Error) throw value; return value } },
  } as unknown as Api
  const page = await fetchSalePage(api, 'PRICE_ASC', 0, null, NOW)
  assert.deepEqual(page.items.map(item => [item.product.id, item.discount]), [['1', 1000], ['4', 2000]])
  assert.equal(page.hasNext, false)
  assert.equal(page.totalCount, -1)
  assert.deepEqual(requests.map(r => [r.status, r.sort, r.cursor]), [['SELLING', 'PRICE_ASC', null], ['SELLING', 'PRICE_ASC', 'next']])
})

test('라이브 시간표는 진행 중을 먼저, 예정은 시작이 임박한 순서로 모든 페이지를 합친다', async () => {
  const pages: Record<string, LiveSummary[][]> = {
    LIVE: [[live('on-air', 'LIVE', iso(-1))]],
    READY: [[live('later', 'READY', iso(30)), live('soon', 'READY', iso(2))], [live('soonest', 'READY', iso(1))]],
  }
  const api = { lives: { list: async ({ status, page }: { status: string; page: number }) => ({ items: pages[status][page], page, size: 50, totalCount: 3, hasNext: page + 1 < pages[status].length }) } } as unknown as Api
  const schedule = await loadLiveSchedule(api)
  assert.deepEqual(schedule.items.map(item => item.id), ['on-air', 'soonest', 'soon', 'later'])
  assert.equal(schedule.incomplete, false)
})

test('라이브 시간표는 한쪽 목록 실패를 표시하고 나머지는 유지한다', async () => {
  const api = { lives: { list: async ({ status }: { status: string }) => { if (status === 'LIVE') throw new Error('down'); return { items: [live('soon', 'READY', iso(1))], page: 0, size: 50, totalCount: 1, hasNext: false } } } } as unknown as Api
  const schedule = await loadLiveSchedule(api)
  assert.deepEqual(schedule.items.map(item => item.id), ['soon'])
  assert.equal(schedule.incomplete, true)
})

test('오특은 진행 중이거나 한국 시간 오늘 시작하는 방송만 고른다', () => {
  const now = new Date(NOW)
  assert.equal(isTodayLive(live('a', 'LIVE', iso(-30)), now), true)
  assert.equal(isTodayLive(live('b', 'READY', iso(11)), now), true) // 오늘 23:00
  assert.equal(isTodayLive(live('c', 'READY', iso(13)), now), false) // 내일 01:00
  assert.equal(isTodayLive(live('d', 'ENDED', iso(-1)), now), false)
})
