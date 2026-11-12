import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import viteConfig from '../vite.config'
import { servicePorts } from '../scripts/services'
import { createHttpApi } from '../src/api/http'
import { product, sellerProduct } from '../src/api/http/mappers'

Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })

test('공개 프록시의 고정 포트와 경로를 유지하고 Payment는 내부 서비스로 둔다', async () => {
  assert.deepEqual(servicePorts, { member: 8081, catalog: 8082, commercecore: 8083, live: 8084, notification: 8085, payment: 8086 })
  const config = await viteConfig({ command: 'serve', mode: 'development' })
  const proxies = config.server!.proxy!
  assert.deepEqual(Object.keys(proxies), ['/api/member', '/api/catalog', '/api/commercecore', '/api/live', '/api/notification'])
  for (const [name, port] of Object.entries(servicePorts)) {
    if (name === 'payment') continue
    const proxy = proxies[`/api/${name}`]
    assert.ok(typeof proxy !== 'string')
    assert.equal(proxy.target, process.env[`${name.toUpperCase()}_URL`] ?? `http://127.0.0.1:${port}`)
    assert.equal(proxy.rewrite!(`/api/${name}/v1/example?size=2`), '/v1/example?size=2')
  }
})

test('공개 상품과 판매자 상품의 Core 이미지 URL을 변경 없이 표시한다', () => {
  const dto = { productId: 1, name: '상품', mainImageUrl: '/api/commercecore/v1/product-images/9', salesStatus: 'ON_SALE', price: 1000 }
  assert.equal(product(dto).imageUrl, dto.mainImageUrl)
  assert.equal(sellerProduct(dto).imageUrl, dto.mainImageUrl)
})

test('단건·묶음 결제 생성과 조회는 Payment 내부 API 대신 Core facade로 보낸다', async () => {
  const previous = globalThis.fetch
  const paths: string[] = []
  globalThis.fetch = async url => {
    paths.push(new URL(String(url)).pathname)
    return Response.json({ paymentId: 9, status: 'SUCCESS' })
  }
  try {
    const api = createHttpApi('http://localhost/api')
    await api.payments.start('OD/1')
    await api.payments.get('OD/1', '9')
    await api.paymentGroups.start('PG/1', 'same-request')
    await api.paymentGroups.payment('PG/1', '9')
    assert.deepEqual(paths, [
      '/api/commercecore/v1/orders/OD%2F1/payments',
      '/api/commercecore/v1/orders/OD%2F1/payments/9',
      '/api/commercecore/v1/payment-groups/PG%2F1/payments',
      '/api/commercecore/v1/payment-groups/PG%2F1/payments/9',
    ])
  } finally { globalThis.fetch = previous }
})
