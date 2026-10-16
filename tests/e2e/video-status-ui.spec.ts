import { test, expect, type Page } from '@playwright/test'
async function fixture(page: Page, snapshot: () => { status?: string; videoStatus: string | null; failed?: boolean }) {
  await page.route(/\/api\/(member|commerce|shopping|notification|live)\//, async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown
    if (path.endsWith('/broadcasts/42')) {
      const value = snapshot()
      if (value.failed) return route.fulfill({ status: 503 })
      data = { id: 42, title: '영상 상태 검증', status: value.status ?? 'LIVE', videoStatus: value.videoStatus, scheduledAt: new Date().toISOString(), playbackUrl: '/stub.m3u8', playbackAllowed: true }
    } else if (path.includes('/viewers')) data = { broadcastId: 42, total: 2, measuredAt: new Date().toISOString(), expiresAfterSeconds: 60 }
    else if (path.endsWith('/products') || path.endsWith('/chats') || path.endsWith('/promotions')) data = []
    else if (path.endsWith('/likes')) data = { broadcastId: 42, total: 0, version: 0 }
    else return route.fulfill({ status: 401 })
    return route.fulfill({ json: { success: true, data } })
  })
  // 영상 전송 자체는 이 검사 범위가 아니므로 네트워크 재생을 시작하지 않는다.
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'canPlayType', { value: () => 'probably' })
    Object.defineProperty(HTMLMediaElement.prototype, 'src', { get: () => '', set: () => {} })
  })
}
test('신호 없음·조회 장애·정상·종료를 구분하고 다시 확인해 복구한다', async ({ page }) => {
  let value = { status: 'LIVE', videoStatus: 'NOT_READY' as string | null, failed: false }
  await fixture(page, () => value)
  await page.goto('/lives/42')
  await expect(page.getByText('영상 송출을 기다리고 있어요', { exact: true })).toBeVisible()
  await expect(page.locator('video')).toHaveCount(0)
  await expect(page.getByText('현재 시청 약 2명', { exact: true })).toBeVisible()
  value = { ...value, videoStatus: 'UNAVAILABLE' }
  await page.getByRole('button', { name: '영상 상태 다시 확인', exact: true }).click()
  await expect(page.getByText('영상 신호 상태를 확인할 수 없어요', { exact: true })).toBeVisible()
  await expect(page.locator('video')).toBeVisible()
  value = { ...value, videoStatus: 'READY' }
  await page.getByRole('button', { name: '영상 상태 다시 확인', exact: true }).click()
  await expect(page.getByText('영상 신호 상태를 확인할 수 없어요', { exact: true })).toHaveCount(0)
  await expect(page.locator('video')).toBeVisible()
  value = { ...value, status: 'ENDED', videoStatus: null }
  await page.reload()
  await expect(page.getByText('방송이 종료되었어요', { exact: true })).toBeVisible()
  await expect(page.locator('video')).toHaveCount(0)
})
test('상태 재조회 실패는 이전 신호 상태와 구분하고 모바일에서 재시도한다', async ({ page }) => {
  let failed = false
  await fixture(page, () => ({ videoStatus: 'NOT_READY', failed }))
  await page.goto('/lives/42')
  await page.getByRole('button', { name: '영상 상태 다시 확인', exact: true }).waitFor()
  failed = true
  await page.getByRole('button', { name: '영상 상태 다시 확인', exact: true }).click()
  await expect(page.getByText('최신 영상 상태를 확인하지 못했어요', { exact: true })).toBeVisible()
  failed = false
  await page.getByRole('button', { name: '영상 상태 다시 확인', exact: true }).click()
  await expect(page.getByText('최신 영상 상태를 확인하지 못했어요', { exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
test('신호 상태가 없는 기존 응답과 예정 방송도 유지한다', async ({ page }) => {
  let status = 'LIVE'
  await fixture(page, () => ({ status, videoStatus: null }))
  await page.goto('/lives/42')
  await expect(page.locator('video')).toBeVisible()
  status = 'PREPARING'
  await page.reload()
  await expect(page.getByText('방송 준비 중이에요', { exact: true })).toBeVisible()
  await expect(page.locator('video')).toHaveCount(0)
})
