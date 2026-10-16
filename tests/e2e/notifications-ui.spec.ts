import { test, expect } from '@playwright/test'

for (const succeeds of [true, false]) {
  test(`읽음 요청 ${succeeds ? '성공' : '실패'} 전에는 목록 조회를 막고 완료 후 다시 허용한다`, async ({ page }) => {
    let release!: () => void
    const pendingRead = new Promise<void>(resolve => { release = resolve })
    let readAt: string | null = null
    let listRequests = 0
    await page.route(/\/api\/(member|notification)\//, async route => {
      const path = new URL(route.request().url()).pathname
      if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'test-token', refreshToken: 'test-refresh' } } })
      if (path.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: ['USER'] } } })
      if (path.endsWith('/unread-count')) return route.fulfill({ json: { success: true, data: { unreadCount: readAt ? 0 : 1 } } })
      if (path.endsWith('/42/read')) {
        await pendingRead
        if (!succeeds) return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR', message: '읽음 요청 실패' } })
        readAt = '2026-10-17T00:00:00Z'
        return route.fulfill({ status: 204 })
      }
      if (path.endsWith('/notifications')) {
        listRequests++
        return route.fulfill({ json: { success: true, data: { items: [{ id: 42, eventType: 'Restocked', title: '재입고 소식', body: '상품이 다시 입고됐어요.', linkType: 'PRODUCT', linkValue: '7', occurredAt: '2026-10-16T00:00:00Z', readAt }], hasNext: true, nextCursor: 'next' } } })
      }
      return route.fulfill({ status: 404 })
    })
    await page.goto('/login')
    await page.getByLabel('아이디 또는 이메일').fill('user@test.dev')
    await page.getByLabel('비밀번호', { exact: true }).fill('password')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
    await page.goto('/notifications')
    await expect(page.getByRole('button', { name: '읽음 처리', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '알림 더 보기', exact: true })).toBeEnabled()
    const initialLists = listRequests
    const readStarted = page.waitForRequest(request => request.url().endsWith('/42/read'))
    await page.getByRole('button', { name: '읽음 처리', exact: true }).click()
    await readStarted
    try {
      await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: '알림 더 보기', exact: true })).toBeDisabled()
      expect(listRequests).toBe(initialLists)
    } finally { release() }
    if (succeeds) {
      await expect(page.getByRole('button', { name: '읽음 처리', exact: true })).toHaveCount(0)
      await expect(page.getByText('새 알림', { exact: true })).toHaveCount(0)
      await expect(page.getByRole('link', { name: '알림함, 안 읽은 알림 0개', exact: true })).toBeVisible()
      expect(listRequests).toBe(initialLists + 1)
    } else {
      await expect(page.getByRole('button', { name: '읽음 처리', exact: true })).toBeEnabled()
      await expect(page.getByText('읽음 요청 실패', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled()
    }
    await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: '알림 더 보기', exact: true })).toBeEnabled()
  })
}
