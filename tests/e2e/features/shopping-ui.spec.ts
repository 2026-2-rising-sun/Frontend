import { expect, test, type Page } from '@playwright/test'

const products = [
  { productId: 1, name: '무선 헤드폰', description: '헤드폰 상품 설명\n두 번째 줄', price: 129000, available: 24, salesStatus: 'ON_SALE', mainImageUrl: '/fixtures/product-1.svg' },
  { productId: 2, name: '데일리 텀블러', description: '텀블러 상품 설명', price: 24000, available: 0, salesStatus: 'SOLD_OUT', mainImageUrl: null },
  { productId: 3, name: '포터블 스피커', description: '스피커 상품 설명', price: 49000, available: 5, salesStatus: 'ON_SALE', mainImageUrl: '/fixtures/product-3.svg' },
]
async function setup(page: Page, options: { liveFailure?: boolean; linkedFailure?: boolean; delayedMissingProduct?: Promise<void> } = {}) {
  const cart: unknown[] = []
  const claims: string[] = []
  const restocks: unknown[] = []
  const cursors: (string | null)[] = []
  const productRequests: URL[] = []
  let failCart = false
  await page.route('**/fixtures/*.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="282" height="240"><rect width="282" height="240" fill="#e0f9d1"/></svg>' }))
  await page.route(/\/api\/(member|shopping|live|commerce|notification)\//, async route => {
    const request = route.request()
    const url = new URL(request.url()), path = url.pathname
    const json = (value: unknown) => route.fulfill({ json: value })
    if (path.includes('/auth/')) return json({ success: true, data: { accessToken: 'token', refreshToken: 'refresh' } })
    if (path.endsWith('/members/me')) return json({ success: true, data: { memberId: 'user', email: 'user@test.dev', displayName: '회원', roles: ['USER'] } })
    if (/\/restock-alerts\/\d+$/.test(path) && request.method() === 'GET') return json({ subscribed: false })
    if (path.endsWith('/broadcasts/11/viewers')) return json({ broadcastId: 11, total: 2, measuredAt: new Date().toISOString(), expiresAfterSeconds: 60 })
    if (path.endsWith('/notifications/unread-count')) return json({ unreadCount: 0 })
    if (path.endsWith('/broadcasts/11/products')) return options.linkedFailure ? route.fulfill({ status: 503, json: { message: '방송 상품 조회 실패' } }) : json([products[2]])
    if (path.endsWith('/broadcasts')) return options.liveFailure ? route.fulfill({ status: 503, json: { message: '방송 조회 실패' } }) : json({ content: [
      { id: 11, title: '오늘의 라이브', status: 'LIVE', scheduledAt: '2026-10-17T19:00:00+09:00', playbackUrl: null },
      { id: 12, title: '다음 라이브', status: 'PREPARING', scheduledAt: '2026-10-18T20:00:00+09:00', playbackUrl: null },
    ], number: 0, size: 6, totalElements: 2, totalPages: 1 })
    if (path.endsWith('/shopping/v1/products')) {
      const cursor = url.searchParams.get('cursor'); cursors.push(cursor); productRequests.push(url)
      let items = products.filter(p => p.name.includes(url.searchParams.get('q') ?? '') && (!url.searchParams.has('status') || p.salesStatus === url.searchParams.get('status')))
      const sort = url.searchParams.get('sort')
      if (sort === 'PRICE_ASC' || sort === 'PRICE_DESC') items = items.toSorted((a, b) => sort === 'PRICE_ASC' ? a.price - b.price : b.price - a.price)
      return json({ items: cursor ? items.slice(2) : items.slice(0, 2), nextCursor: !cursor && items.length > 2 ? 2 : null, hasNext: !cursor && items.length > 2 })
    }
    if (/\/products\/\d+\/coupons$/.test(path)) return json(path.includes('/products/1/') ? [{ couponId: 'coupon-1', name: '라이브 쿠폰', fixedDiscount: 5000, endsAt: '2030-10-31T23:59:59+09:00', expiresAt: '2030-11-07T23:59:59+09:00', soldOut: false }] : [])
    if (/\/shopping\/v1\/products\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop())
      if (id === 99) { await options.delayedMissingProduct; return route.fulfill({ status: 404, json: { message: '상품을 찾을 수 없어요.' } }) }
      return json(products.find(p => p.productId === id))
    }
    if (path.endsWith('/cart/items') && request.method() === 'POST') {
      cart.push(request.postDataJSON())
      return failCart ? route.fulfill({ status: 409, json: { code: 'OUT_OF_STOCK', message: '재고가 부족해요.' } }) : json({ id: 1, productId: 1, quantity: request.postDataJSON().quantity, version: 0 })
    }
    if (path.endsWith('/claims')) { claims.push(path); return route.fulfill({ status: 204 }) }
    if (path.endsWith('/restock-alerts')) { restocks.push(request.postDataJSON()); return route.fulfill({ status: 204 }) }
    return route.fulfill({ status: 404 })
  })
  return { cart, claims, restocks, cursors, productRequests, failCart: () => { failCart = true } }
}
async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('아이디 또는 이메일').fill('user@test.dev')
  await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
}

test('홈은 실제 연결 상품 사진을 사용하고 검색·커서 추가 조회·정렬을 유지한다', async ({ page }) => {
  const api = await setup(page)
  await page.goto('/')
  await expect(page.getByRole('region', { name: '진행 중인 방송' }).getByAltText('오늘의 라이브')).toHaveAttribute('src', '/fixtures/product-3.svg')
  const section = page.locator('#products')
  await expect(section.getByRole('link')).toHaveCount(2)
  await page.getByRole('searchbox', { name: '상품 검색' }).fill('스피커')
  await page.getByRole('searchbox', { name: '상품 검색' }).press('Enter')
  await expect(section.getByRole('link', { name: /포터블 스피커/ })).toBeVisible()
  expect(api.productRequests.at(-1)?.searchParams.get('q')).toBe('스피커')
  await page.getByRole('button', { name: '전체 상품 보기', exact: true }).click()
  await expect(section.getByRole('link')).toHaveCount(2)
  await page.getByRole('button', { name: '더 보기', exact: true }).click()
  await expect(section.getByRole('link')).toHaveCount(3)
  expect(api.cursors).toContain('2')
  await page.getByRole('combobox', { name: '정렬 기준' }).selectOption('PRICE_ASC')
  await expect(section.getByRole('link').first()).toContainText('데일리 텀블러')
  await page.getByRole('group', { name: '판매 상태' }).getByRole('button', { name: '판매 중', exact: true }).click()
  await expect(section.getByRole('link')).toHaveCount(2)
  expect(await section.evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(await page.getByRole('heading', { name: '다음 라이브도 만나보세요' }).evaluate(el => el.getBoundingClientRect().top))
})

test('방송 조회 장애는 상품 탐색을 막지 않는다', async ({ page }) => {
  await setup(page, { liveFailure: true })
  await page.goto('/')
  await expect(page.locator('#products').getByRole('link')).toHaveCount(2)
  await expect(page.getByRole('region', { name: '진행 중인 방송' })).not.toBeVisible()
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeVisible()
})

test('방송 상품 사진이 없어도 라이브 진입과 모바일 목록을 유지한다', async ({ page }) => {
  await setup(page, { linkedFailure: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('link', { name: '라이브 보러가기 →' })).toHaveAttribute('href', '/lives/11')
  await expect(page.locator('#products').getByRole('link')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('상세는 쿠폰 수령·수량별 금액·장바구니 요청·구매 진입을 기존 API에 연결한다', async ({ page }) => {
  const api = await setup(page)
  await login(page)
  await page.goto('/products/1')
  await page.getByRole('button', { name: '쿠폰 받기', exact: true }).click()
  expect(api.claims).toEqual(['/api/commerce/v1/coupons/coupon-1/claims'])
  await expect(page.getByText('쿠폰을 받았어요. 주문서에서 선택해 주세요.')).toBeVisible()
  await page.getByRole('button', { name: '수량 늘리기' }).click()
  await expect(page.getByText('258,000원', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '바로 구매', exact: true })).toHaveAttribute('href', '/checkout?productId=1&quantity=2')
  await page.getByRole('button', { name: '장바구니 담기', exact: true }).click()
  await expect(page.getByText('장바구니에 담았어요.', { exact: true })).toBeVisible()
  expect(api.cart).toEqual([{ productId: 1, quantity: 2 }])
  await page.setViewportSize({ width: 390, height: 844 })
  api.failCart()
  await page.getByRole('button', { name: '장바구니 담기', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('재고가 부족해요.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const description = page.getByRole('region', { name: '상품 설명', exact: true })
  const actionTop = await page.getByRole('button', { name: '장바구니 담기', exact: true }).locator('..').locator('..').evaluate(el => el.getBoundingClientRect().top)
  expect(await description.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(actionTop)
})

test('품절 상품의 구매는 막고 재입고 알림 요청은 유지한다', async ({ page }) => {
  const api = await setup(page)
  await login(page)
  await page.goto('/products/2')
  await expect(page.getByRole('button', { name: '품절', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '장바구니 담기', exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: '알림 신청', exact: true }).click()
  await expect(page.getByText('재입고 알림을 신청했어요.')).toBeVisible()
  expect(api.restocks).toEqual([{ productId: 2 }])
})

test('비회원 장바구니 진입은 로그인 후 같은 상품으로 돌아온다', async ({ page }) => {
  await setup(page)
  await page.goto('/products/1')
  await page.getByRole('button', { name: '장바구니 담기', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('아이디 또는 이메일').fill('user@test.dev')
  await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/\/products\/1$/)
})

test('다른 상품으로 이동하는 동안 이전 상품의 구매 버튼을 남기지 않는다', async ({ page }) => {
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  await setup(page, { delayedMissingProduct: delayed })
  await page.goto('/products/1')
  await expect(page.getByRole('link', { name: '바로 구매', exact: true })).toBeVisible()
  await page.evaluate(() => { window.history.pushState({}, '', '/products/99'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('link', { name: '바로 구매', exact: true })).not.toBeVisible()
  release()
  await expect(page.getByText('찾을 수 없어요', { exact: true })).toBeVisible()
})
