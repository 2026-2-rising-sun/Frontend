import { expect, test, type Page } from '@playwright/test'

// 홈 "요즘 주목 받는 상품": 방송 소개 상품을 한 번에 4개씩, 추천 칸 없이 한 줄로 보여 준다.
const product = (id: number) => ({ productId: id, name: `주목 상품 ${id}`, mainImageUrl: null, price: 10000, salesStatus: 'ON_SALE', available: 5 })

async function fixture(page: Page) {
  await page.route(/\/api\/(member|catalog|commercecore|live|notification)\//, route => {
    const url = new URL(route.request().url()), path = url.pathname
    if (path.endsWith('/broadcasts/11/products')) return route.fulfill({ json: Array.from({ length: 6 }, (_, i) => product(i + 1)) })
    if (path.endsWith('/broadcasts')) {
      const content = url.searchParams.get('status') === 'LIVE' ? [{ id: 11, title: '오늘의 라이브', status: 'LIVE', scheduledAt: '2026-11-15T19:00:00+09:00', playbackUrl: null }] : []
      return route.fulfill({ json: { content, number: 0, size: 5, totalElements: content.length, totalPages: content.length ? 1 : 0 } })
    }
    if (path.endsWith('/catalog/v1/products')) return route.fulfill({ json: { items: [], hasNext: false, nextCursor: null } })
    return route.fulfill({ status: 401 })
  })
}

test('요즘 주목 받는 상품은 4개씩 한 줄로 보이고, 다른 상품 보기로 다음 묶음을 본다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await fixture(page)
  await page.goto('/')
  const section = page.getByRole('region', { name: '요즘 주목 받는 상품' })
  await expect(section.getByText(/^주목 상품 \d$/)).toHaveText(['주목 상품 1', '주목 상품 2', '주목 상품 3', '주목 상품 4'])
  const tops = await section.getByText(/^주목 상품 \d$/).evaluateAll(nodes => nodes.map(node => Math.round(node.closest('article, li, a')!.getBoundingClientRect().top)))
  expect(new Set(tops).size).toBe(1) // 네 카드가 한 줄에 있다

  await section.getByRole('button', { name: /다른 상품 보기/ }).click()
  await expect(section.getByText(/^주목 상품 \d$/)).toHaveText(['주목 상품 5', '주목 상품 6'])
  await expect(page.getByRole('region', { name: '나를 위한 추천 상품' })).toHaveCount(0)
  await expect(page.getByText('다른 상품 추천해드릴게요')).toHaveCount(0)
})
