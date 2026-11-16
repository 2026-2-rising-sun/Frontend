import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createHttpApi } from '../src/api/http'
import { couponDropState, type CouponDrop } from '../src/domain/couponDrops'
import { exhibitionState } from '../src/domain/exhibitions'
import { couponDrops } from '../scripts/mockPromotions'
Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
const envelope = (data: unknown) => new Response(JSON.stringify({ success: true, data, error: null }))

const drop = (remaining: number): CouponDrop => ({ couponId: '1', name: '쿠폰', fixedDiscount: 3000, opensAt: '2026-11-16T01:00:00Z', endsAt: '2026-11-16T14:59:00Z', issuanceLimit: 100, remaining })

test('선착순 쿠폰은 오픈 전, 진행 중, 수량 소진, 받기 마감으로 나뉜다', () => {
  assert.equal(couponDropState(drop(100), Date.parse('2026-11-16T00:59:59Z')), 'UPCOMING')
  assert.equal(couponDropState(drop(37), Date.parse('2026-11-16T01:00:00Z')), 'OPEN')
  assert.equal(couponDropState(drop(0), Date.parse('2026-11-16T05:00:00Z')), 'SOLD_OUT')
  assert.equal(couponDropState(drop(37), Date.parse('2026-11-16T14:59:00Z')), 'CLOSED')
})

test('기획전은 시작 전, 진행 중, 종료로 나뉜다', () => {
  const exhibition = { startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-30T14:59:00Z' }
  assert.equal(exhibitionState(exhibition as never, Date.parse('2026-10-31T23:59:59Z')), 'UPCOMING')
  assert.equal(exhibitionState(exhibition as never, Date.parse('2026-11-16T00:00:00Z')), 'ACTIVE')
  assert.equal(exhibitionState(exhibition as never, Date.parse('2026-11-30T14:59:00Z')), 'ENDED')
})

test('선착순 쿠폰 목록은 로그인 없이 commercecore 에서, 오픈 알림은 notification 에서 받는다', async () => {
  const calls: { url: URL; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: new URL(String(url)), options })
    if (String(url).includes('coupon-drops')) return envelope([{ ...drop(37), couponId: 9001 }])
    return options?.method === 'POST' ? new Response(null, { status: 204 }) : envelope({ subscribed: true })
  }
  const api = createHttpApi('/api')
  const [item] = await api.couponDrops.today()
  assert.equal(item.couponId, '9001')
  assert.equal(calls[0].url.pathname, '/api/commercecore/v1/coupon-drops/today')
  assert.equal(new Headers(calls[0].options?.headers).has('Authorization'), false)
  assert.equal(await api.couponDrops.alertState(), true)
  await api.couponDrops.setAlert(true)
  assert.equal(calls[2].url.pathname, '/api/notification/v1/coupon-drop-alerts')
  assert.equal(calls[2].options?.method, 'POST')
})

test('기획전은 카탈로그에서 받고, 모르는 배너 색은 기본색으로, 묶음 상품은 상품 모양으로 바꾼다', async () => {
  const urls: URL[] = []
  globalThis.fetch = async url => {
    urls.push(new URL(String(url)))
    const summary = { id: 7, title: '겨울 보습 기획전', headline: ['겨울', '보습'], description: '설명', art: ['🧴'], tone: 'neon', category: 'skincare', startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-30T14:59:00Z' }
    return envelope(urls.length === 1 ? [summary] : { ...summary, sections: [{ title: '스킨케어', products: [{ productId: 3, name: '수분 크림', mainImageUrl: null, price: 10000, salesStatus: 'ON_SALE' }] }] })
  }
  const api = createHttpApi('/api')
  const [summary] = await api.exhibitions.list()
  assert.equal(summary.id, '7'); assert.equal(summary.tone, 'lavender'); assert.equal(summary.category, 'skincare'); assert.deepEqual(summary.previewProducts, []) // 대표 상품이 없으면 빈 목록
  const exhibition = await api.exhibitions.get('7')
  assert.equal(exhibition.sections[0].products[0].id, '3'); assert.equal(exhibition.sections[0].products[0].status, 'SELLING')
  assert.deepEqual(urls.map(url => url.pathname), ['/api/catalog/v1/exhibitions', '/api/catalog/v1/exhibitions/7'])
})

test('로컬 모의 선착순 쿠폰은 오픈 전, 진행 중, 마감을 함께 보여 준다', () => {
  const now = Date.parse('2026-11-16T06:30:00Z') // 15:30(한국 시간)
  const states = couponDrops(now).map(item => couponDropState({ ...item, couponId: String(item.couponId) }, now))
  assert.deepEqual(states, ['UPCOMING', 'OPEN', 'SOLD_OUT'])
  assert.equal(couponDrops(now)[0].opensAt, '2026-11-16T07:00:00.000Z') // 다음 정각 16시
})
