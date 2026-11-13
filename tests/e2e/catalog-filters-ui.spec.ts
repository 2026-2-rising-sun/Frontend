import { test, expect } from '@playwright/test'

const product = (id: number, name: string) => ({ productId: id, name, mainImageUrl: null, price: id * 1000, salesStatus: 'ON_SALE', purchasable: true })
const envelope = (data: unknown) => ({ success: true, data, error: null })

test('검색·상태·정렬 조건을 서버에 전달하고 무한 스크롤과 조건 변경에서 커서를 관리한다', async ({ page }) => {
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
  /** from 번째 이후 요청 중 첫 묶음(커서 없음)과 이어 부른 묶음(커서 있음) */
  const after = (from: number) => ({ first: requests.slice(from).find(url => !url.searchParams.has('cursor')), more: requests.slice(from).find(url => url.searchParams.has('cursor')) })
  await page.goto('/?q=니트')
  // 목록 끝이 화면에 들어오면 버튼 없이 다음 묶음을 이어서 불러온다.
  await expect(page.locator('#products').getByRole('link', { name: /니트 두 번째/ })).toBeVisible()
  expect(after(0).more?.searchParams.get('cursor')).toBe('next-cursor')
  expect(after(0).more?.searchParams.get('q')).toBe('니트')
  let from = requests.length
  await page.getByLabel('정렬 기준').selectOption('PRICE_ASC')
  await expect.poll(() => after(from).first?.searchParams.get('sort')).toBe('PRICE_ASC')
  await expect.poll(() => after(from).more?.searchParams.get('sort')).toBe('PRICE_ASC')
  from = requests.length
  await page.getByRole('button', { name: '판매 중', exact: true }).click()
  await expect.poll(() => after(from).first?.searchParams.get('status')).toBe('ON_SALE')
  await expect.poll(() => after(from).more?.searchParams.get('status')).toBe('ON_SALE')
  from = requests.length
  await page.getByLabel('정렬 기준').selectOption('PRICE_DESC')
  // 조건이 바뀌면 커서 없이 첫 묶음부터 다시 부른다.
  await expect.poll(() => requests[from]?.searchParams.get('sort')).toBe('PRICE_DESC')
  expect(requests[from].searchParams.has('cursor')).toBe(false)
})

test('이전 조건의 지연된 추가 조회 응답이 새 목록이나 새 조건의 추가 조회를 막지 않는다', async ({ page }) => {
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
  await page.goto('/?q=상품')
  await expect(page.locator('#products').getByRole('link', { name: /이전 목록 상품/ })).toBeVisible()
  // 목록 끝이 보이므로 다음 묶음 요청이 자동으로 나가고, 그 응답은 잡아 둔다.
  await expect.poll(() => oldMore).toBe(true)
  await page.getByLabel('정렬 기준').selectOption('PRICE_DESC')
  await expect(page.locator('#products').getByRole('link', { name: /새 목록 첫 상품/ })).toBeVisible()
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
