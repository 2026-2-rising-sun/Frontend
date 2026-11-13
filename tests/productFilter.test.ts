import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { priceLabel, readFilter, writeFilter } from '../src/features/shopping/productFilter'

test('정렬과 필터는 주소에 담기고, 기본값은 주소에서 빠진다', () => {
  assert.deepEqual(readFilter(new URLSearchParams('')), { sort: 'RANKING', freeShipping: false, minPrice: undefined, maxPrice: undefined })
  assert.deepEqual(readFilter(new URLSearchParams('sort=SALES&free=1&min=10000&max=20000')), { sort: 'SALES', freeShipping: true, minPrice: 10000, maxPrice: 20000 })
  assert.equal(readFilter(new URLSearchParams('sort=WRONG&min=-5')).sort, 'RANKING')
  assert.equal(readFilter(new URLSearchParams('min=-5')).minPrice, undefined)
  const written = writeFilter(new URLSearchParams('q=니트&sort=SALES'), { sort: 'RANKING', freeShipping: true, minPrice: 80000 })
  assert.equal(written.toString(), 'q=%EB%8B%88%ED%8A%B8&free=1&min=80000')
})

test('가격 칩 이름은 미리 정한 범위면 그 이름, 아니면 입력한 금액이다', () => {
  assert.equal(priceLabel({ minPrice: 10000, maxPrice: 20000 }), '1만원 ~ 2만원')
  assert.equal(priceLabel({ maxPrice: 10000 }), '1만원 이하')
  assert.equal(priceLabel({ minPrice: 12000, maxPrice: 35000 }), '12,000원 ~ 35,000원')
  assert.equal(priceLabel({ minPrice: 5000 }), '5,000원 이상')
  assert.equal(priceLabel({}), null)
})
