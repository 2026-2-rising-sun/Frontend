import { expect, test, type Page } from '@playwright/test'

// 홈과 카테고리는 상품 번호로 카드 종류를 섞는다(1 기본형, 2, 3 가성비형, 5 간결형, 6 특가형).
// 모든 카드에 만족도와 주문중이 있고, 구경중은 베리특가(라이브 한정 쿠폰 기간)일 때만, 단위가격은 식품에만 붙는다.
const liveDeal = { broadcastId: 7, broadcastTitle: '겨울 특가 라이브', discount: 2000, startsAt: '2020-01-01T00:00:00Z', endsAt: '2099-01-01T00:00:00Z' }
const base = { mainImageUrl: null, salesStatus: 'ON_SALE', available: 10, satisfaction: { veryGood: 70, good: 20, bad: 6, veryBad: 4 }, orderingCount: 120, viewingCount: 340 }
const products = [
  { ...base, productId: 1, name: '울 하프코트', price: 99000, originalPrice: 150000, category: 'FASHION', brandName: '라온', liveDeal },
  { ...base, productId: 5, name: '니트 장갑', price: 19000, category: 'FASHION', deliveryType: 'TODAY', liveDeal },
  { ...base, productId: 6, name: '램스울 머플러', price: 39000, originalPrice: 60000, category: 'FASHION', liveDeal },
  { ...base, productId: 4, name: '데님 팬츠', price: 49000, category: 'FASHION' },
  { ...base, productId: 2, name: '짜장 라면 140g X 5팩', price: 5300, category: 'FOOD', freeShipping: true, freeReturn: true, deliveryType: 'DAWN', netContent: { amount: 700, unit: 'g' }, packCount: 5 },
  { ...base, productId: 3, name: '호텔 수건 5장', price: 25000, category: 'LIVING', freeReturn: true, netContent: { amount: 5, unit: '개' }, packCount: 5 },
]

async function fixture(page: Page) {
  await page.route(/\/api\/(member|catalog|commercecore|live|notification)\//, route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/catalog/v1/products')) {
      const category = url.searchParams.get('category')
      return route.fulfill({ json: { items: products.filter(p => !category || p.category === category), hasNext: false, nextCursor: null } })
    }
    if (/\/products\/\d+\/coupons$/.test(url.pathname)) return route.fulfill({ json: [] })
    return route.fulfill({ status: 401 })
  })
}
const card = (page: Page, name: string) => page.getByRole('link', { name: new RegExp(name) })

test('카테고리 카드는 상품마다 종류가 섞이고, 모든 카드에 만족도와 주문중이 있으며 구경중은 베리특가일 때만 있다', async ({ page }) => {
  await fixture(page)
  await page.goto('/categories/fashion')
  for (const [name, variant] of [['울 하프코트', 'standard'], ['니트 장갑', 'compact'], ['램스울 머플러', 'deal'], ['데님 팬츠', 'standard']]) {
    const item = card(page, name)
    await expect(item).toHaveAttribute('data-variant', variant)
    await expect(item.getByText('주문중 120', { exact: true })).toBeVisible()
    await expect(item.getByText(/90%/).first()).toBeVisible()
  }
  for (const name of ['울 하프코트', '니트 장갑', '램스울 머플러']) {
    await expect(card(page, name).getByText('구경중 340', { exact: true })).toBeVisible()
  }
  await expect(card(page, '데님 팬츠').getByText(/구경중|베리특가/)).toHaveCount(0)
  await expect(card(page, '램스울 머플러').getByText(/^베리특가/)).toBeVisible() // 특가형 맨 위 문구
  await expect(card(page, '니트 장갑').getByText('오늘출발', { exact: true })).toBeVisible()
  for (const name of ['울 하프코트', '니트 장갑']) await expect(card(page, name).getByText('베리특가', { exact: true })).toBeVisible()
})

test('가성비형 카드는 묶음 수와 혜택을 보이고, 100g당 같은 단위가격은 식품에만 붙인다', async ({ page }) => {
  await fixture(page)
  await page.goto('/categories/food')
  const food = card(page, '짜장 라면')
  await expect(food).toHaveAttribute('data-variant', 'value')
  await expect(food.getByText('5개', { exact: true })).toBeVisible()
  await expect(food.getByText('(100g당 757원)', { exact: true })).toBeVisible()
  for (const label of ['새벽도착', '무료배송', '무료반품', '주문중 120', '90% 만족']) await expect(food.getByText(label, { exact: true })).toBeVisible()
  await expect(food.getByText('구경중', { exact: false })).toHaveCount(0)

  await page.goto('/categories/living')
  const living = card(page, '호텔 수건')
  await expect(living).toHaveAttribute('data-variant', 'value')
  await expect(living.getByText('5개', { exact: true })).toBeVisible()
  await expect(living.getByText(/당 .*원\)/)).toHaveCount(0)
})
