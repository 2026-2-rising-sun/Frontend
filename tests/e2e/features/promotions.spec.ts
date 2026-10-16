import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=', 'base64')
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
async function fixture(request: APIRequestContext) {
  const seller = await token(request, 'seller@local.test', 'seller')
  const suffix = randomUUID().slice(0, 8)
  const name = `알림 이벤트 검증 ${suffix}`
  const image = await request.post('/api/shopping/v1/seller/product-images', { headers: seller, multipart: { file: { name: 'notification.png', mimeType: 'image/png', buffer: png } } })
  expect(image.ok(), await image.text()).toBeTruthy()
  const product = await request.post('/api/shopping/v1/seller/products', { headers: { ...seller, 'X-Idempotency-Key': randomUUID() }, data: { name, description: '알림과 프로모션 검증 전용 상품', mainImageId: (await image.json()).data.imageId } })
  expect(product.ok(), await product.text()).toBeTruthy()
  const productId = Number((await product.json()).data.productId)
  const sale = await request.post('/api/commerce/v1/sales', { headers: seller, data: { productId, price: 1000, initialStock: 1 } })
  expect(sale.ok(), await sale.text()).toBeTruthy()
  const salesId = (await sale.json()).id
  const startSale = await request.patch(`/api/commerce/v1/sales/${salesId}/status`, { headers: seller, data: { status: 'ON_SALE' } })
  expect(startSale.ok(), await startSale.text()).toBeTruthy()
  const soldOut = await request.patch(`/api/commerce/v1/sales/${salesId}/stock`, { headers: seller, data: { delta: -1 } })
  expect(soldOut.ok(), await soldOut.text()).toBeTruthy()
  for (const status of ['PRIVATE', 'ON_SALE']) {
    const visibility = await request.patch(`/api/commerce/v1/sales/${salesId}/status`, { headers: seller, data: { status } })
    expect(visibility.ok(), await visibility.text()).toBeTruthy()
  }
  const broadcast = await request.post('/api/live/v1/seller/broadcasts', { headers: { ...seller, 'Idempotency-Key': randomUUID() }, data: { title: name, scheduledAt: new Date(Date.now() + 3600000).toISOString(), channelArn: `arn:aws:ivs:ap-northeast-2:123456789012:channel/${suffix}`, playbackUrl: `https://stub.live-video.net/${suffix}.m3u8` } })
  expect(broadcast.ok(), await broadcast.text()).toBeTruthy()
  const live = (await broadcast.json()).data
  const link = await request.post(`/api/live/v1/seller/broadcasts/${live.id}/products`, { headers: seller, data: { productId, expectedVersion: live.version } })
  expect(link.ok(), await link.text()).toBeTruthy()
  return { name, productId, liveId: String(live.id), seller }
}


test('kind: 판매자 이벤트 준비·열기, 공개 시청 배너, 새로고침 복구·종료를 확인한다', async ({ page, request, browser }) => {
  test.setTimeout(120000)
  const f = await fixture(request)
  await signIn(page, 'seller@local.test', 'seller')
  await page.goto(`/admin/lives/${f.liveId}`)
  const panel = page.getByRole('region', { name: '방송 이벤트', exact: true })
  const title = `라이브 특별 안내 ${randomUUID().slice(0, 8)}`
  await panel.getByLabel('이벤트 제목', { exact: true }).fill(title)
  await panel.getByLabel('자동 종료 시간(초)', { exact: true }).fill('300')
  await panel.getByRole('button', { name: '이벤트 준비하기', exact: true }).click()
  await expect(panel.getByText('방송 이벤트를 준비했어요. 방송 중에 열 수 있어요.', { exact: true })).toBeVisible()
  const card = panel.getByRole('article').filter({ hasText: title })
  await expect(card.getByRole('button', { name: '이벤트 열기', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '방송 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '방송 종료', exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: '이벤트 열기', exact: true })).toBeEnabled()
  const viewerContext = await browser.newContext()
  const viewer = await viewerContext.newPage()
  try {
    await viewer.goto(new URL(`/lives/${f.liveId}`, page.url()).href)
    await expect(viewer.getByText(`방송 중 이벤트 · ${title}`, { exact: true })).toHaveCount(0)
    await card.getByRole('button', { name: '이벤트 열기', exact: true }).click()
    await expect(viewer.getByText(`방송 중 이벤트 · ${title}`, { exact: true })).toBeVisible({ timeout: 25000 })
    await viewer.reload()
    await expect(viewer.getByText(`방송 중 이벤트 · ${title}`, { exact: true })).toBeVisible()
    await viewer.setViewportSize({ width: 390, height: 844 })
    expect(await viewer.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await viewer.screenshot({ path: 'test-artifacts/promotion-live-mobile.png', fullPage: true })
    await card.getByRole('button', { name: '이벤트 종료', exact: true }).click()
    await expect(viewer.getByText(`방송 중 이벤트 · ${title}`, { exact: true })).toHaveCount(0, { timeout: 25000 })
    await expect(card.getByText('종료', { exact: true })).toBeVisible()
    await expect(card.getByRole('button', { name: '이벤트 열기', exact: true })).toHaveCount(0)
    const saved = await request.get(`/api/live/v1/seller/broadcasts/${f.liveId}/promotions`, { headers: f.seller })
    expect(saved.ok(), await saved.text()).toBeTruthy()
    expect((await saved.json()).data.find((item: { title: string }) => item.title === title).status).toBe('CLOSED')
    await page.getByRole('button', { name: '방송 종료', exact: true }).click()
  } finally { await viewerContext.close() }
})
