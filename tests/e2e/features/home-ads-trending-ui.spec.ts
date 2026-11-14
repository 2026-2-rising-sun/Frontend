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
  await page.clock.install({ time: new Date('2026-11-13T03:00:00Z') })
  await page.clock.pauseAt(new Date('2026-11-13T03:00:01Z')) // 자동 넘김이 끼어들지 않게 시계를 멈춘다
  await page.goto('/')
  const section = page.getByRole('region', { name: '조회 급상승, 인기템' })
  const list = section.getByRole('list')
  await expect(list.getByRole('button')).toHaveText(['1인기 상품 1', '2인기 상품 2', '3인기 상품 3', '4인기 상품 4', '5인기 상품 5'])
  const featured = section.getByRole('link', { name: /명이 보고 있어요$/ })
  await expect(featured).toContainText('1,000명이 보고있어요')
  await expect(featured).toContainText('숲내음')
  for (const chip of ['세일', '무료배송', '오늘출발']) await expect(featured.getByText(chip, { exact: true })).toBeVisible()

  await list.getByRole('button', { name: /인기 상품 3$/ }).hover()
  await expect(featured).toContainText('1,000명이 보고있어요') // 마우스만 올려서는 바뀌지 않는다
  await list.getByRole('button', { name: /인기 상품 3$/ }).click()
  await expect(featured).toContainText('980명이 보고있어요')
  await expect(list.getByRole('button', { name: /인기 상품 3$/ })).toHaveAttribute('aria-pressed', 'true')
  await featured.click()
  await expect(page).toHaveURL(/\/products\/3$/)
  await page.goBack()

  await section.getByRole('button', { name: '2페이지' }).click()
  await expect(list.getByRole('button').first()).toHaveText('6인기 상품 6')

  state.updated = true
  await section.getByRole('button', { name: '업데이트' }).click()
  await section.getByRole('button', { name: '1페이지' }).click()
  await expect(list.getByRole('button').first()).toHaveText('1인기 상품 12') // 업데이트 뒤 보는 사람이 늘어난 상품이 1위
})

test('조회 급상승의 큰 상품은 5초마다 다음 순위로 넘어가고, 6위가 되면 순위 목록도 2페이지로 넘어가며, 멈춤 버튼으로 멈춘다', async ({ page }) => {
  await fixture(page)
  await page.clock.install({ time: new Date('2026-11-13T03:00:00Z') })
  await page.clock.pauseAt(new Date('2026-11-13T03:00:01Z'))
  await page.goto('/')
  const section = page.getByRole('region', { name: '조회 급상승, 인기템' })
  const featured = () => section.getByRole('link', { name: /명이 보고 있어요$/ })
  await expect(featured()).toHaveAccessibleName(/^1위 인기 상품 1,/)
  await page.clock.runFor(5000)
  await expect(featured()).toHaveAccessibleName(/^2위 인기 상품 2,/)
  await expect(section.getByRole('list').getByRole('button', { name: /인기 상품 2$/ })).toHaveAttribute('aria-pressed', 'true')
  for (let i = 0; i < 4; i++) await page.clock.runFor(5000)
  await expect(featured()).toHaveAccessibleName(/^6위 인기 상품 6,/)
  await expect(section.getByRole('list').getByRole('button').first()).toHaveText('6인기 상품 6')
  await expect(section.getByRole('button', { name: '2페이지' })).toHaveAttribute('aria-pressed', 'true')

  await section.getByRole('button', { name: '자동 넘김 멈춤' }).click()
  await page.mouse.move(0, 0) // 섹션 밖으로 마우스를 빼도 멈춤은 유지된다
  await page.clock.runFor(15000)
  await expect(featured()).toHaveAccessibleName(/^6위 /)
  await section.getByRole('button', { name: '자동 넘김 다시 시작' }).click()
  await page.mouse.move(0, 0)
  await page.clock.runFor(5000)
  await expect(featured()).toHaveAccessibleName(/^7위 /)
})
