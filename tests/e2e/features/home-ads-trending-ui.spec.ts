import { expect, test, type Page } from '@playwright/test'

// 홈의 "오직 베리온에서만" 광고(3개씩 2페이지)와 맨 아래 "조회 급상승, 인기템"(보는 사람 수 순위, 업데이트, 2페이지)
const product = (id: number, name: string, viewingCount: number, extra = {}) => ({ productId: id, name, mainImageUrl: null, price: 10000, salesStatus: 'ON_SALE', available: 5, viewingCount, ...extra })

async function fixture(page: Page) {
  const state = { updated: false }
  await page.route(/\/api\/(member|catalog|commercecore|live|notification)\//, route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/catalog/v1/products') && url.searchParams.get('size') === '50') {
      // 업데이트를 누른 뒤에는 순위가 바뀐다.
      const items = Array.from({ length: 12 }, (_, i) => product(i + 1, `인기 상품 ${i + 1}`, state.updated && i === 11 ? 9999 : 1000 - i * 10,
        i === 0 ? { brandName: '숲내음', originalPrice: 15000, freeShipping: true, deliveryType: 'TODAY' } : {}))
      return route.fulfill({ json: { items, hasNext: false, nextCursor: null } })
    }
    if (url.pathname.endsWith('/catalog/v1/products')) return route.fulfill({ json: { items: [], hasNext: false, nextCursor: null } })
    return route.fulfill({ status: 401 })
  })
  return state
}

test('오직 베리온에서만 광고는 3개씩 보이고, 페이지 번호를 누르면 다음 3개가 보인다', async ({ page }) => {
  await fixture(page)
  await page.goto('/')
  const ads = page.getByRole('region', { name: '오직 베리온에서만' })
  await expect(ads.getByRole('link')).toHaveCount(3)
  await expect(ads.getByRole('link').first()).toContainText('11월 베리PICK')
  await expect(ads.getByRole('button', { name: '1페이지' })).toHaveAttribute('aria-pressed', 'true')
  await ads.getByRole('button', { name: '2페이지' }).click()
  await expect(ads.getByRole('link')).toHaveCount(3)
  await expect(ads.getByRole('link').first()).toContainText('캠핑 가기 좋은 날')
  await ads.getByRole('link', { name: /무선으로/ }).click()
  await expect(page).toHaveURL(/\/categories\/digital\?sub=audio$/)
})

test('조회 급상승은 보는 사람이 많은 순서로 5개씩 보이고, 고른 순위의 상품을 크게 보여 주며, 업데이트로 다시 불러온다', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/')
  const section = page.getByRole('region', { name: '조회 급상승, 인기템' })
  const list = section.getByRole('list')
  await expect(list.getByRole('link')).toHaveText(['1인기 상품 1', '2인기 상품 2', '3인기 상품 3', '4인기 상품 4', '5인기 상품 5'])
  const featured = section.getByRole('link', { name: /명이 보고 있어요$/ })
  await expect(featured).toContainText('1,000명이 보고있어요')
  await expect(featured).toContainText('숲내음')
  for (const chip of ['세일', '무료배송', '오늘출발']) await expect(featured.getByText(chip, { exact: true })).toBeVisible()

  await list.getByRole('link', { name: /인기 상품 3$/ }).hover()
  await expect(featured).toContainText('980명이 보고있어요')
  await expect(list.getByRole('link', { name: /인기 상품 3$/ })).toHaveAttribute('aria-current', 'true')

  await section.getByRole('button', { name: '2페이지' }).click()
  await expect(list.getByRole('link').first()).toHaveText('6인기 상품 6')

  state.updated = true
  await section.getByRole('button', { name: '업데이트' }).click()
  await section.getByRole('button', { name: '1페이지' }).click()
  await expect(list.getByRole('link').first()).toHaveText('1인기 상품 12') // 업데이트 뒤 보는 사람이 늘어난 상품이 1위
})
