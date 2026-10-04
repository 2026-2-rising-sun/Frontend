import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createSellerProducts } from '../src/api/http/sellerProducts'
import type { HttpClient } from '../src/api/http/client'

test('seller basic information uses separate image upload, JSON create, then authenticated detail contract', async () => {
  const calls: { path: string; options: unknown }[] = []
  const request = (async (path: string, options: unknown) => {
    calls.push({ path, options })
    if (path.endsWith('product-images')) return { imageId: 9 }
    if (path.endsWith('/products')) return { productId: 42 }
    return { productId: 42, name: '상품', description: '설명', mainImageUrl: '/image', version: 0, salesStatus: 'NOT_REGISTERED', price: null, available: null }
  }) as HttpClient
  const products = createSellerProducts(request)
  const image = new File(['image'], 'image.png', { type: 'image/png' })
  const product = await products.create({ name: '상품', description: '설명', image })
  assert.equal(product.id, '42'); assert.equal(product.status, 'DRAFT')
  assert.equal(calls[0].path, '/shopping/admin/product-images')
  assert.ok((calls[0].options as { body: unknown }).body instanceof FormData)
  assert.deepEqual(calls[1].options, { method: 'POST', body: { name: '상품', description: '설명', mainImageId: 9 } })
  assert.equal(calls[2].path, '/shopping/admin/products/42')
  await assert.rejects(products.create({ name: '상품', description: '설명' }), { code: 'VALIDATION' })
})

test('UNKNOWN is an upstream failure, not an unregistered product', async () => {
  const products = createSellerProducts((async () => ({ salesStatus: 'UNKNOWN' })) as HttpClient)
  await assert.rejects(products.get('42'), { code: 'NETWORK' })
})
