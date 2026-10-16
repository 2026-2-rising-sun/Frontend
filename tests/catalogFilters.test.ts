import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createHttpApi } from '../src/api/http'
import { createSellerProducts } from '../src/api/http/sellerProducts'
import type { HttpClient } from '../src/api/http/client'

Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
const envelope = (data: unknown) => new Response(JSON.stringify({ success: true, data, error: null }))

test('상품 검색·상태·가격 정렬과 다음 커서를 서버에 함께 전달한다', async () => {
  const urls: URL[] = []
  globalThis.fetch = async url => { urls.push(new URL(String(url))); return envelope({ items: [], nextCursor: 'next', hasNext: true }) }
  const api = createHttpApi('/api')
  await api.products.list({ query: '100% 니트', status: 'SELLING', sort: 'PRICE_ASC', cursor: 'previous', size: 12 })
  assert.equal(urls[0].searchParams.get('q'), '100% 니트')
  assert.equal(urls[0].searchParams.get('status'), 'ON_SALE')
  assert.equal(urls[0].searchParams.get('sort'), 'PRICE_ASC')
  assert.equal(urls[0].searchParams.get('cursor'), 'previous')
  await api.products.list({ status: 'ALL', sort: 'LATEST' })
  assert.equal(urls[1].searchParams.has('status'), false)
})

test('공개 방송의 예정 상태를 서버 전체 페이지 필터로 전달한다', async () => {
  let requested: URL | undefined
  globalThis.fetch = async url => { requested = new URL(String(url)); return envelope({ content: [], number: 2, size: 6, totalElements: 0, totalPages: 0 }) }
  await createHttpApi('/api').lives.list({ status: 'READY', page: 2, size: 6 })
  assert.equal(requested?.searchParams.get('status'), 'PREPARING')
  assert.equal(requested?.searchParams.get('page'), '2')
})

test('판매자 상품 상태를 서버로 전달하고 서버 총건수와 결과를 보존한다', async () => {
  const requests: unknown[] = []
  const products = createSellerProducts((async (_path, options) => {
    requests.push(options)
    return { items: [{ productId: 42, name: '상품', salesStatus: 'SOLD_OUT', price: 100, available: 0 }], page: 1, size: 2, totalElements: 5, totalPages: 3 }
  }) as HttpClient)
  const result = await products.list({ status: 'SOLD_OUT', page: 1, size: 2 })
  assert.deepEqual(requests[0], { query: { page: 1, size: 2, status: 'SOLD_OUT' } })
  assert.equal(result.totalCount, 5)
  assert.equal(result.items.length, 1)
  assert.equal(result.hasNext, true)
})
