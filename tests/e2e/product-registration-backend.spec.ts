import { expect, test, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const required = (key: string) => { const value = process.env[key]; if (!value) throw new Error(`${key} 검증 설정이 필요합니다.`); return value }
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=', 'base64')
const file = { name: 'product.png', mimeType: 'image/png', buffer: png }
const registrationPath = '/api/commercecore/v1/seller/products/registrations'
const namespace = required('PRODUCT_REGISTRATION_E2E_NAMESPACE')
if (!namespace.startsWith('shoppinglive-fe86-')) throw new Error('상품 등록 검증 전용 namespace가 필요합니다.')
const backendSha = required('PRODUCT_REGISTRATION_E2E_BACKEND_SHA')
const frontendSha = required('PRODUCT_REGISTRATION_E2E_FRONTEND_SHA')

function database(productId: number, key: string) {
  if (!Number.isSafeInteger(productId) || productId < 1 || !/^[a-f0-9-]{36}$/.test(key)) throw new Error('검증 식별자를 확인해 주세요.')
  const sql = `SELECT json_build_object(
    'totalProducts',(SELECT count(*) FROM product),
    'totalSkus',(SELECT count(*) FROM sku),
    'totalImages',(SELECT count(*) FROM product_image),
    'products',(SELECT count(*) FROM product WHERE id=${productId}),
    'skus',(SELECT count(*) FROM sku WHERE product_id=${productId}),
    'registrations',(SELECT count(*) FROM product_registration WHERE request_key='${key}'),
    'images',(SELECT count(*) FROM product_image WHERE id=(SELECT main_image_id FROM product WHERE id=${productId})),
    'saleEnabled',(SELECT sale_enabled FROM product WHERE id=${productId}),
    'storedResponse',(SELECT response_json::json FROM product_registration WHERE request_key='${key}'),
    'skuRows',(SELECT json_agg(json_build_object('id',id,'price',price,'available',available,'reserved',reserved,'saleStatus',sale_status) ORDER BY id) FROM sku WHERE product_id=${productId})
  );`
  const output = execFileSync('kubectl', ['--context', 'kind-shoppinglive-dev', '-n', namespace, 'exec', '-i', 'deployment/postgres', '--', 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h 127.0.0.1 -U frontend -d commercecore -At -v ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' })
  return JSON.parse(output.trim())
}

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('아이디 또는 이메일').fill(required('PRODUCT_REGISTRATION_E2E_EMAIL'))
  await page.getByLabel('비밀번호', { exact: true }).fill(required('PRODUCT_REGISTRATION_E2E_PASSWORD'))
  const response = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/auth/login'))
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  const auth = await (await response).json()
  await expect(page.getByRole('heading', { name: '상품 관리', exact: true })).toBeVisible()
  return { Authorization: `Bearer ${auth.data.accessToken}` }
}
async function fill(page: Page, name: string, stock: number, multi = false) {
  await page.goto('/seller/products/new')
  await page.getByLabel('상품명', { exact: true }).fill(name)
  await page.getByLabel('상품 설명', { exact: true }).fill('격리된 실제 API 연계 검증 상품')
  await page.getByLabel('대표 이미지', { exact: true }).setInputFiles(file)
  await page.getByLabel('옵션명 1', { exact: true }).fill('검정')
  await page.getByLabel('판매 가격 1(원)', { exact: true }).fill('1200')
  await page.getByLabel('초기 재고 1(개)', { exact: true }).fill(String(stock))
  if (multi) {
    await page.getByRole('button', { name: '판매 옵션 추가', exact: true }).click()
    await page.getByLabel('옵션명 2', { exact: true }).fill('흰색')
    await page.getByLabel('판매 가격 2(원)', { exact: true }).fill('1400')
    await page.getByLabel('초기 재고 2(개)', { exact: true }).fill('0')
  }
}

for (const stock of [7, 0]) {
  test(`실제 단일 SKU 등록·이미지 저장·DB·Catalog 반영: 초기 재고 ${stock}`, async ({ page }, info) => {
    const headers = await login(page)
    const name = `FE86 실제 단일 ${stock} ${randomUUID().slice(0, 8)}`
    await fill(page, name, stock)
    const response = page.waitForResponse(r => new URL(r.url()).pathname === registrationPath && r.request().method() === 'POST')
    await page.getByRole('button', { name: '상품 등록', exact: true }).click()
    const created = await response
    expect(created.status()).toBe(201)
    const bundle = (await created.json()).data
    const key = created.request().headers()['x-idempotency-key']
    await expect(page.getByRole('heading', { name: '상품 등록 완료', exact: true })).toBeVisible()
    expect(bundle.skus).toHaveLength(1)
    expect(bundle.skus[0]).toMatchObject({ available: stock, reserved: 0, status: stock ? 'ON_SALE' : 'SOLD_OUT' })
    const stored = database(bundle.productId, key)
    expect(stored).toMatchObject({ products: 1, skus: 1, registrations: 1, images: 1, saleEnabled: true })
    expect(stored.storedResponse).toEqual(bundle)
    const image = await page.request.get(bundle.mainImageUrl)
    expect(image.status()).toBe(200)
    expect(await image.body()).toEqual(png)
    const detail = await page.request.get(`/api/commercecore/v1/seller/products/${bundle.productId}`, { headers })
    expect(detail.status()).toBe(200)
    expect((await detail.json()).data).toMatchObject({ productId: bundle.productId, name, price: 1200, available: stock })
    let catalog: unknown
    await expect.poll(async () => {
      const r = await page.request.get(`/api/catalog/v1/products/${bundle.productId}`)
      if (r.ok()) catalog = await r.json()
      return r.status()
    }, { timeout: 30000 }).toBe(200)
    expect((catalog as { data: { salesStatus: string; available: number } }).data).toMatchObject({ salesStatus: stock ? 'ON_SALE' : 'SOLD_OUT', available: stock })
    await page.reload()
    await expect(page.getByRole('heading', { name: '상품 등록 완료', exact: true })).toBeVisible()
    await writeFile(info.outputPath('evidence.json'), JSON.stringify({ backendSha, frontendSha, name, key, bundle, stored, catalog, imageMatches: true }, null, 2))
  })
}

test('실제 서버 커밋 후 응답 유실·새로고침 재전송에도 상품·SKU·파일을 중복 생성하지 않는다', async ({ page }, info) => {
  const headers = await login(page)
  const name = `FE86 실제 응답 유실 ${randomUUID().slice(0, 8)}`
  await fill(page, name, 7)
  const responses: Record<string, unknown>[] = []
  const keys: string[] = []
  let afterFirstCommit: ReturnType<typeof database>
  await page.route('**/api/commercecore/v1/seller/products/registrations', async route => {
    // 실제 서버 응답을 받은 뒤 첫 응답만 브라우저에 전달하지 않는다. 서버 응답을 합성하지 않는다.
    const response = await route.fetch()
    expect(response.status()).toBe(201)
    responses.push((await response.json()).data)
    keys.push(route.request().headers()['x-idempotency-key'])
    if (responses.length === 1) {
      afterFirstCommit = database(Number(responses[0].productId), keys[0])
      return route.abort('failed')
    }
    return route.fulfill({ response })
  })
  await page.getByRole('button', { name: '상품 등록', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재시도', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByLabel('상품명', { exact: true })).toHaveValue(name)
  await page.getByLabel('대표 이미지', { exact: true }).setInputFiles(file)
  await page.getByRole('button', { name: '같은 요청으로 재시도', exact: true }).click()
  await expect(page.getByRole('heading', { name: '상품 등록 완료', exact: true })).toBeVisible()
  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])
  expect(responses[1]).toEqual(responses[0])
  const bundle = responses[0]
  const stored = database(Number(bundle.productId), keys[0])
  expect(stored).toMatchObject({ products: 1, skus: 1, registrations: 1, images: 1 })
  expect(stored).toEqual(afterFirstCommit)
  const conflict = await page.request.post(registrationPath, { headers: { ...headers, 'X-Idempotency-Key': keys[0] }, multipart: {
    file, request: { name: 'request.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ name, description: '변경한 설명', skus: [{ optionLabel: '검정', price: 1200, initialStock: 7 }] })) },
  } })
  expect(conflict.status()).toBe(409)
  expect(database(Number(bundle.productId), keys[0])).toEqual(stored)
  await writeFile(info.outputPath('evidence.json'), JSON.stringify({ backendSha, frontendSha, name, keys, responses, afterFirstCommit, stored, changedRequestStatus: conflict.status(), failureInjection: '실제 서버 커밋 뒤 첫 브라우저 응답만 유실' }, null, 2))
})

test('실제 다중 SKU·재고 0 등록 결과를 보존하고 기존 조회의 제한을 확인한다', async ({ page }, info) => {
  const headers = await login(page)
  const name = `FE86 실제 다중 ${randomUUID().slice(0, 8)}`
  await fill(page, name, 7, true)
  const response = page.waitForResponse(r => new URL(r.url()).pathname === registrationPath && r.request().method() === 'POST')
  await page.getByRole('button', { name: '상품 등록', exact: true }).click()
  const created = await response
  expect(created.status()).toBe(201)
  const bundle = (await created.json()).data
  const key = created.request().headers()['x-idempotency-key']
  await expect(page.getByRole('heading', { name: '상품 등록 완료', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: '등록된 판매 옵션' }).getByRole('listitem')).toHaveCount(2)
  expect(bundle.skus).toHaveLength(2)
  expect(bundle.skus[1]).toMatchObject({ optionLabel: '흰색', available: 0, status: 'SOLD_OUT' })
  const stored = database(bundle.productId, key)
  expect(stored).toMatchObject({ products: 1, skus: 2, registrations: 1, images: 1 })
  expect(stored.storedResponse).toEqual(bundle)
  const detail = await page.request.get(`/api/commercecore/v1/seller/products/${bundle.productId}`, { headers })
  expect(detail.status()).toBe(409)
  await expect.poll(async () => (await page.request.get(`/api/catalog/v1/products/${bundle.productId}`)).status(), { timeout: 30000 }).toBe(503)
  await expect(page.getByRole('link', { name: '기본정보 확인', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('list', { name: '등록된 판매 옵션' }).getByRole('listitem')).toHaveCount(2)
  await writeFile(info.outputPath('evidence.json'), JSON.stringify({ backendSha, frontendSha, name, key, bundle, stored, sellerDetailStatus: 409, catalogDetailStatus: 503 }, null, 2))
})
