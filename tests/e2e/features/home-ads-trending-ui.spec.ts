import { expect, test, type Page } from '@playwright/test'

// 홈의 "Today's Brand" 기획전 카드(2개씩 3페이지)와 맨 아래 "조회 급상승, 인기템"(보는 사람 수 순위, 업데이트, 2페이지)
const product = (id: number, name: string, viewingCount: number, extra = {}) => ({ productId: id, name, mainImageUrl: null, price: 10000, salesStatus: 'ON_SALE', available: 5, viewingCount, ...extra })
const HEADLINES = [['11월 베리PICK', '&수분크림 1+1'], ['겨울 아우터는', '지금 준비할 때'], ['11월 간식선물', '센스있게!'], ['캠핑 가기 좋은 날', '최대 40% 할인'], ['무선으로', '더 자유롭게'], ['라이브로 만나는', '겨울 가전 특가']]
const preview = (i: number) => [product(100 + i, `대표 상품 ${i}`, 0, { liveDeal: { broadcastId: 7, broadcastTitle: '겨울 특집 라이브', discount: 1000, startsAt: '2026-01-01T00:00:00Z', endsAt: '2030-01-01T00:00:00Z' } }), product(200 + i, `줄 상품 ${i}-1`, 0), product(300 + i, `줄 상품 ${i}-2`, 0)]
const exhibitions = HEADLINES.map((headline, i) => ({ id: `ex-${i + 1}`, title: `기획전 ${i + 1}`, headline, description: '설명', art: ['🎁'], tone: 'mint', startsAt: '2026-11-01T00:00:00Z', endsAt: '2030-11-30T14:59:00Z', previewProducts: preview(i + 1) }))

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
    if (url.pathname.endsWith('/catalog/v1/exhibitions')) return route.fulfill({ json: exhibitions })
    return route.fulfill({ status: 401 })
  })
  return state
}

test('Today’s Brand 는 기획전 카드를 2개씩 보여 주고, 카드마다 대표 상품, 상품 두 줄, 더보기로 이어진다', async ({ page }) => {
  await fixture(page)
  await page.goto('/')
  const ads = page.getByRole('region', { name: /Today/ })
  await expect(ads.getByRole('article')).toHaveCount(2)
  const card = ads.getByRole('article', { name: '기획전 1' })
  await expect(card.getByRole('link').first()).toContainText('11월 베리PICK')
  await expect(card.getByText('대표 상품 1')).toBeVisible()
  await expect(card.getByText('베리특가').first()).toBeVisible()
  await expect(card.getByRole('link', { name: /겨울 특집 라이브/ })).toHaveAttribute('href', '/lives/7')
  await expect(card.getByText(/^줄 상품 1-\d$/)).toHaveText(['줄 상품 1-1', '줄 상품 1-2'])
  await expect(ads.getByRole('button', { name: '1페이지' })).toHaveAttribute('aria-pressed', 'true')
  await ads.getByRole('button', { name: '3페이지' }).click()
  await expect(ads.getByRole('article')).toHaveCount(2)
  await expect(ads.getByRole('article').first()).toContainText('무선으로')
  await ads.getByRole('article', { name: '기획전 5' }).getByRole('link', { name: /기획전 5 상품 더보기/ }).click()
  await expect(page).toHaveURL(/\/exhibitions\/ex-5$/)
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

test('브랜드 띠 배너는 주목 상품 아래와 조회 급상승 위에 하나씩 있고, 누르면 그 브랜드 상품 검색으로 간다', async ({ page }) => {
  await fixture(page)
  await page.goto('/')
  const banners = page.getByRole('complementary', { name: '브랜드 광고' })
  await expect(banners).toHaveCount(2)
  await expect(banners.nth(0)).toContainText('단계별 피부 보습, 수분결')
  await expect(banners.nth(0)).toContainText('#수분케어')
  await expect(banners.nth(1)).toContainText('코지홈')
  // 두 번째 배너는 조회 급상승 바로 위에 있다
  const below = await page.getByRole('region', { name: '조회 급상승, 인기템' }).boundingBox()
  const living = await banners.nth(1).boundingBox()
  expect(living!.y).toBeLessThan(below!.y)
  await banners.nth(0).getByRole('link').click()
  await expect(page).toHaveURL(/\/\?q=%EC%88%98%EB%B6%84%EA%B2%B0$/)
})
