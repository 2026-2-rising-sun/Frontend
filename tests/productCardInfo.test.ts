import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mockProducts, readContent } from '../scripts/mockCatalog'
import { CARD_VARIANTS, dealRemaining, discountRate, randomCardVariant, unitPriceLabel } from '../src/features/shopping/productCardInfo'

const at = (iso: string) => Date.parse(iso)

test('할인율은 할인 전 가격이 더 클 때만 반올림해 구한다', () => {
  assert.equal(discountRate(27600, 11900), 57)
  assert.equal(discountRate(null, 11900), null)
  assert.equal(discountRate(11900, 11900), null)
})

test('라이브 할인 남은 시간은 하루 안이면 시간이나 분, 그보다 길면 끝나는 시각으로 보인다', () => {
  const deal = { endsAt: '2026-11-16T14:59:00Z' }
  assert.equal(dealRemaining(deal, at('2026-11-16T11:30:00Z')), '3시간 남음')
  assert.equal(dealRemaining(deal, at('2026-11-16T14:20:00Z')), '39분 남음')
  assert.equal(dealRemaining(deal, at('2026-11-13T00:00:00Z')), '11/16 23:59까지')
  assert.equal(dealRemaining(deal, at('2026-11-17T00:00:00Z')), null)
})

test('단위가격은 g, ml 은 100 단위, 개는 1개 단위로 나눈다', () => {
  assert.equal(unitPriceLabel({ amount: 700, unit: 'g' }, 5300), '(100g당 757원)')
  assert.equal(unitPriceLabel({ amount: 2000, unit: 'ml' }, 17400), '(100ml당 870원)')
  assert.equal(unitPriceLabel({ amount: 5, unit: '개' }, 25000), '(1개당 5,000원)')
  assert.equal(unitPriceLabel({ amount: 1, unit: '개' }, 25000), null)
  assert.equal(unitPriceLabel(null, 25000), null)
})

test('모의 상품은 이름에서 총 내용량과 묶음 수를 읽는다', () => {
  assert.deepEqual(readContent('바른 도가니탕 500g X 4팩'), { netContent: { amount: 2000, unit: 'g' }, packCount: 4 })
  assert.deepEqual(readContent('콜드브루 원액 1L 1+1'), { netContent: { amount: 2000, unit: 'ml' }, packCount: 2 })
  assert.deepEqual(readContent('호텔 수건 5장'), { netContent: { amount: 5, unit: '개' }, packCount: 5 })
  assert.deepEqual(readContent('세척되는 크레파스 24색'), { netContent: null, packCount: null })
  assert.deepEqual(readContent('고속 충전 보조배터리 20000mAh'), { netContent: null, packCount: null })
})

test('모의 상품마다 카드 종류별 표시값이 있고, 빠른 배송은 식품이 새벽도착, 나머지가 오늘출발이다', () => {
  const products = mockProducts()
  assert.ok(products.every(p => p.category === 'FOOD' ? p.deliveryType !== 'TODAY' : p.deliveryType !== 'DAWN'))
  assert.ok(products.some(p => p.deliveryType === 'DAWN') && products.some(p => p.deliveryType === 'TODAY'))
  assert.ok(products.some(p => p.freeReturn) && products.some(p => !p.freeReturn))
  assert.ok(products.filter(p => p.category === 'FOOD' && p.netContent).length >= 5)
})

test('카드 종류는 상품 번호로 섞어 고르고, 같은 상품은 늘 같은 카드다', () => {
  const ids = mockProducts().map(p => String(p.productId))
  assert.deepEqual(ids.map(randomCardVariant), ids.map(randomCardVariant))
  const counts = CARD_VARIANTS.map(variant => ids.filter(id => randomCardVariant(id) === variant).length)
  assert.ok(counts.every(n => n >= ids.length / 8), `카드 종류가 한쪽으로 몰렸다: ${counts}`)
})
