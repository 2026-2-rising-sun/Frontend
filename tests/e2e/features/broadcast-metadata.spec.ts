import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=', 'base64')
test('kind: 판매자 썸네일·진행자명·소개 저장 후 재접속과 공개 카드·시청 화면에 반영한다', async ({ page, request }) => {
  const suffix = randomUUID().slice(0, 8); const title = `방송 메타 검증 ${suffix}`
  await page.goto('/login')
  await page.getByLabel('아이디 또는 이메일').fill('seller@local.test')
  await page.getByLabel('비밀번호', { exact: true }).fill('seller')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
  await page.goto('/admin/lives/new')
  await page.getByLabel('방송 제목', { exact: true }).fill(title)
  await page.getByLabel('공개 진행자 이름', { exact: true }).fill('메타 진행자')
  await page.getByLabel('방송 소개', { exact: true }).fill('새 상품을 소개하는 방송입니다.')
  await page.getByLabel('방송 썸네일', { exact: true }).setInputFiles({ name: 'thumbnail.png', mimeType: 'image/png', buffer: png })
  await page.getByLabel('AWS IVS 채널 ARN', { exact: true }).fill(`arn:aws:ivs:ap-northeast-2:123456789012:channel/${suffix}`)
  await page.getByLabel(/예정 시작/).fill('2026-12-01T12:00')
  await page.getByLabel(/시청.*URL|재생 URL|시청 연결/).fill(`https://stub.live-video.net/${suffix}.m3u8`)
  await page.getByRole('button', { name: '방송 등록', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/lives\/\d+$/)
  const id = page.url().split('/').at(-1)!
  await page.reload()
  await expect(page.getByLabel('공개 진행자 이름', { exact: true })).toHaveValue('메타 진행자')
  await expect(page.getByLabel('방송 소개', { exact: true })).toHaveValue('새 상품을 소개하는 방송입니다.')
  const response = await request.get(`/api/live/v1/broadcasts/${id}`)
  expect(response.ok()).toBeTruthy()
  const data = (await response.json()).data
  expect(data.channelArn).toBeUndefined(); expect(data.hostName).toBe('메타 진행자')
  expect((await request.get(data.thumbnailUrl)).ok()).toBeTruthy()
  await page.goto(`/lives/${id}`)
  await expect(page.getByText('메타 진행자', { exact: true })).toBeVisible()
  await expect(page.getByText('새 상품을 소개하는 방송입니다.', { exact: true })).toBeVisible()
  await page.goto('/lives')
  const firstPage = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/v1/broadcasts' && new URL(response.url()).searchParams.get('status') === 'PREPARING')
  await page.getByRole('tab', { name: '예정', exact: true }).click()
  const firstData = (await (await firstPage).json()).data
  await expect(page.locator('a[href^="/lives/"]')).toHaveCount(firstData.content.length)
  const card = page.getByRole('link').filter({ hasText: title })
  // 예정 방송은 시각순이므로 새로 만든 방송이 있는 페이지까지 이동한다.
  for (let attempt = 0; await card.count() === 0 && attempt < 30; attempt++) {
    const more = page.getByRole('button', { name: /더 보기/ })
    if (!await more.count()) break
    const count = await page.locator('a[href^="/lives/"]').count()
    const next = page.waitForResponse(response => new URL(response.url()).pathname === '/api/live/v1/broadcasts')
    await more.click()
    const result = (await (await next).json()).data
    await expect(page.locator('a[href^="/lives/"]')).toHaveCount(count + result.content.length)
  }
  await expect(card.locator('img')).toHaveAttribute('src', data.thumbnailUrl)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
