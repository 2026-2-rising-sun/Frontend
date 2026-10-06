import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createHttpApi } from '../src/api/http'
import { createSellerProducts } from '../src/api/http/sellerProducts'
import type { HttpClient } from '../src/api/http/client'
Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
const envelope = (data: unknown) => new Response(JSON.stringify({ success: true, data, error: null }))
test('public cursor can advance past a page containing only private products; public reads omit credentials', async () => {
  const urls: URL[] = []
  globalThis.fetch = async (url, options) => {
    urls.push(new URL(String(url))); assert.equal(new Headers(options?.headers).has('Authorization'), false)
    return envelope({ items: [], nextCursor: 24, hasNext: true })
  }
  const api = createHttpApi('/api')
  const first = await api.products.list({ size: 12 }); assert.equal(first.hasNext, true); assert.equal(first.nextCursor, '24'); assert.equal(first.items.length, 0)
  await api.products.list({ cursor: first.nextCursor, page: 1, size: 12 }); assert.equal(urls[1].searchParams.get('cursor'), '24'); assert.equal(urls[1].searchParams.has('page'), false)
})
test('member order uses total amount and a stable idempotency header; no guest password or payment scenario', async () => {
  const calls: { url: string; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    if (String(url).endsWith('/payments')) return new Response(JSON.stringify({ paymentId: 9, status: 'PENDING' }))
    return new Response(JSON.stringify({ orderNumber: 'ORD-1', status: 'PENDING_PAYMENT', productName: '상품', quantity: 2, unitPrice: 3000, totalAmount: 6000, buyerName: '회원', createdAt: '2026-10-06T00:00:00Z', expiresAt: null }))
  }
  const api = createHttpApi('/api')
  assert.equal((await api.orders.create({ productId: '3', quantity: 2, expectedUnitPrice: 3000, ordererName: '회원', ordererPhone: '01012345678', idempotencyKey: 'order-one' })).status, 'UNPAID')
  assert.deepEqual(JSON.parse(String(calls[0].options?.body)), { productId: 3, quantity: 2, buyerName: '회원', buyerPhone: '01012345678', expectedTotalAmount: 6000 })
  assert.equal(new Headers(calls[0].options?.headers).get('X-Idempotency-Key'), 'order-one')
  await api.payments.start('ORD-1'); assert.deepEqual(JSON.parse(String(calls[1].options?.body)), {})
})
test('Live administration uses link ID and snapshot version without substituting a product ID', async () => {
  const calls: { url: URL; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: new URL(String(url)), options })
    if (String(url).endsWith('/products')) return envelope([])
    return envelope({ id: 1, title: '방송', status: 'PREPARING', scheduledAt: '2026-10-06T00:00:00Z', playbackUrl: 'https://example.com/live.m3u8', channelArn: 'channel', version: 8 })
  }
  const api = createHttpApi('/api')
  await api.admin.lives.reorderProducts('1', ['101', '102'], 7)
  assert.equal(calls[0].options?.method, 'PUT'); assert.deepEqual(JSON.parse(String(calls[0].options?.body)), { linkIds: [101, 102], expectedVersion: 7 })
  await api.admin.lives.unlinkProduct('1', '102', 8)
  assert.ok(calls[3].url.pathname.endsWith('/products/102')); assert.equal(calls[3].url.searchParams.get('expectedVersion'), '8')
  await api.admin.lives.start('1', 8)
  assert.equal(calls[6].url.searchParams.get('expectedVersion'), '8')
  await api.admin.lives.end('1')
  assert.equal(calls[9].url.search, '')
  await api.admin.lives.update('1', { title: '수정', channelArn: 'channel', scheduledAt: '2026-10-06T00:00:00Z', playbackUrl: 'https://example.com/live.m3u8', version: 10 })
  assert.equal(calls[12].url.searchParams.get('version'), '10'); assert.equal(JSON.parse(String(calls[12].options?.body)).version, undefined)
})
test('retry after an uncertain product create reuses its uploaded image ID and idempotency payload', async () => {
  let uploads = 0; const bodies: unknown[] = []; let creates = 0
  const request = (async (path: string, options?: { body?: unknown }) => {
    if (path.endsWith('product-images')) return { imageId: ++uploads }
    if (path.endsWith('/products')) { bodies.push(options?.body); if (++creates === 1) throw new Error('connection lost after commit'); return { productId: 3 } }
    return { productId: 3, name: '상품', mainImageUrl: '/image', version: 0, salesStatus: 'NOT_REGISTERED', price: null, available: null }
  }) as HttpClient
  const api = createSellerProducts(request); const input = { name: '상품', description: '설명', image: new File(['png'], 'image.png'), idempotencyKey: 'same-key' }
  await assert.rejects(api.create(input)); await api.create(input); assert.equal(uploads, 1); assert.deepEqual(bodies[0], bodies[1])
})
