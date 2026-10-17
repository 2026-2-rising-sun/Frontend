import { expect, test, type Page } from '@playwright/test'

const products = [
  { productId: 1, name: '무선 헤드폰', description: '헤드폰 상품 설명\n두 번째 줄', price: 129000, available: 24, salesStatus: 'ON_SALE', mainImageUrl: '/fixtures/product-1.svg' },
  { productId: 2, name: '데일리 텀블러', description: '텀블러 상품 설명', price: 24000, available: 0, salesStatus: 'SOLD_OUT', mainImageUrl: null },
  { productId: 3, name: '포터블 스피커', description: '스피커 상품 설명', price: 49000, available: 5, salesStatus: 'ON_SALE', mainImageUrl: '/fixtures/product-3.svg' },
]
async function setup(page: Page, options: { liveFailure?: boolean; linkedFailure?: boolean; upcomingOnly?: boolean; emptyLives?: boolean; readyFailure?: boolean; delayedMissingProduct?: Promise<void> } = {}) {
  const cart: unknown[] = []
  const claims: string[] = []
  const restocks: unknown[] = []
  const cursors: (string | null)[] = []
  const productRequests: URL[] = []
  let failCart = false
  let failLinked = !!options.linkedFailure
  const liveRequests: URL[] = []
  const ownedCoupons: unknown[] = []
  await page.route('**/fixtures/*.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="282" height="240"><rect width="282" height="240" fill="#e0f9d1"/></svg>' }))
  await page.route(/\/api\/(member|shopping|live|commerce|notification)\//, async route => {
    const request = route.request()
    const url = new URL(request.url()), path = url.pathname
    const json = (value: unknown) => route.fulfill({ json: value })
    if (path.includes('/auth/')) return json({ success: true, data: { accessToken: 'token', refreshToken: 'refresh' } })
    if (path.endsWith('/members/me')) return json({ success: true, data: { memberId: 'user', email: 'user@test.dev', displayName: '회원', roles: ['USER'] } })
    if (/\/restock-alerts\/\d+$/.test(path) && request.method() === 'GET') return json({ subscribed: false })
    if (path.endsWith('/broadcasts/11/viewers')) return json({ broadcastId: 11, total: 2, measuredAt: new Date().toISOString(), expiresAfterSeconds: 60 })
    if (path.endsWith('/me/coupons')) return json(ownedCoupons)
    if (path.endsWith('/notifications/unread-count')) return json({ unreadCount: 0 })
    if (path.endsWith('/broadcasts/11/products')) return failLinked ? route.fulfill({ status: 503, json: { message: '방송 상품 조회 실패' } }) : json([products[2]])
    if (path.endsWith('/broadcasts/12/products')) return json([products[0]])
    if (path.endsWith('/broadcasts')) {
      liveRequests.push(url)
      if (options.liveFailure || (options.readyFailure && url.searchParams.get('status') === 'PREPARING')) return route.fulfill({ status: 503, json: { message: '방송 조회 실패' } })
      const content = options.emptyLives ? [] : [
        ...(!options.upcomingOnly ? [{ id: 11, title: '오늘의 라이브', status: 'LIVE', scheduledAt: '2026-10-17T19:00:00+09:00', playbackUrl: null }] : []),
        { id: 12, title: '다음 라이브', status: 'PREPARING', scheduledAt: '2026-10-18T20:00:00+09:00', playbackUrl: null },
      ].filter(live => live.status === url.searchParams.get('status'))
      return json({ content, number: 0, size: 3, totalElements: content.length, totalPages: content.length ? 1 : 0 })
    }
    if (path.endsWith('/shopping/v1/products')) {
      const cursor = url.searchParams.get('cursor'); cursors.push(cursor); productRequests.push(url)
      let items = products.filter(p => p.name.includes(url.searchParams.get('q') ?? '') && (!url.searchParams.has('status') || p.salesStatus === url.searchParams.get('status')))
      const sort = url.searchParams.get('sort')
      if (sort === 'PRICE_ASC' || sort === 'PRICE_DESC') items = items.toSorted((a, b) => sort === 'PRICE_ASC' ? a.price - b.price : b.price - a.price)
      return json({ items: cursor ? items.slice(2) : items.slice(0, 2), nextCursor: !cursor && items.length > 2 ? 2 : null, hasNext: !cursor && items.length > 2 })
    }
    if (/\/products\/\d+\/coupons$/.test(path)) return json(path.includes('/products/1/') ? [{ couponId: 'coupon-1', name: '라이브 쿠폰', fixedDiscount: 5000, startsAt: '2020-01-01T00:00:00Z', endsAt: '2030-10-31T23:59:59+09:00', expiresAt: '2030-11-07T23:59:59+09:00', soldOut: false }] : [])
    if (/\/shopping\/v1\/products\/\d+$/.test(path)) {
      const id = Number(path.split('/').pop())
      if (id === 99) { await options.delayedMissingProduct; return route.fulfill({ status: 404, json: { message: '상품을 찾을 수 없어요.' } }) }
      return json(products.find(p => p.productId === id))
    }
    if (path.endsWith('/cart/items') && request.method() === 'POST') {
      cart.push(request.postDataJSON())
      return failCart ? route.fulfill({ status: 409, json: { code: 'OUT_OF_STOCK', message: '재고가 부족해요.' } }) : json({ id: 1, productId: 1, quantity: request.postDataJSON().quantity, version: 0 })
    }
    if (path.endsWith('/claims')) { claims.push(path); const coupon = { id: 'member-coupon-1', couponId: 'coupon-1', name: '라이브 쿠폰', fixedDiscount: 5000, status: 'AVAILABLE', claimedAt: new Date().toISOString(), expiresAt: '2030-11-07T23:59:59+09:00' }; ownedCoupons.push(coupon); return route.fulfill({ status: 201, json: coupon }) }
    if (path.endsWith('/restock-alerts')) { restocks.push(request.postDataJSON()); return route.fulfill({ status: 204 }) }
    return route.fulfill({ status: 404 })
  })
  return { cart, claims, restocks, cursors, productRequests, liveRequests, recoverLinked: () => { failLinked = false }, failCart: () => { failCart = true } }
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
  expect(await page.getByRole('heading', { name: '추천 라이브', exact: true }).evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(await section.evaluate(el => el.getBoundingClientRect().top))
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


test('방송별 상품은 실제 연결을 따라 바뀌고 추천과 상품 상세로 각각 이동한다', async ({ page }) => {
  const api = await setup(page)
  await page.goto('/')
  const section = page.getByRole('region', { name: '방송별 소개 상품', exact: true })
  await expect(section.getByRole('link', { name: /포터블 스피커/ })).toHaveAttribute('href', '/products/3')
  await expect(section.getByRole('link', { name: /무선 헤드폰/ })).toHaveCount(0)
  await section.getByRole('button', { name: '다음 라이브', exact: true }).click()
  await expect(section.getByRole('link', { name: /무선 헤드폰/ })).toHaveAttribute('href', '/products/1')
  await expect(section.getByRole('link', { name: /포터블 스피커/ })).toHaveCount(0)
  await expect(section.getByRole('link', { name: '다음 라이브 →', exact: true })).toHaveAttribute('href', '/lives/12')
  const recommendations = page.getByRole('region', { name: '추천 라이브', exact: true })
  await expect(recommendations.getByRole('link', { name: /오늘의 라이브/ })).toHaveAttribute('href', '/lives/11')
  await expect(recommendations.getByRole('link', { name: /다음 라이브/ })).toHaveAttribute('href', '/lives/12')
  expect([...new Set(api.liveRequests.map(url => url.searchParams.get('status')))].sort()).toEqual(['LIVE', 'PREPARING'])
})

test('진행 중인 방송이 없어도 예정 방송의 배너·추천·연결 상품을 보여준다', async ({ page }) => {
  await setup(page, { upcomingOnly: true })
  await page.goto('/')
  const hero = page.getByRole('region', { name: '추천 예정 방송', exact: true })
  await expect(hero).toContainText('방송 예정')
  await expect(hero.getByRole('link', { name: '방송 미리보기 →' })).toHaveAttribute('href', '/lives/12')
  await expect(page.getByRole('region', { name: '진행 중인 방송', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '방송별 소개 상품', exact: true }).getByRole('link', { name: /무선 헤드폰/ })).toBeVisible()
})

test('일부 방송 조회가 실패해도 정상 방송을 유지하고 소개 상품 실패는 재조회한다', async ({ page }) => {
  const api = await setup(page, { readyFailure: true, linkedFailure: true })
  await page.goto('/')
  await expect(page.getByText('일부 방송을 확인하지 못했어요', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: '진행 중인 방송' })).toBeVisible()
  await expect(page.getByText('이 방송의 상품을 불러오지 못했어요', { exact: true })).toBeVisible()
  await expect(page.locator('#products').getByRole('link')).toHaveCount(2)
  api.recoverLinked()
  await page.getByRole('button', { name: '상품 다시 조회', exact: true }).click()
  await expect(page.getByRole('region', { name: '방송별 소개 상품', exact: true }).getByRole('link', { name: /포터블 스피커/ })).toBeVisible()
})

test('방송이 없으면 빈 상태를 표시하고 두 줄 헤더는 검색·메뉴·모바일 폭을 유지한다', async ({ page }) => {
  await setup(page, { emptyLives: true })
  await page.goto('/')
  await expect(page.getByRole('region', { name: '방송 안내' })).toBeVisible()
  await expect(page.locator('#products').getByRole('link')).toHaveCount(2)
  await page.setViewportSize({ width: 1440, height: 1000 })
  const header = page.getByRole('banner')
  const search = header.getByRole('searchbox', { name: '상품 검색' })
  const nav = header.getByRole('navigation', { name: '주요 메뉴' })
  expect(await nav.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(await search.evaluate(el => el.getBoundingClientRect().bottom))
  await expect(header.getByRole('link', { name: '장바구니', exact: true })).toHaveAttribute('href', '/cart')
  await search.fill('스피커'); await search.press('Enter')
  await expect(page).toHaveURL(/q=/)
  await expect(page.locator('#products').getByRole('link', { name: /포터블 스피커/ })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(nav.getByRole('link', { name: '방송', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})


test('한 방송 목록이 실패하고 다른 목록이 비어도 방송이 없다고 단정하지 않는다', async ({ page }) => {
  await setup(page, { emptyLives: true, readyFailure: true })
  await page.goto('/')
  await expect(page.getByText('일부 방송을 확인하지 못했어요', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '방송 다시 조회', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: '방송 안내' })).toHaveCount(0)
  await expect(page.locator('#products').getByRole('link')).toHaveCount(2)
})

test('두 줄 헤더가 상품 설명 바로가기의 제목을 가리지 않는다', async ({ page }) => {
  await setup(page)
  await page.route('**/api/shopping/v1/products/1', route => route.fulfill({ json: { ...products[0], description: '긴 상품 설명\n'.repeat(120) } }))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/products/1')
  await page.locator('a[href="#product-description"]').click()
  const headerBottom = await page.getByRole('banner').evaluate(el => el.getBoundingClientRect().bottom)
  const descriptionTop = await page.getByRole('heading', { name: '상품 설명', exact: true }).evaluate(el => el.getBoundingClientRect().top)
  expect(descriptionTop).toBeGreaterThanOrEqual(headerBottom)
})
