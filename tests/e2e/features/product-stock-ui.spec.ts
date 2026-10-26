import { expect, test, type Page } from '@playwright/test'

// 수량 제공과 누락 응답을 함께 검증한다. 실제 서비스 연동 검증과는 구분한다.
const products = [
  { productId: 1, name: '데일리 텀블러', mainImageUrl: null, price: 18000, salesStatus: 'ON_SALE', available: 1234 },
  { productId: 2, name: '품절 머그컵', mainImageUrl: null, price: 12000, salesStatus: 'SOLD_OUT', available: 0 },
  { productId: 3, name: '수량 미제공 상품', mainImageUrl: null, price: 25000, salesStatus: 'ON_SALE' },
  { productId: 4, name: '판매 중 예약 소진 상품', mainImageUrl: null, price: 32000, salesStatus: 'ON_SALE', available: 0 },
]
const lives = [
  { id: 11, title: '오늘의 라이브', status: 'LIVE', scheduledAt: '2026-10-26T09:00:00Z', playbackUrl: null },
  { id: 12, title: '다음 라이브', status: 'PREPARING', scheduledAt: '2026-10-27T09:00:00Z', playbackUrl: null },
]

async function fixture(page: Page, options: { currentContract?: boolean; catalogFailure?: boolean; linkedFailure?: boolean } = {}) {
  const paths: string[] = []
  let failed = !!(options.catalogFailure || options.linkedFailure)
  const items = options.currentContract ? products.map(({ available: _available, ...p }) => p) : products
  await page.route(/\/api\/(member|shopping|commerce|live|notification)\//, async route => {
    const url = new URL(route.request().url()), path = url.pathname
    paths.push(path)
    if (path.endsWith('/shopping/v1/products')) return options.catalogFailure && failed
      ? route.fulfill({ status: 503 }) : route.fulfill({ json: { items, hasNext: false, nextCursor: null } })
    if (path.endsWith('/broadcasts')) {
      const content = lives.filter(live => live.status === url.searchParams.get('status'))
      return route.fulfill({ json: { content, number: 0, size: 3, totalElements: content.length, totalPages: 1 } })
    }
    if (/\/broadcasts\/\d+\/products$/.test(path)) return options.linkedFailure && failed
      ? route.fulfill({ status: 503 }) : route.fulfill({ json: path.includes('/11/') ? items : [{ ...products[0], available: 7, status: 'ON_SALE', salesStatus: undefined }] })
    if (/\/products\/\d+\/coupons$/.test(path)) return route.fulfill({ json: [{ couponId: 'coupon-1', name: '상품 쿠폰', fixedDiscount: 1000, startsAt: '2020-01-01T00:00:00Z', endsAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:00:00Z', soldOut: false }] })
    if (path.endsWith('/shopping/v1/products/1')) return route.fulfill({ json: products[0] })
    if (path.endsWith('/viewers')) return route.fulfill({ json: { total: 3 } })
    return route.fulfill({ status: 401 })
  })
  return { paths, recover: () => { failed = false } }
}

for (const width of [1440, 390]) {
  test(`${width}px 메인의 일반·방송 카드가 실제 수량·0·미제공과 가격·품절·쿠폰을 함께 표시한다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    const api = await fixture(page)
    await page.goto('/')
    const catalog = page.locator('#products')
    const linked = page.getByRole('region', { name: '방송별 소개 상품', exact: true })
    for (const section of [catalog, linked]) {
      const selling = section.getByRole('link', { name: /데일리 텀블러/ })
      await expect(selling.getByText('남은 재고 1,234개', { exact: true })).toBeVisible()
      await expect(selling.getByText('18,000원', { exact: true })).toBeVisible()
      await expect(selling.getByText('쿠폰 혜택', { exact: true })).toBeVisible()
      const soldOut = section.getByRole('link', { name: /품절 머그컵/ })
      await expect(soldOut.getByText('남은 재고 0개', { exact: true })).toBeVisible()
      await expect(soldOut.getByText('품절', { exact: true })).toHaveCount(2)
      const unknown = section.getByRole('link', { name: /수량 미제공 상품/ })
      await expect(unknown.getByText('재고 확인 필요', { exact: true })).toBeVisible()
      await expect(unknown.getByText('남은 재고 0개', { exact: true })).toHaveCount(0)
      await expect(unknown.getByText('품절', { exact: true })).toHaveCount(0)
      // 예약분 소진과 Commerce 판매 상태는 서로 다른 계약이다.
      const reserved = section.getByRole('link', { name: /판매 중 예약 소진 상품/ })
      await expect(reserved.getByText('남은 재고 0개', { exact: true })).toBeVisible()
      await expect(reserved.getByText('품절', { exact: true })).toHaveCount(0)
      const first = await selling.boundingBox(), second = await soldOut.boundingBox()
      expect(first && second && Math.abs(first.y - second.y)).toBeLessThan(1)
      const third = await unknown.boundingBox()
      expect(third!.y > first!.y).toBe(width === 390)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(api.paths.filter(path => /\/products\/\d+$|\/stock$|\/checkout$/.test(path))).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`stock-${width}.png`), fullPage: true })
    await linked.getByRole('button', { name: '다음 라이브', exact: true }).click()
    await expect(linked.getByText('남은 재고 7개', { exact: true })).toBeVisible()
    await linked.getByRole('link', { name: /데일리 텀블러/ }).click()
    await expect(page).toHaveURL(/\/products\/1$/)
    await expect(page.getByRole('link', { name: '바로 구매', exact: true })).toBeVisible()
  })
}

test('수량이 누락된 응답에서도 판매 상태를 유지하고 재고를 추정하지 않는다', async ({ page }) => {
  await fixture(page, { currentContract: true })
  await page.goto('/')
  for (const section of [page.locator('#products'), page.getByRole('region', { name: '방송별 소개 상품', exact: true })]) {
    await expect(section.getByText('재고 확인 필요', { exact: true })).toHaveCount(4)
    await expect(section.getByText(/남은 재고/)).toHaveCount(0)
    await expect(section.getByRole('link', { name: /품절 머그컵/ }).getByText('품절', { exact: true })).toHaveCount(2)
  }
})

test('상품·방송 상품 조회 실패를 품절·재고 0으로 대체하지 않고 재조회한다', async ({ page }) => {
  const api = await fixture(page, { catalogFailure: true, linkedFailure: true })
  await page.goto('/')
  const catalog = page.locator('#products')
  const linked = page.getByRole('region', { name: '방송별 소개 상품', exact: true })
  await expect(catalog.getByText('불러오지 못했어요', { exact: true })).toBeVisible()
  await expect(linked.getByText('이 방송의 상품을 불러오지 못했어요', { exact: true })).toBeVisible()
  await expect(page.getByText('남은 재고 0개', { exact: true })).toHaveCount(0)
  api.recover()
  await catalog.getByRole('button', { name: '다시 시도', exact: true }).click()
  await linked.getByRole('button', { name: '상품 다시 조회', exact: true }).click()
  await expect(catalog.getByText('남은 재고 1,234개', { exact: true })).toBeVisible()
  await expect(linked.getByText('남은 재고 1,234개', { exact: true })).toBeVisible()
})

test('수량 없는 상품 상세는 품절로 단정하지 않고 구매와 수량 변경을 막는다', async ({ page }) => {
  await fixture(page)
  await page.route('**/api/shopping/v1/products/1', route => route.fulfill({ json: { ...products[0], available: null } }))
  await page.goto('/products/1')
  await expect(page.getByRole('button', { name: '구매할 수 없어요', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '수량 늘리기' })).toBeDisabled()
  await expect(page.getByRole('link', { name: '바로 구매', exact: true })).toHaveCount(0)
  await expect(page.getByText('품절', { exact: true })).toHaveCount(0)
})
