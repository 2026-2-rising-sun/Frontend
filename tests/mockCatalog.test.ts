import { strict as assert } from 'node:assert'
import type { IncomingMessage } from 'node:http'
import { test } from 'node:test'
import { catalogMock, mockProducts } from '../scripts/mockCatalog'
import { levelPercent, reviewCount, satisfiedPercent } from '../src/features/shopping/satisfaction'

const GET = { method: 'GET' } as IncomingMessage
const ask = (path: string) => catalogMock()(new URL(path, 'http://127.0.0.1'), GET)

test('모의 상품은 카테고리마다 15개 이상이고, 할인 상품은 원가가 베리특가보다 비싸다', () => {
  const products = mockProducts()
  for (const category of ['FOOD', 'LIVING', 'DIGITAL', 'BEAUTY', 'FASHION']) {
    assert.ok(products.filter(product => product.category === category).length >= 15, category)
  }
  for (const product of products) {
    if (product.originalPrice !== null) assert.ok(product.originalPrice > product.price, product.name)
    assert.equal(product.salesStatus === 'SOLD_OUT', product.available === 0)
  }
  assert.ok(products.some(product => product.freeShipping) && products.some(product => !product.freeShipping))
  // 옷은 컬러와 사이즈, 프라이팬은 사이즈와 구성처럼 상품 특성에 맞는 옵션이 붙는다. 품절 아닌 값이 묶음마다 하나 이상 있다.
  const coat = products.find(product => product.name.startsWith('울 블렌디드'))!
  assert.deepEqual(coat.options.map(group => group.name), ['컬러', '사이즈'])
  const pan = products.find(product => product.name.startsWith('인덕션 통주물 프라이팬'))!
  assert.deepEqual(pan.options.map(group => group.name), ['사이즈', '구성'])
  assert.ok(pan.options[1].values.some(value => value.label === '2개 세트' && value.extraPrice > 0))
  for (const product of products) {
    for (const group of product.options) assert.ok(group.values.some(value => !value.soldOut), `${product.name} ${group.name}`)
    for (const value of product.options.flatMap(group => group.values)) assert.ok(product.price + value.extraPrice > 0)
  }
  assert.deepEqual(mockProducts().map(product => product.name), products.map(product => product.name))
})

test('모의 상품 목록은 카테고리, 검색, 정렬, 커서를 지킨다', () => {
  const page = ask('/v1/products?category=FOOD&sort=PRICE_ASC&size=5')?.body as { items: { category: string; price: number }[]; nextCursor: string; hasNext: boolean }
  assert.equal(page.items.length, 5)
  assert.ok(page.items.every(item => item.category === 'FOOD'))
  assert.deepEqual(page.items.map(item => item.price), page.items.map(item => item.price).toSorted((a, b) => a - b))
  assert.equal(page.hasNext, true)
  const next = ask(`/v1/products?category=FOOD&sort=PRICE_ASC&size=5&cursor=${page.nextCursor}`)?.body as { items: { price: number }[] }
  assert.ok(next.items[0].price >= page.items.at(-1)!.price)
  const found = ask('/v1/products?q=' + encodeURIComponent('삼겹살'))?.body as { items: { name: string }[] }
  assert.ok(found.items.length > 0 && found.items.every(item => item.name.includes('삼겹살')))
  assert.equal(ask('/v1/mock-images/1.svg')?.type, 'image/svg+xml')
  assert.equal(ask('/v1/products/1/coupons'), undefined) // 쿠폰은 Prism 이 답한다
})

test('만족 비율은 매우 만족해요와 만족해요를 합친 비율이다', () => {
  const s = { veryGood: 66, good: 10, bad: 14, veryBad: 10 }
  assert.equal(reviewCount(s), 100)
  assert.equal(satisfiedPercent(s), 76)
  assert.equal(levelPercent(s, 'bad'), 14)
  assert.equal(satisfiedPercent({ veryGood: 0, good: 0, bad: 0, veryBad: 0 }), null)
  assert.equal(satisfiedPercent(null), null)
})

test('모의 상품 목록은 무료배송, 가격 범위, 판매량순과 리뷰 많은순 정렬을 지킨다', () => {
  type Item = { price: number; freeShipping: boolean; salesCount: number; satisfaction: Record<string, number> }
  const items = (path: string) => (ask(path)!.body as { items: Item[] }).items
  const free = items('/v1/products?freeShipping=true&size=50')
  assert.ok(free.length > 0 && free.every(item => item.freeShipping))
  const ranged = items('/v1/products?minPrice=10000&maxPrice=20000&size=50')
  assert.ok(ranged.length > 0 && ranged.every(item => item.price >= 10000 && item.price <= 20000))
  const sales = items('/v1/products?sort=SALES&size=50').map(item => item.salesCount)
  assert.deepEqual(sales, sales.toSorted((a, b) => b - a))
  const reviews = items('/v1/products?sort=REVIEWS&size=50').map(item => Object.values(item.satisfaction).reduce((a, b) => a + b, 0))
  assert.deepEqual(reviews, reviews.toSorted((a, b) => b - a))
})
