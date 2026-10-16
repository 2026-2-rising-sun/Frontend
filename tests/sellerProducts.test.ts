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
  const product = await products.create({ name: '상품', description: '설명', image, idempotencyKey: 'create-key' })
  assert.equal(product.id, '42'); assert.equal(product.status, 'DRAFT')
  assert.equal(calls[0].path, '/shopping/v1/seller/product-images')
  assert.ok((calls[0].options as { body: unknown }).body instanceof FormData)
  assert.deepEqual(calls[1].options, { method: 'POST', headers: { 'X-Idempotency-Key': 'create-key' }, body: { name: '상품', description: '설명', mainImageId: 9 } })
  assert.equal(calls[2].path, '/shopping/v1/seller/products/42')
  await assert.rejects(products.create({ name: '상품', description: '설명', idempotencyKey: 'empty-image' }), { code: 'VALIDATION' })
})

test('판매정보 조회 실패 시 기본정보를 보존하고 미등록 상태와 구분한다', async () => {
  const products = createSellerProducts((async () => ({ productId: 42, name: '기존 상품', mainImageUrl: null, version: 3, salesStatus: 'UNKNOWN', price: null, available: null })) as HttpClient)
  const product = await products.get('42')
  assert.equal(product.status, 'UNKNOWN')
  assert.equal(product.name, '기존 상품')
  assert.equal(product.version, 3)
  assert.equal(product.price, null)
})

const existingProduct = {
  productId: 42, name: '기존 상품', description: '설명', mainImageUrl: '/image',
  version: 3, salesStatus: 'READY', price: 15000, available: 5,
}
const saleCheckout = {
  productId: 42, salesId: 81, unitPrice: 17000, available: 7, salesStatus: 'READY',
  orderable: false, reason: 'NOT_ON_SALE', salesInfoId: 81, reserved: 2,
}

test('새 브라우저와 스토리지 사용 불가 환경에서도 기존 판매 준비·비공개 상품을 조회한다', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get: () => { throw new Error('storage blocked') } })
  try {
    for (const [salesStatus, status] of [['READY', 'READY'], ['PRIVATE', 'HIDDEN']]) {
      const calls: string[] = []
      const products = createSellerProducts((async (path: string, options: unknown) => {
        calls.push(path)
        if (path.includes('/seller/products/')) return { ...existingProduct, salesStatus }
        if (path.endsWith('/stock')) return saleCheckout
        assert.equal(path, '/commerce/v1/orders/checkout')
        assert.deepEqual(options, { query: { productId: '42', quantity: 1 } })
        return { ...saleCheckout, salesStatus }
      }) as HttpClient)
      const product = await products.get('42')
      assert.deepEqual(calls, ['/shopping/v1/seller/products/42', '/commerce/v1/orders/checkout', '/commerce/v1/sales/81/stock'])
      assert.equal(product.salesId, '81')
      assert.equal(product.status, status)
      assert.equal(product.price, 17000)
      assert.equal(product.stock, 7)
      assert.equal(product.name, '기존 상품')
      assert.equal(product.version, 3)
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous)
    else Reflect.deleteProperty(globalThis, 'sessionStorage')
  }
})

test('판매자 본인 상품 조회가 끝나기 전에는 판매정보를 조회하지 않는다', async () => {
  let resolveOwner!: (value: typeof existingProduct) => void
  const owner = new Promise<typeof existingProduct>((resolve) => { resolveOwner = resolve })
  const calls: string[] = []
  const products = createSellerProducts((async (path: string) => {
    calls.push(path)
    return path.includes('/seller/products/') ? owner : saleCheckout
  }) as HttpClient)
  const result = products.get('42')
  await Promise.resolve()
  assert.deepEqual(calls, ['/shopping/v1/seller/products/42'])
  resolveOwner(existingProduct)
  assert.equal((await result).salesId, '81')
})

test('본인 상품 조회 실패 시 주문서 조회와 판매 조작을 하지 않는다', async () => {
  const calls: string[] = []
  const products = createSellerProducts((async (path: string) => {
    calls.push(path)
    throw new Error('forbidden')
  }) as HttpClient)
  await assert.rejects(products.changePrice('42', 20000), /forbidden/)
  assert.deepEqual(calls, ['/shopping/v1/seller/products/42'])
})

test('판매정보 지연 중에는 mutation을 보내지 않고 실패하면 기본정보 편집을 유지한다', async () => {
  let rejectSale!: (reason: Error) => void
  const sale = new Promise((_, reject) => { rejectSale = reject })
  const calls: { path: string; method?: string }[] = []
  const products = createSellerProducts((async (path: string, options?: { method?: string }) => {
    calls.push({ path, method: options?.method })
    if (path.includes('/seller/products/')) return existingProduct
    return sale
  }) as HttpClient)
  const mutation = products.changePrice('42', 20000)
  await Promise.resolve(); await Promise.resolve()
  assert.equal(calls.length, 2)
  assert.ok(calls.every((call) => !call.method))
  rejectSale(new Error('503'))
  await assert.rejects(mutation, { code: 'INVALID_STATE' })
  const product = await products.updateBasicInfo('42', { name: '이름 수정', description: '설명', version: 3 })
  assert.equal(product.status, 'UNKNOWN')
  assert.equal(product.salesId, null)
  assert.equal(product.name, '기존 상품')
  assert.ok(calls.some((call) => call.path === '/shopping/v1/seller/products/42' && call.method === 'PATCH'))
  assert.ok(!calls.some((call) => call.path.includes('/sales/') && call.method === 'PATCH'))
})

test('판매정보 없는 DRAFT는 주문서 조회 없이 판매 설정을 등록하고 다시 조회한다', async () => {
  const calls: string[] = []
  let registered = false
  const products = createSellerProducts((async (path: string) => {
    calls.push(path)
    if (path === '/commerce/v1/sales') { registered = true; return { id: 81 } }
    if (path.includes('/seller/products/'))
      return registered ? existingProduct : { ...existingProduct, salesStatus: 'NOT_REGISTERED', price: null, available: null }
    return saleCheckout
  }) as HttpClient)
  assert.equal((await products.get('42')).status, 'DRAFT')
  assert.equal(calls.length, 1)
  const result = await products.setSaleInfo('42', { price: 17000, stock: 7 })
  assert.equal(result.salesId, '81')
  assert.equal(result.status, 'READY')
  assert.equal(calls.filter((path) => path === '/commerce/v1/orders/checkout').length, 1)
})

test('판매정보가 확인된 기존 상품의 가격·재고·상태를 서버 salesId로 변경한다', async () => {
  const mutations: { path: string; body: unknown }[] = []
  const products = createSellerProducts((async (path: string, options?: { method?: string; body?: unknown }) => {
    if (options?.method === 'PATCH') { mutations.push({ path, body: options.body }); return }
    return path.includes('/seller/products/') ? existingProduct : saleCheckout
  }) as HttpClient)
  await products.changePrice('42', 19000)
  await products.adjustStock('42', 3)
  await products.changeSaleStatus('42', 'HIDE')
  assert.deepEqual(mutations, [
    { path: '/commerce/v1/sales/81/price', body: { price: 19000 } },
    { path: '/commerce/v1/sales/81/stock', body: { delta: 3 } },
    { path: '/commerce/v1/sales/81/status', body: { status: 'PRIVATE' } },
  ])
})

test('다른 상품의 판매정보 응답이나 확인되지 않은 판매ID로는 변경하지 않는다', async () => {
  for (const sale of [{ ...saleCheckout, productId: 99 }, { ...saleCheckout, salesId: undefined }]) {
    const products = createSellerProducts((async (path: string, options?: { method?: string }) => {
      assert.notEqual(options?.method, 'PATCH')
      return path.includes('/seller/products/') ? existingProduct : sale
    }) as HttpClient)
    await assert.rejects(products.adjustStock('42', 1), { code: 'INVALID_STATE' })
  }
})

test('판매자 재고 조회의 판매 가능 수량과 결제 대기 예약 수량을 분리해 반환한다', async () => {
  const calls: string[] = []
  const products = createSellerProducts((async (path: string) => {
    calls.push(path)
    if (path.includes('/seller/products/')) return existingProduct
    if (path.endsWith('/stock')) return { salesInfoId: 81, available: 4, reserved: 3 }
    return saleCheckout
  }) as HttpClient)
  const product = await products.get('42')
  assert.equal(product.stock, 4)
  assert.equal(product.reservedStock, 3)
  assert.equal(product.salesId, '81')
  assert.equal(calls.at(-1), '/commerce/v1/sales/81/stock')
})
