import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { Product } from '../src/domain/types'
import { byViewing } from '../src/features/home/viewingRanking'

const product = (id: string, viewingCount: number | null): Product => ({ id, name: id, description: '', imageUrl: null, price: 1000, stock: 1, status: 'SELLING', viewingCount })

test('조회 급상승은 보고 있는 사람이 많은 순서로 10개까지 고르고, 보는 사람이 없는 상품은 뺀다', () => {
  const items = [product('a', 30), product('b', null), product('c', 900), product('d', 0), product('e', 300)]
  assert.deepEqual(byViewing(items).map(p => p.id), ['c', 'e', 'a'])
  const many = Array.from({ length: 14 }, (_, i) => product(String(i), i + 1))
  assert.equal(byViewing(many).length, 10)
  assert.equal(byViewing(many)[0].id, '13')
})
