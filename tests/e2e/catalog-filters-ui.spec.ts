import { test, expect } from '@playwright/test'

const product = (id: number, name: string) => ({ productId: id, name, mainImageUrl: null, price: id * 1000, salesStatus: 'ON_SALE', purchasable: true })
const envelope = (data: unknown) => ({ success: true, data, error: null })

test('검색·상태·정렬 조건을 서버에 전달하고 더 보기와 조건 변경에서 커서를 관리한다', async ({ page }) => {
  const requests: URL[] = []
  await page.route(/\/api\/(member|commercecore|catalog|live|notification)\//, async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/catalog/v1/products')) {
      // 홈의 추천 상품 칸도 상품 목록을 조회하므로 검색 목록 요청만 기록한다.
      if (url.searchParams.has('q')) requests.push(url)
      const next = url.searchParams.has('cursor')
      return route.fulfill({ json: envelope({ items: [product(next ? 2 : 1, next ? '니트 두 번째' : '니트 첫 번째')], hasNext: !next, nextCursor: next ? null : 'next-cursor' }) })
    }
    if (url.pathname.endsWith('/live/v1/broadcasts')) return route.fulfill({ json: envelope({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 6 }) })
    return route.fulfill({ status: 401 })
  })
  await page.goto('/?q=니트')
  await expect(page.locator('#products').getByRole('link', { name: /니트 첫 번째/ })).toBeVisible()
  await page.getByLabel('정렬 기준').selectOption('PRICE_ASC')
  await expect.poll(() => requests.at(-1)?.searchParams.get('sort')).toBe('PRICE_ASC')
  await page.getByRole('button', { name: '판매 중', exact: true }).click()
  await expect.poll(() => requests.at(-1)?.searchParams.get('status')).toBe('ON_SALE')
  await page.getByRole('button', { name: '더 보기', exact: true }).click()
  await expect(page.locator('#products').getByRole('link', { name: /니트 두 번째/ })).toBeVisible()
  expect(requests.at(-1)?.searchParams.get('q')).toBe('니트')
  expect(requests.at(-1)?.searchParams.get('cursor')).toBe('next-cursor')
  await page.getByLabel('정렬 기준').selectOption('PRICE_DESC')
  await expect.poll(() => requests.at(-1)?.searchParams.get('sort')).toBe('PRICE_DESC')
  expect(requests.at(-1)?.searchParams.has('cursor')).toBe(false)
  await expect(page.locator('#products').getByRole('link', { name: /니트 두 번째/ })).toHaveCount(0)
})

test('이전 조건의 지연된 더 보기 응답이 새 목록이나 새 조건 더 보기를 막지 않는다', async ({ page }) => {
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  let oldMore = false
  await page.route(/\/api\/(member|commercecore|catalog|live|notification)\//, async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/catalog/v1/products')) {
      const descending = url.searchParams.get('sort') === 'PRICE_DESC'
      const more = url.searchParams.has('cursor')
      if (more && !descending) { oldMore = true; await held }
      const name = descending ? (more ? '새 목록 다음 상품' : '새 목록 첫 상품') : (more ? '이전 조건 늦은 상품' : '이전 목록 상품')
      return route.fulfill({ json: envelope({ items: [product(more ? 2 : 1, name)], hasNext: !more, nextCursor: more ? null : 'next' }) })
    }
    if (url.pathname.endsWith('/live/v1/broadcasts')) return route.fulfill({ json: envelope({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 6 }) })
    return route.fulfill({ status: 401 })
  })
  await page.goto('/')
  await expect(page.locator('#products').getByRole('link', { name: /이전 목록 상품/ })).toBeVisible()
  await page.getByRole('button', { name: '더 보기', exact: true }).click()
  await expect.poll(() => oldMore).toBe(true)
  await page.getByLabel('정렬 기준').selectOption('PRICE_DESC')
  await expect(page.locator('#products').getByRole('link', { name: /새 목록 첫 상품/ })).toBeVisible()
  await page.getByRole('button', { name: '더 보기', exact: true }).click()
  await expect(page.locator('#products').getByRole('link', { name: /새 목록 다음 상품/ })).toBeVisible()
  release()
  await page.waitForResponse(response => response.url().includes('/catalog/v1/products') && new URL(response.url()).searchParams.get('sort') === 'LATEST')
  await expect(page.locator('#products').getByRole('link', { name: /이전 조건 늦은 상품/ })).toHaveCount(0)
})

test('라이브 시간표는 진행 중과 예정 방송을 서버 상태 필터로 함께 조회해 진행 중을 먼저 보여 준다', async ({ page }) => {
  const requests: URL[] = []
  await page.route(/\/api\/(member|commercecore|catalog|live|notification)\//, async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/live/v1/broadcasts')) {
      requests.push(url)
      const state = url.searchParams.get('status')
      return route.fulfill({ json: envelope({ content: [{ id: state === 'PREPARING' ? 2 : 1, title: state === 'PREPARING' ? '예정 방송' : '진행 방송', status: state, scheduledAt: new Date().toISOString() }], totalElements: 1, totalPages: 1, number: 0, size: 6 }) })
    }
    return route.fulfill({ status: 401 })
  })
  await page.goto('/lives')
  await expect(page.getByRole('link', { name: /예정 방송/ })).toBeVisible()
  const titles = await page.locator('a[href^="/lives/"]').allInnerTexts()
  expect(titles[0]).toContain('진행 방송')
  expect(titles[1]).toContain('예정 방송')
  // 개발 모드(StrictMode)에서는 같은 요청이 두 번 갈 수 있어 종류만 비교한다.
  expect([...new Set(requests.map(url => `${url.searchParams.get('status')}:${url.searchParams.get('page')}`))].toSorted()).toEqual(['LIVE:0', 'PREPARING:0'])
})
