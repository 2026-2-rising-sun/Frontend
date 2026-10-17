import { expect, test, type Page } from '@playwright/test'

const product = { productId: 1, name: '쿠폰 상품', description: '상품 설명', price: 10000, available: 5, salesStatus: 'ON_SALE', mainImageUrl: null }
const coupon = { couponId: 'coupon-a', name: '상품 할인 쿠폰', fixedDiscount: 3000, startsAt: '2020-01-01T00:00:00Z', endsAt: '2030-12-01T00:00:00Z', expiresAt: '2030-12-31T00:00:00Z', soldOut: false }
const memberCoupon = (status = 'AVAILABLE', couponId = 'coupon-a') => ({ id: `mine-${couponId}`, couponId, name: '상품 할인 쿠폰', fixedDiscount: 3000, status, claimedAt: '2026-01-01T00:00:00Z', expiresAt: coupon.expiresAt })
async function fixture(page: Page, options: { status?: string; soldOut?: boolean; noCoupons?: boolean; mineFailure?: boolean; productFailure?: boolean; secondPage?: boolean; claimFailure?: boolean; holdClaim?: Promise<void> } = {}) {
  let claims = 0
  let failed = !!options.mineFailure
  let received = false
  const pages: string[] = []
  await page.route(/\/api\/(member|shopping|commerce|live|notification)\//, async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'token', refreshToken: 'refresh' } } })
    if (path.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: 'buyer', displayName: '회원', email: 'buyer@test.dev', roles: ['USER'] } } })
    if (path.endsWith('/unread-count')) return route.fulfill({ json: { unreadCount: 0 } })
    if (path.endsWith('/shopping/v1/products')) return route.fulfill({ json: { items: [product], nextCursor: null, hasNext: false } })
    if (path.endsWith('/shopping/v1/products/1')) return route.fulfill({ json: product })
    if (path.endsWith('/products/1/coupons')) return options.productFailure ? route.fulfill({ status: 503 }) : route.fulfill({ json: options.noCoupons ? [] : [{ ...coupon, soldOut: !!options.soldOut }] })
    if (path.endsWith('/me/coupons')) {
      pages.push(url.searchParams.get('page') ?? '0')
      if (failed) return route.fulfill({ status: 503 })
      const items = options.secondPage && url.searchParams.get('page') === '0'
        ? Array.from({ length: 20 }, (_, i) => memberCoupon('AVAILABLE', `other-${i}`))
        : options.status || received ? [memberCoupon(options.status)] : []
      return route.fulfill({ json: items })
    }
    if (path.endsWith('/coupon-a/claims')) {
      claims++
      await options.holdClaim
      if (options.claimFailure) return route.fulfill({ status: 409, json: { code: 'CONFLICT', message: '발급 수량이 소진됐어요.' } })
      received = true
      return route.fulfill({ status: 201, json: memberCoupon() })
    }
    if (path.endsWith('/broadcasts')) return route.fulfill({ json: { content: [], number: 0, size: 3, totalElements: 0, totalPages: 0 } })
    return route.fulfill({ status: 404 })
  })
  return { claims: () => claims, pages, recover: () => { failed = false } }
}
async function login(page: Page) {
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('buyer@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
}

test('목록의 쿠폰 혜택 표시에서 상세의 로그인·받기 안내로 이어진다', async ({ page }) => {
  await fixture(page)
  await page.goto('/')
  const item = page.locator('#products').getByRole('link', { name: /쿠폰 상품/ })
  await expect(item.getByText('쿠폰 혜택', { exact: true })).toBeVisible()
  await item.click()
  const region = page.getByRole('region', { name: '상품 쿠폰' })
  await expect(region.getByText('받을 수 있어요', { exact: true })).toBeVisible()
  await expect(region.getByText('쿠폰 적용 예상가 7,000원', { exact: true })).toBeVisible()
  await expect(region.getByRole('link', { name: '로그인하고 쿠폰 받기' })).toHaveAttribute('href', '/login')
})

test('받기 완료 후 사용 가능 상태로 바꾸고 중복 발급 버튼을 잠근다', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const api = await fixture(page, { holdClaim: held })
  await login(page); await page.goto('/products/1')
  await page.getByRole('button', { name: '쿠폰 받기', exact: true }).click()
  await expect(page.getByRole('button', { name: '받는 중…' })).toBeDisabled()
  release()
  await expect(page.getByText('보유 · 사용 가능', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '받은 쿠폰' })).toBeDisabled()
  expect(api.claims()).toBe(1)
  await page.reload()
  await expect(page.getByRole('button', { name: '받은 쿠폰' })).toBeDisabled()
  expect(api.claims()).toBe(1)
})

for (const [status, label] of [['AVAILABLE', '사용 가능'], ['RESERVED', '주문에 적용 중'], ['USED', '사용 완료'], ['EXPIRED', '기간 만료']]) {
  test(`보유 쿠폰 ${status} 상태를 표시하고 다시 받지 않는다`, async ({ page }) => {
    const api = await fixture(page, { status, soldOut: true })
    await login(page); await page.goto('/products/1')
    await expect(page.getByText(`보유 · ${label}`, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '받은 쿠폰' })).toBeDisabled()
    await expect(page.getByRole('button', { name: '쿠폰 받기', exact: true })).toHaveCount(0)
    expect(api.claims()).toBe(0)
  })
}

test('보유 쿠폰 다음 페이지까지 확인해 이미 받은 쿠폰을 구분한다', async ({ page }) => {
  const api = await fixture(page, { secondPage: true, status: 'AVAILABLE' })
  await login(page); await page.goto('/products/1')
  await expect(page.getByText('보유 · 사용 가능', { exact: true })).toBeVisible()
  expect(api.pages).toContain('1')
  expect(api.claims()).toBe(0)
})

test('보유 조회 실패를 미보유로 처리하지 않고 재조회 후 받기를 허용한다', async ({ page }) => {
  const api = await fixture(page, { mineFailure: true })
  await login(page); await page.goto('/products/1')
  await expect(page.getByText('보유 여부 확인 필요', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '쿠폰 받기', exact: true })).toBeDisabled()
  api.recover(); await page.getByRole('button', { name: '보유 쿠폰 다시 조회', exact: true }).click()
  await expect(page.getByRole('button', { name: '쿠폰 받기', exact: true })).toBeEnabled()
  expect(api.claims()).toBe(0)
})

test('수량 소진·상품 쿠폰 없음·발급 거절 상태를 명확하게 표시한다', async ({ page }) => {
  await fixture(page, { soldOut: true })
  await page.goto('/products/1')
  await expect(page.getByRole('button', { name: '수량 소진', exact: true })).toBeDisabled()
  await fixture(page, { noCoupons: true }); await page.reload()
  await expect(page.getByText('지금 받을 수 있는 상품 쿠폰이 없어요.', { exact: false })).toBeVisible()
  const api = await fixture(page, { claimFailure: true })
  await login(page); await page.goto('/products/1')
  await page.getByRole('button', { name: '쿠폰 받기', exact: true }).click()
  await expect(page.getByText('발급 수량이 소진됐어요.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '받은 쿠폰' })).toHaveCount(0)
  expect(api.claims()).toBe(1)
})


test('화면을 열어 둔 동안 사용 기한이 지나면 만료 상태로 갱신한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-17T00:00:00Z') })
  await fixture(page, { status: 'AVAILABLE' })
  await page.route('**/api/commerce/v1/me/coupons?**', route => route.fulfill({ json: [{ ...memberCoupon(), expiresAt: '2026-10-17T00:00:03Z' }] }))
  await login(page); await page.goto('/products/1')
  await expect(page.getByText('보유 · 사용 가능', { exact: true })).toBeVisible()
  await page.clock.fastForward(5000)
  await expect(page.getByText('보유 · 기간 만료', { exact: true })).toBeVisible()
})
