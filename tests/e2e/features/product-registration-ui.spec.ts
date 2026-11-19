import { expect, test, type Page, type Route } from '@playwright/test'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=', 'base64')
const result = {
  productId: 42, mainImageId: 9, mainImageUrl: '/image', saleEnabled: true,
  skus: [{ skuId: 81, optionLabel: '검정', price: 1200, available: 7, reserved: 0, status: 'ON_SALE' },
    { skuId: 82, optionLabel: '흰색', price: 1400, available: 0, reserved: 0, status: 'SOLD_OUT' }],
}
const image = { name: 'product.png', mimeType: 'image/png', buffer: png }

async function setup(page: Page, register: (route: Route) => Promise<void>) {
  await page.route(/\/api\/(member|commercecore|notification|catalog|live)\//, async route => {
    const path = new URL(route.request().url()).pathname
    const json = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (path.endsWith('/seller/products/registrations')) return register(route)
    if (path.endsWith('/members/me')) return json({ memberId: 'seller', email: 'seller@test.dev', displayName: '판매자', roles: ['SELLER'] })
    if (path.includes('/auth/')) return json({ accessToken: 'test-token', refreshToken: 'test-refresh' })
    if (path.endsWith('/seller/products')) return json({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })
    if (path.includes('/notification/')) return json({ unreadCount: 0 })
    // 생성 완료가 GET 성공에 의존하면 이 응답으로 실패한다.
    return route.fulfill({ status: 503, json: { message: '조회 반영 지연' } })
  })
  await page.goto('/login')
  await page.getByLabel('아이디 또는 이메일').fill('seller')
  await page.getByLabel('비밀번호', { exact: true }).fill('seller')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '상품 관리', exact: true })).toBeVisible()
  await page.goto('/seller/products/new')
  await expect(page.getByRole('heading', { name: '상품 등록', exact: true })).toBeVisible()
}

async function fill(page: Page, multiple = true) {
  await page.getByLabel('상품명', { exact: true }).fill('통합 등록 상품')
  await page.getByLabel('상품 설명', { exact: true }).fill('상품 설명')
  await page.getByLabel('대표 이미지', { exact: true }).setInputFiles(image)
  await page.getByLabel('옵션명 1', { exact: true }).fill('검정')
  await page.getByLabel('판매 가격 1(원)', { exact: true }).fill('1200')
  await page.getByLabel('초기 재고 1(개)', { exact: true }).fill('7')
  if (multiple) {
    await page.getByRole('button', { name: '판매 옵션 추가', exact: true }).click()
    await page.getByLabel('옵션명 2', { exact: true }).fill('흰색')
    await page.getByLabel('판매 가격 2(원)', { exact: true }).fill('1400')
    await page.getByLabel('초기 재고 2(개)', { exact: true }).fill('0')
  }
}

const submit = (page: Page) => page.getByRole('button', { name: '상품 등록', exact: true }).click()

test('다중 옵션·품절을 한 번 등록하고 조회 지연·새로고침에도 성공 결과를 유지한다', async ({ page }) => {
  let count = 0
  await setup(page, async route => {
    count++
    if (count === 2) return route.abort('failed')
    expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=')
    const body = route.request().postDataBuffer()!.toString()
    expect(body).toContain('name="file"; filename="product.png"')
    expect(body).toContain('name="request"')
    expect(body).toContain('Content-Type: application/json')
    expect(body).toContain('"initialStock":0')
    await route.fulfill({ status: 201, json: { success: true, data: result } })
  })
  await fill(page)
  await submit(page)
  await expect(page.getByRole('heading', { name: '상품 등록 완료', exact: true })).toBeVisible()
  const options = page.getByRole('list', { name: '등록된 판매 옵션' })
  await expect(options.getByRole('listitem')).toHaveCount(2)
  await expect(options).toContainText('SKU ID 81')
  await expect(options).toContainText('SKU ID 82')
  await expect(options.getByText('품절', { exact: true })).toBeVisible()
  await expect(page.getByText('여러 옵션 상품의 고객 조회·구매는 아직 지원하지 않아요.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: '판매 시작', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: '상품 등록 완료', exact: true })).toBeVisible()
  expect(count).toBe(1)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/product-registration-mobile.png', fullPage: true })
  await page.getByRole('button', { name: '다른 상품 등록', exact: true }).click()
  await expect(page.getByLabel('상품명', { exact: true })).toHaveValue('')
  await fill(page, false)
  await page.getByLabel('대표 이미지', { exact: true }).setInputFiles({ ...image, name: 'second.png' })
  await submit(page)
  await expect(page.getByRole('button', { name: '같은 요청으로 재시도', exact: true })).toBeEnabled()
  await expect(page.getByText('이전 이미지(second.png)를', { exact: false })).toBeVisible()
})

test('응답 유실 후 입력을 복구하고 같은 파일로 같은 키를 재전송한다', async ({ page }) => {
  const keys: string[] = []
  await setup(page, async route => {
    keys.push(route.request().headers()['x-idempotency-key'])
    if (keys.length === 1) return route.abort('failed')
    await route.fulfill({ status: 201, json: { success: true, data: { ...result, skus: [result.skus[0]] } } })
  })
  await fill(page, false)
  await submit(page)
  await expect(page.getByRole('button', { name: '같은 요청으로 재시도', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByLabel('상품명', { exact: true })).toHaveValue('통합 등록 상품')
  await expect(page.getByLabel('판매 가격 1(원)', { exact: true })).toBeDisabled()
  await page.getByLabel('대표 이미지', { exact: true }).setInputFiles({ ...image, buffer: Buffer.from('different') })
  await page.getByRole('button', { name: '같은 요청으로 재시도', exact: true }).click()
  expect(keys).toHaveLength(1)
  await page.getByLabel('대표 이미지', { exact: true }).setInputFiles(image)
  await page.getByRole('button', { name: '같은 요청으로 재시도', exact: true }).click()
  await expect(page.getByRole('heading', { name: '상품 등록 완료', exact: true })).toBeVisible()
  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])
})

test('같은 이벤트 루프에서 두 번 제출해도 생성 요청을 한 번만 보낸다', async ({ page }) => {
  let count = 0
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await setup(page, async route => {
    count++
    await gate
    await route.fulfill({ status: 201, json: { success: true, data: result } })
  })
  await fill(page)
  await page.locator('form').evaluate(form => {
    ;(form as HTMLFormElement).requestSubmit()
    ;(form as HTMLFormElement).requestSubmit()
  })
  await expect.poll(() => count).toBe(1)
  await expect(page.getByLabel('상품명', { exact: true })).toBeDisabled()
  release()
  await expect(page.getByRole('heading', { name: '상품 등록 완료', exact: true })).toBeVisible()
  expect(count).toBe(1)
})

test('입력·옵션 중복·파일 오류를 서버 호출 전에 안내한다', async ({ page }) => {
  let count = 0
  await setup(page, async route => { count++; await route.fulfill({ status: 500, json: {} }) })
  await submit(page)
  await expect(page.getByRole('alert')).toContainText('상품명')
  await fill(page)
  await page.getByLabel('옵션명 2', { exact: true }).fill(' 검정 ')
  await submit(page)
  await expect(page.getByRole('alert')).toContainText('같은 옵션명')
  await page.getByLabel('옵션명 2', { exact: true }).fill('흰색')
  await page.getByLabel('초기 재고 2(개)', { exact: true }).fill('2147483648')
  await submit(page)
  await expect(page.getByRole('alert')).toContainText('초기 재고')
  await page.getByLabel('초기 재고 2(개)', { exact: true }).fill('0')
  await page.getByLabel('판매 가격 2(원)', { exact: true }).fill('1.5')
  await submit(page)
  await expect(page.getByRole('alert')).toContainText('가격')
  await page.getByLabel('대표 이미지', { exact: true }).setInputFiles({ name: 'wrong.gif', mimeType: 'image/gif', buffer: png })
  await expect(page.getByText('JPG, PNG 이미지만 등록할 수 있어요.')).toBeVisible()
  expect(count).toBe(0)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('서버 입력 거절은 수정 가능하고 키 충돌은 기존 요청을 보존한다', async ({ page }) => {
  const keys: string[] = []
  await setup(page, async route => {
    keys.push(route.request().headers()['x-idempotency-key'])
    return keys.length === 1
      ? route.fulfill({ status: 400, json: { code: 'INVALID_REQUEST', message: '입력값을 확인해 주세요.' } })
      : route.fulfill({ status: 409, json: { code: 'CONFLICT', message: '다른 등록 내용' } })
  })
  await fill(page)
  await submit(page)
  await expect(page.getByLabel('상품명', { exact: true })).toBeEnabled()
  await page.getByLabel('상품명', { exact: true }).fill('수정한 상품')
  await submit(page)
  await expect(page.getByRole('alert')).toContainText('등록 요청 내용이 달라요')
  expect(keys).toHaveLength(2)
  expect(keys[1]).not.toBe(keys[0])
  await page.getByRole('button', { name: '같은 요청으로 재시도', exact: true }).click()
  await expect.poll(() => keys.length).toBe(3)
  expect(keys[2]).toBe(keys[1])
})

test('기존 상품의 이미지·기본정보·가격·재고·판매 상태 수정을 유지한다', async ({ page }) => {
  let price = 1200; let stock = 7; let status = 'READY'; let uploads = 0; let name = '기존 상품'
  const mutations: string[] = []
  await setup(page, async () => { throw new Error('기존 상품 수정에서 통합 생성 호출 금지') })
  await page.route('**/api/commercecore/**', async route => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    const json = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (method !== 'GET') mutations.push(path)
    if (path.endsWith('/seller/product-images')) { uploads++; return json({ imageId: 10 }) }
    if (path.endsWith('/seller/products/42')) {
      if (method === 'PATCH') { name = route.request().postDataJSON().name; return route.fulfill({ status: 204 }) }
      return json({ productId: 42, name, description: '설명', mainImageUrl: '/image', version: 1, salesStatus: status, price, available: stock })
    }
    if (path.endsWith('/orders/checkout')) return json({ productId: 42, salesId: 81, unitPrice: price, salesStatus: status })
    if (method === 'GET' && path.endsWith('/sales/81/stock')) return json({ available: stock, reserved: 0 })
    if (method === 'PATCH') {
      const body = route.request().postDataJSON()
      if (path.endsWith('/price')) price = body.price
      if (path.endsWith('/stock')) stock += body.delta
      if (path.endsWith('/status')) status = body.status
      return route.fulfill({ status: 204 })
    }
    throw new Error('예상하지 않은 기존 상품 요청: ' + path)
  })
  await page.goto('/seller/products/42')
  await expect(page.getByRole('button', { name: '판매 시작', exact: true })).toBeVisible()
  expect(mutations).toHaveLength(0)
  await page.getByLabel('상품명', { exact: true }).fill('수정한 상품')
  await page.getByLabel('대표 이미지', { exact: true }).setInputFiles(image)
  await page.getByRole('button', { name: '기본정보 저장', exact: true }).click()
  await expect(page.getByText('기본정보를 저장했어요.', { exact: true })).toBeVisible()
  expect(uploads).toBe(1)
  expect(status).toBe('READY')
  await page.getByLabel(/^판매 가격\(원\)/).fill('1500')
  await page.getByRole('button', { name: '가격 변경', exact: true }).click()
  // 입력값은 저장 전부터 1500이다. 서버 재조회로 현재 가격이 반영된 뒤 다음 편집을 시작한다.
  await expect(page.getByRole('region', { name: '판매 설정', exact: true })).toContainText('현재 1,500원')
  await page.getByLabel(/^재고 증감량/).fill('2')
  await page.getByRole('button', { name: '재고 수정', exact: true }).click()
  await expect(page.getByText('재고를 수정했어요.', { exact: true })).toBeVisible()
  expect(stock).toBe(9)
  expect(status).toBe('READY')
  await page.getByRole('button', { name: '판매 시작', exact: true }).click()
  await page.getByRole('button', { name: '비공개로 전환', exact: true }).click()
  await expect(page.getByRole('button', { name: '공개 재개', exact: true })).toBeEnabled()
  expect(status).toBe('PRIVATE')
  await page.getByRole('button', { name: '공개 재개', exact: true }).click()
  await expect(page.getByRole('button', { name: '비공개로 전환', exact: true })).toBeEnabled()
  expect(status).toBe('ON_SALE')
  expect(mutations.some(path => path.endsWith('/registrations'))).toBe(false)
})

for (const failure of ['서버 실패', '잘못된 성공 응답']) {
  test(`${failure} 뒤에도 새 키 없이 동일 요청으로 복구한다`, async ({ page }) => {
    const keys: string[] = []
    await setup(page, async route => {
      keys.push(route.request().headers()['x-idempotency-key'])
      if (keys.length === 1) return failure === '서버 실패'
        ? route.fulfill({ status: 500, json: { message: '저장 결과를 확인하지 못했어요.' } })
        : route.fulfill({ status: 201, json: { success: true, data: { productId: 42 } } })
      return route.fulfill({ status: 201, json: { success: true, data: { ...result, skus: [result.skus[0]] } } })
    })
    await fill(page, false)
    await page.getByLabel('초기 재고 1(개)', { exact: true }).press('Enter')
    await expect(page.getByRole('button', { name: '같은 요청으로 재시도', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: '같은 요청으로 재시도', exact: true }).click()
    await expect(page.getByRole('heading', { name: '상품 등록 완료', exact: true })).toBeVisible()
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
  })
}
