import { expect, test, type Page } from '@playwright/test'

// 브랜드, 원가(베리특가), 만족도, 무료배송은 아직 Backend 계약에 없는 표시용 필드다. 값이 있을 때와 없을 때를 함께 본다.
const products = [
  { productId: 1, name: '바른 도가니탕 500g X 4팩', mainImageUrl: null, price: 11900, salesStatus: 'ON_SALE', available: 30, brandName: '진한식품', originalPrice: 27600,
    satisfaction: { veryGood: 66, good: 10, bad: 14, veryBad: 10 }, freeShipping: true },
  { productId: 2, name: '필드 없는 상품', mainImageUrl: null, price: 18000, salesStatus: 'ON_SALE', available: 5 },
]

async function fixture(page: Page) {
  await page.route(/\/api\/(member|catalog|commercecore|live|notification)\//, route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/catalog/v1/products')) return route.fulfill({ json: { items: products, hasNext: false, nextCursor: null } })
    const detail = path.match(/\/catalog\/v1\/products\/(\d+)$/)
    if (detail) return route.fulfill({ json: products.find(product => product.productId === Number(detail[1])) })
    if (/\/products\/\d+\/coupons$/.test(path)) return route.fulfill({ json: [] })
    if (path.endsWith('/broadcasts')) return route.fulfill({ json: { content: [], number: 0, size: 3, totalElements: 0, totalPages: 0 } })
    return route.fulfill({ status: 401 })
  })
}

test('상품 카드는 브랜드, 원가와 베리특가, 만족 비율과 리뷰 수, 무료배송을 보여 주고 값이 없으면 숨긴다', async ({ page }) => {
  await fixture(page)
  await page.goto('/?q=상품')
  const card = page.getByRole('link', { name: /바른 도가니탕/ })
  await expect(card.getByText('진한식품', { exact: true })).toBeVisible()
  await expect(card.getByLabel('원가 27,600원')).toBeVisible()
  await expect(card.getByText('베리특가', { exact: true })).toBeVisible()
  await expect(card.getByText('76% 만족', { exact: true })).toBeVisible()
  await expect(card.getByText('리뷰 100', { exact: true })).toBeVisible()
  await expect(card.getByText('무료배송', { exact: true })).toBeVisible()
  const plain = page.getByRole('link', { name: /필드 없는 상품/ })
  await expect(plain).toContainText('18,000원')
  await expect(plain.getByText(/베리특가|만족|리뷰|무료배송/)).toHaveCount(0)
})

test('상품 상세의 상품 만족도는 만족 비율과 4단계 비율을 보여 주고 리뷰 수를 누르면 이동한다', async ({ page }) => {
  await fixture(page)
  await page.goto('/products/1')
  await page.getByRole('link', { name: '리뷰 100' }).click()
  const section = page.getByRole('region', { name: '상품 만족도' })
  await expect(section).toBeInViewport()
  await expect(section).toContainText('76%의 구매자가 만족했어요.')
  for (const [label, percent] of [['매우 만족해요', '66%'], ['만족해요', '10%'], ['아쉬워요', '14%'], ['매우 아쉬워요', '10%']]) {
    await expect(section.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible()
    await expect(section.getByRole('definition').filter({ hasText: new RegExp(`^${percent}$`) }).first()).toBeVisible()
  }
  await section.getByRole('button', { name: '상품 만족도 기준 안내' }).hover()
  await expect(section.getByRole('tooltip')).toContainText('매우 만족해요')
  await page.goto('/products/2')
  await expect(page.getByRole('heading', { name: '필드 없는 상품' })).toBeVisible()
  await expect(page.getByRole('region', { name: '상품 만족도' })).toHaveCount(0)
})
