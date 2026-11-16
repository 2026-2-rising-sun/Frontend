import { expect, test, type Page } from '@playwright/test'

// 홈 "Today's Brand" 왼쪽의 선착순 쿠폰: 검은 쿠폰 버튼(금액, 남은 시간), 알림 받기. 받을 수 있는 쿠폰을 먼저 내세운다.
const NOW = '2026-11-16T03:00:00Z' // 12:00(한국 시간)
const drops = [
  { couponId: 9001, name: '뷰티 쿠폰', fixedDiscount: 5000, condition: '뷰티 3만원 이상', opensAt: '2026-11-16T05:00:00Z', endsAt: '2026-11-16T14:59:00Z', issuanceLimit: 100, remaining: 100 },
  { couponId: 9002, name: '식품 쿠폰', fixedDiscount: 3000, condition: '식품 2만원 이상', opensAt: '2026-11-16T01:00:00Z', endsAt: '2026-11-16T14:59:00Z', issuanceLimit: 100, remaining: 37 },
  { couponId: 9003, name: '가전 쿠폰', fixedDiscount: 10000, condition: '가전 10만원 이상', opensAt: '2026-11-16T01:00:00Z', endsAt: '2026-11-16T14:59:00Z', issuanceLimit: 50, remaining: 0 },
]

async function fixture(page: Page, options: { claimFailure?: boolean; noDrops?: boolean; only?: number } = {}) {
  const state = { claims: 0, alert: false, remaining: 37 }
  await page.route(/\/api\/(member|catalog|commercecore|live|notification)\//, route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'token', refreshToken: 'refresh' } } })
    if (path.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: 'buyer', displayName: '회원', email: 'buyer@test.dev', roles: ['USER'] } } })
    if (path.endsWith('/unread-count')) return route.fulfill({ json: { unreadCount: 0 } })
    if (path.endsWith('/coupon-drops/today')) return options.noDrops ? route.fulfill({ status: 404 }) : route.fulfill({ json: drops.filter(drop => !options.only || drop.couponId === options.only).map(drop => drop.couponId === 9002 ? { ...drop, remaining: state.remaining } : drop) })
    if (path.endsWith('/me/coupons')) return route.fulfill({ json: [] })
    if (path.endsWith('/coupons/9002/claims')) {
      state.claims++
      if (options.claimFailure) return route.fulfill({ status: 409, json: { code: 'CONFLICT', message: '발급 수량이 모두 소진됐어요.' } })
      state.remaining--
      return route.fulfill({ status: 201, json: { id: 'mine-1', couponId: '9002', name: '식품 쿠폰', fixedDiscount: 3000, status: 'AVAILABLE', claimedAt: NOW, expiresAt: '2026-11-30T00:00:00Z' } })
    }
    if (path.endsWith('/coupon-drop-alerts')) {
      if (request.method() === 'POST') { state.alert = true; return route.fulfill({ status: 204 }) }
      if (request.method() === 'DELETE') { state.alert = false; return route.fulfill({ status: 204 }) }
      return route.fulfill({ json: { subscribed: state.alert } })
    }
    if (path.endsWith('/broadcasts')) return route.fulfill({ json: { content: [], number: 0, size: 5, totalElements: 0, totalPages: 0 } })
    if (path.endsWith('/catalog/v1/products')) return route.fulfill({ json: { items: [], hasNext: false, nextCursor: null } })
    return route.fulfill({ status: 404 })
  })
  return state
}

async function login(page: Page) {
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('buyer@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
}

const section = (page: Page) => page.getByRole('region', { name: /Today/ })

test('비회원에게는 받을 수 있는 쿠폰과 받기 마감까지 남은 시간을 보여 주고, 받기와 알림은 로그인으로 안내한다', async ({ page }) => {
  await page.clock.install({ time: new Date(NOW) })
  await fixture(page)
  await page.goto('/')
  const today = section(page)
  await expect(today.getByText('매일 10시, 선착순 쿠폰을 놓치지 마세요.')).toBeVisible()
  const coupon = today.getByRole('link', { name: '로그인하고 선착순 3,000원 할인 쿠폰 받기' })
  await expect(coupon).toHaveAttribute('href', '/login')
  await expect(coupon.getByRole('timer')).toHaveText('11:59:00') // 23:59 받기 마감까지
  await page.clock.runFor(5000)
  await expect(coupon.getByRole('timer')).toHaveText('11:58:55') // 1초마다 줄어든다
  await expect(today.getByText('37장 남음 / 100장, 식품 2만원 이상')).toBeVisible()
  await expect(today.getByRole('link', { name: '로그인하고 알림 받기' })).toBeVisible()
})

test('오픈 전에는 오픈까지 남은 시간을, 모두 나가면 마감을 보여 준다', async ({ page }) => {
  await page.clock.install({ time: new Date(NOW) })
  await fixture(page, { only: 9001 })
  await page.goto('/')
  const waiting = section(page).getByRole('button', { name: /선착순 5,000원 할인 쿠폰/ })
  await expect(waiting).toBeDisabled()
  await expect(waiting).toContainText('14:00 오픈')
  await expect(waiting.getByRole('timer')).toHaveText('02:00:00')
  await expect(section(page).getByText('100장 한정, 뷰티 3만원 이상')).toBeVisible()

  await page.unrouteAll(); await fixture(page, { only: 9003 }); await page.reload()
  await expect(section(page).getByRole('button', { name: /선착순 10,000원 할인 쿠폰/ })).toContainText('마감')
  await expect(section(page).getByText('오늘 쿠폰이 모두 나갔어요. 내일 10:00에 다시 열려요.')).toBeVisible()
})

test('회원은 쿠폰을 받고, 매일 오픈 알림을 신청하고 해제한다', async ({ page }) => {
  await page.clock.install({ time: new Date(NOW) })
  const state = await fixture(page)
  await login(page)
  await page.goto('/')
  const today = section(page)
  await today.getByRole('button', { name: /선착순 3,000원 할인 쿠폰/ }).click()
  await expect(today.getByRole('status')).toHaveText('쿠폰을 받았어요. 내 쿠폰에서 확인하세요.')
  await expect(today.getByRole('button', { name: /선착순 3,000원 할인 쿠폰/ })).toContainText('받음')
  await expect(today.getByRole('button', { name: /선착순 3,000원 할인 쿠폰/ })).toBeDisabled()
  await expect(today.getByText('36장 남음 / 100장, 식품 2만원 이상')).toBeVisible() // 받은 뒤 남은 수량을 다시 불러온다
  expect(state.claims).toBe(1)

  const alert = today.getByRole('button', { name: /알림/ })
  await expect(alert).toHaveAttribute('aria-pressed', 'false')
  await alert.click()
  await expect(alert).toHaveText('10시 알림 신청됨')
  await expect(alert).toHaveAttribute('aria-pressed', 'true')
  expect(state.alert).toBe(true)
  await alert.click()
  await expect(alert).toHaveText('알림 받기')
  expect(state.alert).toBe(false)
})

test('받기에 실패하면 서버가 알려 준 이유를 보여 준다', async ({ page }) => {
  await page.clock.install({ time: new Date(NOW) })
  await fixture(page, { claimFailure: true })
  await login(page)
  await page.goto('/')
  await section(page).getByRole('button', { name: /선착순 3,000원 할인 쿠폰/ }).click()
  await expect(section(page).getByRole('alert')).toHaveText('발급 수량이 모두 소진됐어요.')
})

test('선착순 쿠폰과 기획전을 모두 불러오지 못하면 칸을 숨긴다', async ({ page }) => {
  await fixture(page, { noDrops: true })
  await page.goto('/')
  await expect(page.getByRole('region', { name: '요즘 주목 받는 상품' })).toBeVisible()
  await expect(section(page)).toHaveCount(0)
})
