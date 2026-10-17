import { expect, test, type Page } from '@playwright/test'

async function sellerSession(page: Page) {
  await page.route('**/api/notification/**', route => route.fulfill({ json: { unreadCount: 0 } }))
  await page.route('**/broadcasts/*/viewers', route => route.fulfill({ json: { broadcastId: 1, total: 2, measuredAt: new Date().toISOString(), expiresAfterSeconds: 60 } }))
  await page.route('**/api/member/**', route => route.fulfill({ json: {
    success: true,
    data: route.request().url().includes('/members/me')
      ? { memberId: 'seller', email: 'seller@test.dev', displayName: '판매자', roles: ['SELLER'] }
      : { accessToken: 'test-token', refreshToken: 'test-refresh' },
  } }))
  await page.goto('/login')
  await page.getByLabel('아이디 또는 이메일').fill('seller')
  await page.getByLabel('비밀번호', { exact: true }).fill('seller')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '상품 관리', exact: true })).toBeVisible()
}
const product = (id: number, name: string, status: string, stock: number | null) => ({
  productId: id, name, salesStatus: status, available: stock, price: stock === null ? null : 24000,
  mainImageUrl: null, description: '상품 설명', version: 1,
})

test('상품 상태와 검색을 조합하고 다음 페이지를 불러와도 필터를 유지한다', async ({ page }) => {
  let requests = 0
  await page.route('**/api/shopping/v1/seller/products?**', route => {
    requests++
    const second = new URL(route.request().url()).searchParams.get('page') === '1'
    return route.fulfill({ json: { items: second
      ? [product(3, '추가 품절 상품', 'SOLD_OUT', 0)]
      : [product(1, '판매 중 상품', 'ON_SALE', 12), product(2, '품절 상품', 'SOLD_OUT', 0)],
    page: second ? 1 : 0, size: 2, totalElements: 3, totalPages: 2 } })
  })
  await sellerSession(page)
  const list = page.getByRole('region', { name: '상품 목록', exact: true })
  await expect(list.getByRole('article')).toHaveCount(2)
  const beforeFilter = requests
  await page.getByRole('group', { name: '판매 상태' }).getByRole('button', { name: '품절', exact: true }).click()
  await expect(list.getByRole('article')).toHaveCount(1)
  await page.getByRole('button', { name: '더 보기 (2/3)' }).click()
  await expect(list.getByRole('article')).toHaveCount(2)
  expect(requests).toBe(beforeFilter + 1)
  await expect(page.getByRole('button', { name: '품절 2개 목록 보기' })).toBeVisible()
  await page.getByLabel('상품 검색').fill('추가')
  await expect(list.getByRole('article')).toHaveCount(1)
  await expect(list.getByRole('link', { name: '추가 품절 상품 재고 관리' })).toHaveAttribute('href', '/admin/products/3')
  await page.getByLabel('상품 검색').fill('없는 상품')
  await expect(page.getByText('조건에 맞는 상품이 없어요')).toBeVisible()
  await page.getByRole('button', { name: '검색·필터 초기화' }).click()
  await expect(list.getByRole('article')).toHaveCount(3)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await expect(page.getByRole('link', { name: '환불 관리', exact: true })).toBeVisible()
})

test('다음 페이지에만 일치하는 상품이 있어도 더 보기를 제공하고 조회 실패를 빈 결과와 구분한다', async ({ page }) => {
  let fail = false
  await page.route('**/api/shopping/v1/seller/products?**', route => fail
    ? route.fulfill({ status: 503, json: { message: '상품 서버 점검 중' } })
    : route.fulfill({ json: { items: [product(1, '준비할 상품', 'NOT_REGISTERED', null)], page: 0, size: 1, totalElements: 2, totalPages: 2 } }))
  await sellerSession(page)
  await page.getByRole('group', { name: '판매 상태' }).getByRole('button', { name: '품절', exact: true }).click()
  await expect(page.getByText('아직 불러오지 않은 상품이 있어요.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: '더 보기 (1/2)' })).toBeVisible()
  fail = true
  await page.getByRole('button', { name: '새로고침' }).click()
  await expect(page.getByText('불러오지 못했어요', { exact: true })).toBeVisible()
  await expect(page.getByText('등록한 상품이 없어요', { exact: true })).not.toBeVisible()
})

test('방송 상태를 서버에 전달하고 진행 중인 방송의 운영·시청 화면을 연결한다', async ({ page }) => {
  await page.route('**/api/shopping/v1/seller/products?**', route => route.fulfill({ json: { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } }))
  await page.route('**/api/live/v1/seller/broadcasts?**', route => {
    const status = new URL(route.request().url()).searchParams.get('status')
    return route.fulfill({ json: { content: [{ id: 1, title: '라이브 특가 방송', status: status ?? 'LIVE', scheduledAt: '2026-10-17T19:00:00+09:00', startedAt: '2026-10-17T19:00:00+09:00', playbackUrl: null }], number: 0, size: 20, totalElements: 1, totalPages: 1 } })
  })
  await sellerSession(page)
  await page.getByRole('link', { name: '방송 관리', exact: true }).click()
  await expect(page.getByRole('link', { name: '라이브 특가 방송 방송 운영' })).toHaveAttribute('href', '/admin/lives/1')
  await expect(page.getByRole('link', { name: '시청 화면', exact: true })).toHaveAttribute('href', '/lives/1')
  await page.getByRole('button', { name: '준비 중', exact: true }).click()
  await expect(page.getByRole('link', { name: '라이브 특가 방송 방송 준비' })).toBeVisible()
  await expect(page.getByRole('link', { name: '시청 화면', exact: true })).not.toBeVisible()
})

test('기본정보만 등록한 상품에서 설정 현황과 가격·재고 바로가기를 제공한다', async ({ page }) => {
  await page.route('**/api/shopping/v1/seller/products?**', route => route.fulfill({ json: { items: [product(1, '신규 상품', 'NOT_REGISTERED', null)], page: 0, size: 20, totalElements: 1, totalPages: 1 } }))
  await page.route('**/api/shopping/v1/seller/products/1', route => route.fulfill({ json: product(1, '신규 상품', 'NOT_REGISTERED', null) }))
  await sellerSession(page)
  await page.getByRole('link', { name: '신규 상품 판매 설정' }).click()
  await expect(page.getByRole('region', { name: '상품 설정 현황' })).toContainText('가격과 재고를 설정한 뒤 판매를 시작해 주세요.')
  await page.getByRole('link', { name: '2. 가격·재고' }).click()
  await expect(page).toHaveURL(/#sale-info$/)
  await expect(page.getByLabel('판매 가격(원)', { exact: true })).toBeInViewport()
})
