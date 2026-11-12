import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { Api } from '../src/domain/ports'
import type { Product, ProductListParams } from '../src/domain/types'
import { loadRecentAndRelated, readRecentIds, recordRecentProduct } from '../src/features/shopping/recentProducts'

const memory = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [['berryon:recent-products', initial]])
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}
const product = (id: string, over: Partial<Product> = {}): Product => ({ id, name: id, description: '', imageUrl: null, price: 1000, stock: 1, status: 'SELLING', category: null, ...over })

test('최근 본 상품은 같은 상품을 맨 앞으로 옮기고 20개까지만 남긴다', () => {
  const storage = memory()
  for (let i = 1; i <= 22; i++) recordRecentProduct(String(i), storage)
  recordRecentProduct('5', storage)
  const ids = readRecentIds(storage)
  assert.equal(ids.length, 20)
  assert.deepEqual(ids.slice(0, 3), ['5', '22', '21'])
  assert.equal(ids.filter(id => id === '5').length, 1)
})

test('저장값이 깨졌거나 저장소가 없으면 빈 목록으로 본다', () => {
  assert.deepEqual(readRecentIds(memory('{broken')), [])
  assert.deepEqual(readRecentIds(memory('{"a":1}')), [])
  assert.deepEqual(readRecentIds(undefined), [])
})

test('연관 추천은 최근 본 상품의 카테고리에서 고르고 최근 본 상품과 숨김 상품은 뺀다', async () => {
  const requests: ProductListParams[] = []
  const api = {
    products: {
      get: async (id: string) => {
        if (id === 'gone') throw new Error('not found')
        return product(id, { category: id === 'a' ? 'BEAUTY' : 'FOOD', status: id === 'hidden' ? 'HIDDEN' : 'SELLING' })
      },
      list: async (params: ProductListParams) => {
        requests.push(params)
        const items = params.category === 'BEAUTY' ? [product('a'), product('b1'), product('x', { missing: true })] : [product('f1'), product('b1')]
        return { items, page: 0, size: 12, totalCount: items.length, hasNext: false }
      },
    },
  } as unknown as Api
  const result = await loadRecentAndRelated(api, ['a', 'gone', 'c', 'hidden'])
  assert.deepEqual(result.recent.map(p => p.id), ['a', 'c'])
  assert.deepEqual(result.related.map(p => p.id), ['b1', 'f1'])
  assert.deepEqual(requests.map(r => [r.status, r.category]), [['SELLING', 'BEAUTY'], ['SELLING', 'FOOD']])
})

test('최근 본 상품이 없으면 판매 중인 최신 상품으로 채운다', async () => {
  const requests: ProductListParams[] = []
  const api = { products: { get: async () => { throw new Error('unused') }, list: async (params: ProductListParams) => { requests.push(params); return { items: [product('n1')], page: 0, size: 12, totalCount: 1, hasNext: false } } } } as unknown as Api
  const result = await loadRecentAndRelated(api, [])
  assert.deepEqual(result, { recent: [], related: [product('n1')] })
  assert.deepEqual(requests, [{ status: 'SELLING', sort: 'LATEST', size: 12 }])
})
