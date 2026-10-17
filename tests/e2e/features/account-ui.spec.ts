import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page, role = 'USER') {
  let displayName = '쇼핑라이브'
  let failLogin = false
  let failName = false
  let withdrawals = 0
  await page.route(/\/api\/(member|notification|shopping|commerce|live)\//, route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/auth/login') && failLogin) return route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED', message: '아이디와 비밀번호를 확인해 주세요.' } })
    if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'token', refreshToken: 'refresh' } } })
    if (path.endsWith('/members/me')) {
      if (request.method() === 'PATCH') {
        if (failName) return route.fulfill({ status: 500, json: { message: '이름 저장에 실패했어요.' } })
        displayName = request.postDataJSON().displayName
      }
      if (request.method() === 'DELETE') { withdrawals++; return route.fulfill({ status: 204 }) }
      return route.fulfill({ json: { success: true, data: { memberId: '1', email: 'user@test.dev', displayName, roles: [role] } } })
    }
    if (path.endsWith('/notifications/unread-count')) return route.fulfill({ json: { unreadCount: 0 } })
    if (path.includes('/seller/products')) return route.fulfill({ json: { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } })
    return route.fulfill({ status: 404 })
  })
  return { loginFails: (v: boolean) => { failLogin = v }, nameFails: (v: boolean) => { failName = v }, withdrawals: () => withdrawals }
}
async function login(page: Page) {
  await page.getByLabel('아이디 또는 이메일').fill('user@test.dev')
  await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
}

test('로그인 비밀번호 표시와 오류 복구 후 원래 요청한 화면으로 이동한다', async ({ page }) => {
  const api = await setup(page)
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: '비밀번호 표시' }).click()
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: '비밀번호 숨기기' }).click()
  api.loginFails(true)
  await login(page)
  await expect(page.getByRole('alert')).toContainText('아이디와 비밀번호를 확인해 주세요.')
  await expect(page.getByLabel('아이디 또는 이메일')).toHaveValue('user@test.dev')
  api.loginFails(false)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByRole('region', { name: '내 프로필' })).toContainText('쇼핑라이브님')
})

test('내 계정에서 이름 변경 성공·실패를 구분하고 탈퇴 취소는 요청을 보내지 않는다', async ({ page }) => {
  const api = await setup(page)
  await page.goto('/login'); await login(page)
  const shopping = page.getByRole('region', { name: '나의 쇼핑' })
  await expect(shopping.getByRole('link', { name: '내 주문', exact: false })).toHaveAttribute('href', '/orders/lookup')
  await expect(shopping.getByRole('link', { name: /내 알림 신청/ })).toHaveAttribute('href', '/notifications/subscriptions')
  await expect(page.getByRole('region', { name: '판매자 센터' })).not.toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: '이름 변경', exact: true }).click()
  await expect(page.getByLabel('변경할 이름')).toHaveValue('쇼핑라이브')
  await expect(page.getByRole('button', { name: '이름 저장' })).toBeDisabled()
  await page.getByLabel('변경할 이름').fill('새 이름')
  api.nameFails(true)
  await page.getByRole('button', { name: '이름 저장' }).click()
  await expect(page.getByRole('alert')).toContainText('이름 저장에 실패했어요.')
  api.nameFails(false)
  await page.getByRole('button', { name: '이름 저장' }).click()
  await expect(page.getByRole('region', { name: '내 프로필' })).toContainText('새 이름님')
  await expect(page.getByText('이름을 변경했어요.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '회원 탈퇴', exact: true }).click()
  await page.getByLabel('현재 비밀번호').fill('password')
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await expect(page.getByLabel('현재 비밀번호')).not.toBeVisible()
  expect(api.withdrawals()).toBe(0)
})

test('판매자 내 계정에서 판매자 콘솔과 세션 관리를 제공한다', async ({ page }) => {
  await setup(page, 'SELLER')
  await page.goto('/login'); await login(page)
  await expect(page).toHaveURL(/\/admin\/products$/)
  await page.goto('/account')
  await expect(page.getByRole('region', { name: '판매자 센터' }).getByRole('link')).toHaveAttribute('href', '/admin/products')
  await expect(page.getByRole('button', { name: '내 모든 세션 종료', exact: true })).toBeVisible()
})
