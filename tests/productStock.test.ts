import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { product as mapProduct, type ProductDto } from '../src/api/http/mappers'
import { createHttpApi } from '../src/api/http'

Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
const envelope = (data: unknown) => new Response(JSON.stringify({ success: true, data, error: null }))

const product: ProductDto = { productId: 1, name: '상품', mainImageUrl: null, price: 10000, salesStatus: 'ON_SALE' }

test('실제 주문 가능 수량과 0을 보존하고 수량 미제공은 null로 구분한다', () => {
  for (const available of [0, 1, 1234, 2147483647]) {
    assert.equal(mapProduct({ ...product, available }).stock, available)
  }
  assert.equal(mapProduct(product).stock, null)
  assert.equal(mapProduct({ ...product, available: null }).stock, null)
  assert.equal(mapProduct({ ...product, salesStatus: 'SOLD_OUT' }).stock, null)
  assert.equal(mapProduct({ ...product, available: 0 }).status, 'SELLING')
})

test('일반 목록과 방송 상품은 전달된 수량을 사용하며 상품별 추가 조회를 하지 않는다', async () => {
  const items = [product, { ...product, productId: 2, available: 0, salesStatus: 'SOLD_OUT' }, { ...product, productId: 3, available: 7 }]
  const calls: string[] = []
  globalThis.fetch = async url => {
    const path = new URL(String(url)).pathname.replace(/^\/api/, '')
    calls.push(path)
    return envelope(path === '/shopping/v1/products' ? { items, nextCursor: null, hasNext: false } : items)
  }
  const api = createHttpApi('/api')
  const general = await api.products.list()
  const linked = await api.lives.listProducts('11')
  assert.deepEqual(general.items.map(p => p.stock), [null, 0, 7])
  assert.deepEqual(linked.map(p => p.stock), [null, 0, 7])
  assert.deepEqual(calls, ['/shopping/v1/products', '/live/v1/broadcasts/11/products'])
})

test('목록 조회 실패와 판매정보 UNKNOWN을 재고 0이나 빈 성공 응답으로 바꾸지 않는다', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, data: null, error: { code: 'SALES_INFO_UNAVAILABLE', message: '판매정보 조회 실패' } }), { status: 503 })
  const api = createHttpApi('/api')
  await assert.rejects(api.products.list(), /판매정보 조회 실패/)
  await assert.rejects(api.lives.listProducts('11'), /판매정보 조회 실패/)
  assert.throws(() => mapProduct({ ...product, salesStatus: 'UNKNOWN' }), /상품 판매 정보를 확인하지 못했어요/)
})
