import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

// 브라우저 조작 회귀용 계약 fixture. 실제 Backend 연동 검사는 likes/kind.spec.ts에서 수행한다.
async function fixture(page: Page, options: { anonymous?: boolean; liked?: boolean; status?: string } = {}) {
  const api = {
    liked: options.liked ?? false,
    version: 0,
    status: options.status ?? 'LIVE',
    failure: '' as '' | 'network' | 'conflict',
    hold: undefined as Promise<void> | undefined,
    chatHold: undefined as Promise<void> | undefined,
    writes: [] as { id: string; liked: boolean; key: string }[],
  }
  const snapshot = (id: number) => ({ broadcastId: id, liked: api.liked, total: Number(api.liked), version: api.version, stateVersion: api.version })
  const saved = new Map<string, ReturnType<typeof snapshot>>()
  if (!options.anonymous) await page.addInitScript(() => sessionStorage.setItem('shoppinglive:refresh:' + location.origin + '/api', 'fixture-refresh'))
  await page.route(/\/api\/(member|commerce|shopping|notification|live)\//, async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const id = Number(path.match(/broadcasts\/(\d+)/)?.[1] ?? 42)
    let data: unknown
    if (path.includes('/auth/')) data = { accessToken: 'fixture-token', refreshToken: 'fixture-refresh' }
    else if (path.endsWith('/members/me')) data = { memberId: 'heart-viewer', email: 'viewer@test.dev', displayName: '시청자', roles: ['USER'] }
    else if (path.endsWith('/unread-count')) data = { unreadCount: 0 }
    else if (path.endsWith('/likes/mine')) {
      if (request.method() === 'PUT') {
        const liked = request.postDataJSON().liked as boolean
        const key = request.headers()['idempotency-key']
        api.writes.push({ id: String(id), liked, key })
        await api.hold
        const failure = api.failure
        api.failure = ''
        if (failure === 'conflict') return route.fulfill({ status: 409, json: { success: false, error: { code: 'CONFLICT', message: '진행 중인 방송이 아닙니다.' } } })
        if (!saved.has(key)) {
          if (api.liked !== liked) { api.liked = liked; api.version++ }
          saved.set(key, snapshot(id))
        }
        if (failure === 'network') return route.abort('failed')
        data = saved.get(key)
      } else data = snapshot(id)
    }
    else if (path.endsWith('/likes')) data = snapshot(id)
    else if (/\/broadcasts\/\d+$/.test(path)) data = { id, title: '하트 애니메이션 검증 방송', status: api.status, scheduledAt: '2026-10-26T10:00:00Z', playbackUrl: null, version: 0 }
    else if (path.includes('/viewers')) data = { broadcastId: id, total: 2, measuredAt: new Date().toISOString(), expiresAfterSeconds: 60 }
    else if (path.endsWith('/events')) return route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' })
    else if (path.endsWith('/chats')) { if (request.method() === 'POST') await api.chatHold; data = [] }
    else if (path.endsWith('/products') || path.endsWith('/promotions')) data = []
    else return route.fulfill({ status: 404 })
    return route.fulfill({ json: { success: true, data } })
  })
  return api
}

const burst = (page: Page) => page.getByTestId('like-burst')
const heart = (page: Page, name = '좋아요 보내기') => page.getByRole('button', { name, exact: true })

test('키보드 하트는 성공 시 위로 흩날리고 재렌더 후 정리되며 취소에는 재생하지 않는다', async ({ page }) => {
  const api = await fixture(page)
  await page.goto('/lives/42')
  await expect(heart(page)).toBeEnabled()
  await expect(heart(page)).toHaveText('')
  await expect(page.getByRole('region', { name: '라이브 참여', exact: true })).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: '방송 정보', exact: true }).getByRole('button', { name: '좋아요 보내기', exact: true })).toHaveCount(0)
  const viewerBox = await page.getByLabel('현재 시청 규모').boundingBox()
  const heartBox = await heart(page).boundingBox()
  expect(heartBox!.x).toBeGreaterThan(viewerBox!.x + viewerBox!.width)
  expect(Math.abs(heartBox!.y + heartBox!.height / 2 - viewerBox!.y - viewerBox!.height / 2)).toBeLessThan(2)
  await expect(heart(page).locator('svg')).toHaveAttribute('fill', 'none')
  await heart(page).focus()
  await expect(heart(page)).toBeFocused()
  expect(await heart(page).evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid')
  await heart(page).press('Space')
  await expect(heart(page, '좋아요 취소')).toHaveAttribute('aria-pressed', 'true')
  await expect(heart(page, '좋아요 취소').locator('svg')).toHaveAttribute('fill', 'currentColor')
  await expect(burst(page).locator('span')).toHaveCount(6)
  const positions = await burst(page).evaluate(el => {
    el.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = 450 })
    return [...el.children].map(child => {
      const style = getComputedStyle(child)
      const matrix = new DOMMatrix(style.transform)
      return { x: matrix.m41, y: matrix.m42, opacity: Number(style.opacity) }
    })
  })
  expect(positions.every(p => p.y < 0 && p.opacity > 0)).toBeTruthy()
  expect(new Set(positions.map(p => p.x)).size).toBe(6)
  await expect(burst(page)).toHaveCSS('pointer-events', 'none')
  await mkdir('test-artifacts/live-heart', { recursive: true })
  await page.screenshot({ path: 'test-artifacts/live-heart/desktop-success.png', fullPage: true })
  await page.getByRole('tab', { name: '채팅', exact: true }).click()
  await expect(page.getByRole('region', { name: '라이브 참여', exact: true })).toBeVisible()
  await expect(heart(page, '좋아요 취소')).toHaveCount(1)
  await expect(burst(page)).toHaveCount(0)
  await heart(page, '좋아요 취소').focus()
  await heart(page, '좋아요 취소').press('Enter')
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'false')
  await expect(burst(page)).toHaveCount(0)
  expect(api.writes.map(write => write.liked)).toEqual([true, false])
  expect(api.writes[0].key).not.toBe(api.writes[1].key)
})

test('겹친 클릭·busy·확정 실패는 성공 애니메이션을 만들지 않는다', async ({ page }) => {
  const api = await fixture(page)
  let release!: () => void
  api.hold = new Promise<void>(resolve => { release = resolve })
  api.failure = 'conflict'
  await page.goto('/lives/42')
  await expect(heart(page)).toBeEnabled()
  await heart(page).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(heart(page, '확인 중…')).toBeDisabled()
  await expect(burst(page)).toHaveCount(0)
  await expect.poll(() => api.writes.length).toBe(1)
  release()
  await expect(heart(page)).toBeEnabled()
  await expect(page.getByRole('status').filter({ hasText: '좋아요 상태를 확인해 주세요' })).toContainText('진행 중인 방송이 아닙니다.')
  await expect(burst(page)).toHaveCount(0)
})

test('응답 유실·상태 재조회에는 재생하지 않고 방송 종료 후 같은 키 재확인 성공에만 재생한다', async ({ page }) => {
  await page.clock.install()
  const api = await fixture(page)
  api.failure = 'network'
  await page.goto('/lives/42')
  await heart(page).click()
  await expect(heart(page, '같은 요청 다시 확인')).toBeEnabled()
  await expect(burst(page)).toHaveCount(0)
  await page.getByRole('button', { name: '상태 다시 조회', exact: true }).click()
  await expect(heart(page, '같은 요청 다시 확인')).toHaveAttribute('aria-pressed', 'true')
  await expect(burst(page)).toHaveCount(0)
  api.status = 'ENDED'
  await page.clock.fastForward(15000)
  await expect(page.getByText('방송이 종료되었어요', { exact: true })).toBeVisible()
  await expect(heart(page, '같은 요청 다시 확인')).toBeEnabled()
  await heart(page, '같은 요청 다시 확인').click()
  await expect(heart(page, '좋아요 취소')).toBeDisabled()
  await expect(burst(page)).toHaveCount(1)
  expect(api.writes).toHaveLength(2)
  expect(api.writes[0].key).toBe(api.writes[1].key)
  await page.clock.fastForward(1200)
  await expect(burst(page)).toHaveCount(0)
})

test('모션 감소·저장 상태 조회·화면 이동은 떠오르는 하트를 남기지 않는다', async ({ page }) => {
  const api = await fixture(page, { liked: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/lives/42')
  await expect(heart(page, '좋아요 취소')).toBeEnabled()
  await expect(burst(page)).toHaveCount(0)
  await heart(page, '좋아요 취소').click()
  await heart(page).click()
  await expect(heart(page, '좋아요 취소')).toHaveAttribute('aria-pressed', 'true')
  await expect(burst(page)).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await mkdir('test-artifacts/live-heart', { recursive: true })
  await page.screenshot({ path: 'test-artifacts/live-heart/mobile-reduced-motion.png', fullPage: true })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await heart(page, '좋아요 취소').click()
  await heart(page).click()
  await expect(burst(page)).toHaveCount(1)
  await burst(page).evaluate(el => el.getAnimations({ subtree: true }).forEach(animation => { animation.pause(); animation.currentTime = 850 }))
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(burst(page)).toHaveCount(0)
  await heart(page, '좋아요 취소').click()
  await expect(heart(page)).toBeEnabled()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  let release!: () => void
  api.hold = new Promise<void>(resolve => { release = resolve })
  await heart(page).click()
  await expect(heart(page, '확인 중…')).toBeDisabled()
  await page.evaluate(() => {
    history.pushState(null, '', '/lives/43')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(heart(page)).toBeEnabled()
  release()
  await expect.poll(() => api.liked).toBe(true)
  await expect(burst(page)).toHaveCount(0)
})

test('로그인·방송 상태·채팅 busy 제약을 유지한다', async ({ page }) => {
  const api = await fixture(page, { anonymous: true })
  await page.goto('/lives/42')
  await expect(heart(page)).toBeDisabled()
  expect(api.writes).toHaveLength(0)
  const member = await fixture(page, { status: 'PREPARING' })
  await page.reload()
  await expect(heart(page)).toBeDisabled()
  member.status = 'LIVE'
  await page.reload()
  await expect(heart(page)).toBeEnabled()
  await page.getByRole('tab', { name: '채팅', exact: true }).click()
  let release!: () => void
  member.chatHold = new Promise<void>(resolve => { release = resolve })
  await page.getByLabel('채팅 입력').fill('하트 테스트')
  await page.getByRole('button', { name: '전송', exact: true }).click()
  await expect(heart(page)).toBeDisabled()
  release()
  await expect(heart(page)).toBeEnabled()
  expect(member.writes).toHaveLength(0)
})
