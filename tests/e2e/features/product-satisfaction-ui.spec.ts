import { expect, test, type Page } from '@playwright/test'

// 브랜드, 원가(베리특가), 만족도, 무료배송, 옵션은 아직 Backend 계약에 없는 표시용 필드다. 값이 있을 때와 없을 때를 함께 본다.
const products = [
  { productId: 1, name: '바른 도가니탕 500g X 4팩', mainImageUrl: null, price: 11900, salesStatus: 'ON_SALE', available: 30, category: 'FOOD', subcategory: 'processed', brandName: '진한식품', originalPrice: 27600,
    satisfaction: { veryGood: 66, good: 10, bad: 14, veryBad: 10 }, freeShipping: true, orderingCount: 2459, viewingCount: 2603,
    liveDeal: { broadcastId: 12, broadcastTitle: '겨울 특가 라이브', discount: 3000, startsAt: '2026-11-03T08:00:00Z', endsAt: '2099-11-16T14:59:00Z' },
    options: [
      { name: '컬러', values: [{ label: '블랙', extraPrice: 0, soldOut: false }, { label: '화이트', extraPrice: 0, soldOut: true }] },
      { name: '구성', values: [{ label: '1개', extraPrice: 0, soldOut: false }, { label: '2개 세트', extraPrice: 10000, soldOut: false }] },
    ] },
  { productId: 2, name: '필드 없는 상품', mainImageUrl: null, price: 18000, salesStatus: 'ON_SALE', available: 5 },
  // 라이브 할인이 끝난 상품: 베리특가, 구경중 없이 주문중만 보인다.
  { productId: 3, name: '할인 끝난 상품', mainImageUrl: null, price: 20000, salesStatus: 'ON_SALE', available: 5, originalPrice: 25000, orderingCount: 120, viewingCount: 300,
    liveDeal: { broadcastId: 11, broadcastTitle: '지난 라이브', discount: 2000, startsAt: '2020-01-01T00:00:00Z', endsAt: '2020-01-03T00:00:00Z' } },
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
  await expect(card.getByLabel('할인 전 27,600원')).toBeVisible()
  await expect(card.getByText('베리특가', { exact: true })).toBeVisible()
  await expect(card).toContainText('8,900원') // 11,900원에서 라이브 쿠폰 3,000원
  await expect(card.getByText('주문중 2,459', { exact: true })).toBeVisible()
  await expect(card.getByText('구경중 2,603', { exact: true })).toBeVisible()
  await expect(card.getByText('76% 만족', { exact: true })).toBeVisible()
  await expect(card.getByText('리뷰 100', { exact: true })).toBeVisible()
  await expect(card.getByText('무료배송', { exact: true })).toBeVisible()
  const plain = page.getByRole('link', { name: /필드 없는 상품/ })
  await expect(plain).toContainText('18,000원')
  await expect(plain.getByText(/베리특가|만족|리뷰|무료배송|주문중|구경중/)).toHaveCount(0)
  const ended = page.getByRole('link', { name: /할인 끝난 상품/ })
  await expect(ended.getByLabel('할인 전 25,000원')).toBeVisible()
  await expect(ended).toContainText('20,000원')
  await expect(ended.getByText('주문중 120', { exact: true })).toBeVisible()
  await expect(ended.getByText(/베리특가|구경중/)).toHaveCount(0)
})

test('상품 상세의 상품 만족도는 만족 비율과 4단계 비율을 보여 주고 리뷰 수를 누르면 이동한다', async ({ page }) => {
  await fixture(page)
  await page.goto('/products/1')
  await expect(page.getByText('2,459개 주문중', { exact: true })).toBeVisible()
  await expect(page.getByText('2,603명 구경중', { exact: true })).toBeVisible()
  await expect(page.getByText('베리특가 안내', { exact: true })).toBeVisible()
  await expect(page.getByText(/^11\/3 17:00 ~ 11\/16 23:59 까지 한정할인$/)).toBeVisible()
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
  await page.goto('/products/3')
  await expect(page.getByText('120개 주문중', { exact: true })).toBeVisible()
  await expect(page.getByText(/구경중|베리특가/)).toHaveCount(0)
})

test('옵션이 있는 상품은 모든 옵션을 골라야 구매할 수 있고, 추가 금액이 총 상품 금액에 더해진다', async ({ page }) => {
  await fixture(page)
  await page.goto('/products/1')
  const options = page.getByRole('group', { name: '옵션 선택' })
  await expect(page.getByText('옵션을 모두 선택해 주세요', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '바로 구매', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '장바구니 담기', exact: true })).toBeDisabled()
  await expect(options.getByRole('option', { name: '화이트 (품절)' })).toHaveAttribute('disabled')
  await options.getByRole('combobox', { name: '컬러' }).selectOption({ label: '블랙' })
  await options.getByRole('combobox', { name: '구성' }).selectOption({ label: '2개 세트 (+10,000원)' })
  await expect(page.getByText('선택한 옵션: 블랙, 2개 세트', { exact: true })).toBeVisible()
  await expect(page.getByText('21,900원', { exact: true }).last()).toBeVisible() // 11,900원 + 10,000원
  await expect(page.getByRole('link', { name: '바로 구매', exact: true })).toBeVisible()
  await expect(page.getByText(/재고/)).toHaveCount(0)
  await page.goto('/products/2')
  await expect(page.getByRole('group', { name: '옵션 선택' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '바로 구매', exact: true })).toBeVisible()
})

test('상단 카테고리를 누르면 전체 분류가 펼쳐지고, 상품 상세 위치에는 상품의 분류가 보인다', async ({ page }) => {
  await fixture(page)
  await page.goto('/products/1')
  const crumb = page.getByRole('navigation', { name: '현재 위치' })
  await expect(crumb.getByRole('link', { name: '식품', exact: true })).toHaveAttribute('href', '/categories/food')
  await expect(crumb.getByRole('link', { name: '가공식품', exact: true })).toHaveAttribute('href', '/categories/food?sub=processed')
  await expect(crumb.getByText('상품 상세', { exact: true })).toHaveCount(0)
  const account = page.getByRole('navigation', { name: '계정 메뉴' })
  const button = account.getByRole('button', { name: '카테고리' })
  await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  const panel = page.locator('#category-menu')
  // 분류 5개 아래에 세부 분류가 펼쳐진다. 키즈, 기타 분류와 "기타" 세부 분류는 없다.
  await expect(panel.getByRole('list', { name: /세부 카테고리$/ })).toHaveCount(5)
  await expect(panel.getByRole('list', { name: '식품 세부 카테고리' }).getByRole('link')).toHaveText(['쌀/과일/농축수산물', '가공식품', '음료/생수/커피'])
  await expect(panel.getByRole('link', { name: /^키즈|기타/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await button.click()
  await panel.getByRole('link', { name: '주방/식기/용기' }).click()
  await expect(page).toHaveURL(/\/categories\/living\?sub=kitchen$/)
  await expect(panel).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '생활', exact: true })).toHaveClass(/active/)
  await page.goto('/products/2')
  await expect(page.getByRole('navigation', { name: '현재 위치' })).toContainText('상품 상세')
})
