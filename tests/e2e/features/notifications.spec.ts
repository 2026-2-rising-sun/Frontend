import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const password = 'NotificationTest123!'
async function token(request: APIRequestContext, email: string, secret: string) {
  const response = await request.post('/api/member/v1/auth/login', { data: { email, password: secret } })
  expect(response.ok(), await response.text()).toBeTruthy()
  return { Authorization: `Bearer ${(await response.json()).data.accessToken}` }
}
async function signIn(page: Page, email: string, secret: string) {
  await page.goto('/login')
  await page.getByLabel(/아이디 또는 이메일|^이메일$/).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill(secret)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}
async function member(request: APIRequestContext) {
  const email = `notification-${randomUUID()}@local.test`
  const response = await request.post('/api/member/v1/auth/signup', { data: { email, password, displayName: '알림 검증 회원' } })
  expect(response.ok(), await response.text()).toBeTruthy()
  return { email, headers: await token(request, email, password) }
}

test('kind: 새 회원 알림함 빈 화면, 미확인 배지, 새로고침과 모바일 너비를 확인한다', async ({ page, request }) => {
  const user = await member(request)
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible()
  await signIn(page, user.email, password)
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: '알림함', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '아직 받은 알림이 없어요', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '알림함, 안 읽은 알림 0개', exact: true })).toBeVisible()
  const response = await request.get('/api/notification/v1/notifications/unread-count', { headers: user.headers })
  expect(response.ok(), await response.text()).toBeTruthy()
  expect((await response.json()).data.unreadCount).toBe(0)
  await page.getByRole('button', { name: '새로고침', exact: true }).click()
  await expect(page.getByRole('heading', { name: '아직 받은 알림이 없어요', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-artifacts/notifications-mobile.png', fullPage: true })
})
