import { expect, test, type Page } from '@playwright/test'

// 카테고리 목록의 정렬(기본 랭킹순)과 무료배송, 가격 필터가 주소와 요청에 담기는지 본다.
const products = [
  { productId: 1, name: '국내산 냉장 삼겹살 1kg', mainImageUrl: null, price: 17300, salesStatus: 'ON_SALE', available: 10, category: 'FOOD', freeShipping: true },
  { productId: 2, name: '제주 감귤 3kg', mainImageUrl: null, price: 9000, salesStatus: 'ON_SALE', available: 10, category: 'FOOD' },
]

async function fixture(page: Page) {
  const requests: URL[] = []
  await page.route(/\/api\/(member|catalog|commercecore|live|notification)\//, route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/catalog/v1/products')) {
      requests.push(url)
      return route.fulfill({ json: { items: products, hasNext: false, nextCursor: null } })
    }
    if (/\/products\/\d+\/coupons$/.test(url.pathname)) return route.fulfill({ json: [] })
    return route.fulfill({ status: 401 })
  })
  return { last: () => requests.at(-1)!.searchParams }
}

test('카테고리 목록은 랭킹순이 기본이고, 정렬 창에서 고른 순서로 다시 불러온다', async ({ page }) => {
  const api = await fixture(page)
  await page.goto('/categories/food')
  const sort = page.getByRole('button', { name: '정렬: 랭킹순' })
  await expect(sort).toBeVisible()
  await expect.poll(() => api.last().get('sort')).toBeNull() // 랭킹순은 계약 기본값으로 요청한다
  await sort.click()
  const dialog = page.getByRole('dialog', { name: '상품 정렬' })
  await expect(dialog.getByRole('radio')).toHaveCount(6)
  await expect(dialog.getByRole('radio', { name: /^랭킹순/ })).toBeChecked()
  await dialog.getByRole('radio', { name: '낮은 가격순' }).click() // 고르면 창이 바로 닫힌다
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(/sort=PRICE_ASC/)
  await expect.poll(() => api.last().get('sort')).toBe('PRICE_ASC')
  await expect(page.getByRole('button', { name: '정렬: 낮은 가격순' })).toBeVisible()
})

test('무료배송과 가격 필터는 요청과 주소에 담기고, 가격은 오른쪽 필터 창에서 고른다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const api = await fixture(page)
  await page.goto('/categories/food')
  const chips = page.getByRole('group', { name: '상품 필터' })
  await chips.getByRole('button', { name: '무료배송' }).click()
  await expect(chips.getByRole('button', { name: '무료배송' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => api.last().get('freeShipping')).toBe('true')
  await chips.getByRole('button', { name: '가격' }).click()
  const drawer = page.getByRole('dialog', { name: '필터' })
  // 화면 오른쪽에 붙는다(밀려 들어오는 동작이 끝난 뒤 확인)
  await expect.poll(async () => { const box = await drawer.boundingBox(); return box && Math.round(box.x + box.width) }).toBe(1280)
  await drawer.getByRole('radio', { name: '1만원 ~ 2만원' }).check()
  await expect.poll(() => [api.last().get('minPrice'), api.last().get('maxPrice')]).toEqual(['10000', '20000'])
  await drawer.getByRole('radio', { name: '직접입력' }).check()
  await drawer.getByLabel('최소 가격(원)').fill('30000')
  await drawer.getByLabel('최대 가격(원)').fill('20000')
  await drawer.getByRole('button', { name: '적용' }).click()
  await expect(drawer.getByRole('alert')).toHaveText('최소 가격이 최대 가격보다 클 수 없어요.')
  await drawer.getByLabel('최대 가격(원)').fill('50000')
  await drawer.getByRole('button', { name: '적용' }).click()
  await expect.poll(() => [api.last().get('minPrice'), api.last().get('maxPrice')]).toEqual(['30000', '50000'])
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(chips.getByRole('button', { name: '가격: 30,000원 ~ 50,000원' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/free=1.*min=30000.*max=50000|min=30000.*max=50000.*free=1/)
  await chips.getByRole('button', { name: /^가격/ }).click()
  await drawer.getByRole('button', { name: '가격 필터 초기화' }).click()
  await expect.poll(() => api.last().get('minPrice')).toBeNull()
})

test('카테고리 화면의 칩은 그 분류의 세부 카테고리이고, 고르면 세부 분류로 다시 불러온다', async ({ page }) => {
  const api = await fixture(page)
  await page.goto('/categories/food?sort=PRICE_ASC')
  const chips = page.getByRole('navigation', { name: '식품 세부 카테고리' })
  await expect(chips.getByRole('link')).toHaveText(['전체', '쌀/과일/농축수산물', '가공식품', '음료/생수/커피'])
  await expect(chips.getByRole('link', { name: '전체' })).toHaveAttribute('aria-current', 'page')
  await chips.getByRole('link', { name: '가공식품' }).click()
  await expect(page).toHaveURL(/sub=processed/)
  await expect(page).toHaveURL(/sort=PRICE_ASC/) // 정렬은 그대로 둔다
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('가공식품')
  await expect.poll(() => api.last().get('subcategory')).toBe('processed')
  await expect(chips.getByRole('link', { name: '가공식품' })).toHaveAttribute('aria-current', 'page')
  await chips.getByRole('link', { name: '전체' }).click()
  await expect.poll(() => api.last().get('subcategory')).toBeNull()
})
