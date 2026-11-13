import { expect, test, type Page } from '@playwright/test'

// 화면마다 상품 카드 종류가 다르다: 식품, 생활은 가성비형, 가전, 뷰티, 패션은 기본형, 세일은 특가형.
const base = { mainImageUrl: null, salesStatus: 'ON_SALE', available: 10, satisfaction: { veryGood: 70, good: 20, bad: 6, veryBad: 4 } }
const products = [
  { ...base, productId: 1, name: '짜장 라면 140g X 5팩', price: 5300, category: 'FOOD', brandName: '진한식품', originalPrice: 8000, freeShipping: true, freeReturn: true,
    deliveryType: 'DAWN', netContent: { amount: 700, unit: 'g' }, packCount: 5, orderingCount: 120 },
  { ...base, productId: 2, name: '울 하프코트', price: 99000, category: 'FASHION', brandName: '라온', originalPrice: 150000, freeShipping: true, freeReturn: true, deliveryType: 'TODAY', orderingCount: 80 },
]
const coupon = { couponId: 'c1', name: '상품 할인 쿠폰', fixedDiscount: 3000, startsAt: '2020-01-01T00:00:00Z', endsAt: '2099-12-01T00:00:00Z', expiresAt: '2099-12-31T00:00:00Z', soldOut: false }

async function fixture(page: Page) {
  await page.route(/\/api\/(member|catalog|commercecore|live|notification)\//, route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/catalog/v1/products')) {
      const category = url.searchParams.get('category')
      return route.fulfill({ json: { items: products.filter(p => !category || p.category === category), hasNext: false, nextCursor: null } })
    }
    if (/\/products\/\d+\/coupons$/.test(url.pathname)) return route.fulfill({ json: url.pathname.includes('/products/2/') ? [coupon] : [] })
    return route.fulfill({ status: 401 })
  })
}

test('식품 카테고리는 가성비형 카드로 묶음 수, 단위가격, 빠른 배송, 무료배송과 무료반품을 보인다', async ({ page }) => {
  await fixture(page)
  await page.goto('/categories/food')
  const card = page.getByRole('link', { name: /짜장 라면/ })
  await expect(card).toHaveAttribute('data-variant', 'value')
  await expect(card.getByText('5개', { exact: true })).toBeVisible()
  await expect(card.getByText('(100g당 757원)', { exact: true })).toBeVisible()
  for (const label of ['새벽도착', '무료배송', '무료반품']) await expect(card.getByText(label, { exact: true })).toBeVisible()
  await expect(card.getByText('90% 만족', { exact: true })).toBeVisible()
  await expect(card.getByText(/진한식품|주문중/)).toHaveCount(0) // 브랜드와 주문중은 기본형에만 있다
})

test('패션 카테고리는 기본형 카드로 브랜드와 주문중을 보이고, 단위가격과 빠른 배송은 숨긴다', async ({ page }) => {
  await fixture(page)
  await page.goto('/categories/fashion')
  const card = page.getByRole('link', { name: /울 하프코트/ })
  await expect(card).toHaveAttribute('data-variant', 'standard')
  await expect(card.getByText('라온', { exact: true })).toBeVisible()
  await expect(card.getByText('주문중 80', { exact: true })).toBeVisible()
  await expect(card.getByText(/당 .*원\)|오늘출발|무료반품/)).toHaveCount(0)
})

test('세일은 특가형 카드로 할인율과 쿠폰 할인을 앞세운다', async ({ page }) => {
  await fixture(page)
  await page.goto('/sale')
  const card = page.getByRole('link', { name: /울 하프코트/ })
  await expect(card).toHaveAttribute('data-variant', 'deal')
  await expect(card.getByText('지금 34% 할인 중', { exact: true })).toBeVisible()
  await expect(card.getByText('34%', { exact: true })).toBeVisible()
  await expect(card.getByText('쿠폰 3,000원 할인', { exact: true })).toBeVisible()
  await expect(card.getByLabel('90% 만족, 리뷰 100')).toBeVisible()
  await expect(page.getByRole('link', { name: /짜장 라면/ })).toHaveCount(0) // 쿠폰 없는 상품은 세일에 없다
})
