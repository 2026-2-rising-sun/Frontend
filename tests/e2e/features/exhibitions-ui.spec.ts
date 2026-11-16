import { expect, test, type Page } from '@playwright/test'

// 기획전 목록(/exhibitions): 분류 칸, 진행 중 카드. 기획전 화면(/exhibitions/:id): 큰 배너, 묶음 탭, 상품 카드, 종료 안내
const product = (id: number, name: string) => ({ productId: id, name, mainImageUrl: null, price: 10000, salesStatus: 'ON_SALE', available: 5 })
const summary = (id: string, title: string, category: string) => ({ id, title, headline: [title], description: '설명', art: ['🎁'], tone: 'blush', category, startsAt: '2026-11-01T00:00:00+09:00', endsAt: '2026-11-30T23:59:00+09:00' })
const exhibition = (id: string, endsAt: string) => ({
  id, title: '겨울 보습 기획전', headline: ['겨울', '보습'], description: '본품 증정 특별주간!', art: ['🧴', '🌿'], tone: 'lavender', startsAt: '2026-11-01T00:00:00+09:00', endsAt,
  sections: [
    { title: '수분결 단독', products: [product(1, '수분 크림'), product(2, '수분 토너')] },
    { title: '스킨케어', products: [product(3, '약산성 클렌저')] },
    { title: '빈 묶음', products: [] },
  ],
})

async function fixture(page: Page) {
  await page.route(/\/api\/(member|catalog|commercecore|live|notification)\//, route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/catalog/v1/exhibitions')) return route.fulfill({ json: [
      { ...summary('winter', '겨울 보습 기획전', 'BEAUTY'), previewProducts: [{ ...product(1, '수분 크림'), brandName: '수분결', originalPrice: 15000 }, product(2, '수분 토너'), product(3, '약산성 클렌저')] },
      { ...summary('strawberry', '딸기 간식 선물전', 'FOOD'), previewProducts: [product(4, '설향 딸기')] },
      { ...summary('autumn', '가을 기획전', 'FOOD'), endsAt: '2026-11-10T23:59:00+09:00', previewProducts: [] }, // 끝난 기획전은 빼고 보인다
    ] })
    if (path.endsWith('/exhibitions/winter')) return route.fulfill({ json: exhibition('winter', '2026-11-30T23:59:00+09:00') })
    if (path.endsWith('/exhibitions/autumn')) return route.fulfill({ json: exhibition('autumn', '2026-11-10T23:59:00+09:00') })
    if (path.endsWith('/exhibitions/nothing')) return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: '기획전을 찾을 수 없어요.' } })
    return route.fulfill({ status: 404 })
  })
}

test('상단바 기획전에서 진행 중인 기획전 카드를 보고, 분류를 고르고, 배너를 눌러 들어간다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T03:00:00Z') })
  await fixture(page)
  await page.goto('/')
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '기획전', exact: true }).click()
  await expect(page).toHaveURL(/\/exhibitions$/)
  await expect(page.getByRole('heading', { level: 1, name: '기획전' })).toBeVisible()
  const list = page.getByRole('region', { name: '지금 진행 중인 행사예요' })
  await expect(list.getByRole('article')).toHaveCount(2)
  const winter = list.getByRole('article', { name: '겨울 보습 기획전' })
  await expect(winter.getByRole('link', { name: /수분 크림/ })).toHaveAttribute('href', '/products/1')
  await expect(winter.getByRole('link', { name: /약산성 클렌저/ })).toHaveCount(0) // 대표 상품은 두 개만
  await expect(winter.getByText('수분결')).toBeVisible()
  await expect(winter.getByLabel('할인 전 15,000원')).toBeVisible()

  const filters = page.getByRole('group', { name: '기획전 분류' })
  await expect(filters.getByRole('button', { name: '전체' })).toHaveAttribute('aria-pressed', 'true')
  await filters.getByRole('button', { name: '식품' }).click()
  await expect(page).toHaveURL(/category=food/)
  await expect(list.getByRole('article')).toHaveText([/딸기 간식 선물전|설향 딸기/])
  await filters.getByRole('button', { name: '패션' }).click()
  await expect(list.getByText('진행 중인 기획전이 없어요')).toBeVisible()
  await filters.getByRole('button', { name: '전체' }).click()

  await winter.getByRole('link', { name: /겨울 보습 기획전/ }).click()
  await expect(page).toHaveURL(/\/exhibitions\/winter$/)
  await expect(page.getByRole('heading', { level: 1, name: '겨울 보습 기획전' })).toBeVisible()
})

test('기획전은 기간과 묶음을 보여 주고, 탭을 누르면 그 묶음 상품만 보인다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T03:00:00Z') })
  await fixture(page)
  await page.goto('/exhibitions/winter')
  await expect(page.getByRole('heading', { level: 1, name: '겨울 보습 기획전' })).toBeVisible()
  await expect(page.getByText('11/1 ~ 11/30')).toBeVisible()
  const tabs = page.getByRole('tablist', { name: '기획전 묶음' })
  await expect(tabs.getByRole('tab')).toHaveText(['전체', '수분결 단독', '스킨케어']) // 상품이 없는 묶음은 뺀다
  await expect(page.getByRole('region', { name: '수분결 단독' })).toBeVisible()
  await expect(page.getByRole('region', { name: '스킨케어' })).toBeVisible()

  await tabs.getByRole('tab', { name: '스킨케어' }).click()
  await expect(page.getByRole('region', { name: '수분결 단독' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '스킨케어' }).getByText('약산성 클렌저')).toBeVisible()
  await page.getByText('약산성 클렌저').click()
  await expect(page).toHaveURL(/\/products\/3$/)
})

test('끝난 기획전은 상품 대신 종료 안내를 보여 준다', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T03:00:00Z') })
  await fixture(page)
  await page.goto('/exhibitions/autumn')
  await expect(page.getByText('종료된 기획전이에요')).toBeVisible()
  await expect(page.getByRole('tablist')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '기획전 목록' })).toHaveAttribute('href', '/exhibitions')
})

test('없는 기획전은 찾을 수 없다고 알려 준다', async ({ page }) => {
  await fixture(page)
  await page.goto('/exhibitions/nothing')
  await expect(page.getByText('찾을 수 없어요', { exact: true })).toBeVisible()
})
