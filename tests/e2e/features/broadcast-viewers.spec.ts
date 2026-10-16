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


test('kind: 복수 브라우저 시청 집계·같은 브라우저 탭 중복 방지·방송 종료를 검증한다', async ({ page, request, browser }) => {
  test.setTimeout(120000)
  const f = await fixture(request)
  await signIn(page, 'seller@local.test', 'seller')
  await page.goto(`/admin/lives/${f.liveId}`)
  await page.getByRole('button', { name: '방송 시작', exact: true }).click()
  await expect(page.getByText('현재 시청 약 0명', { exact: true })).toBeVisible()
  const first = await browser.newContext()
  const second = await browser.newContext()
  const total = async () => {
    const response = await request.get(`/api/live/v1/broadcasts/${f.liveId}/viewers`)
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json()).data.total
  }
  try {
    const one = await first.newPage()
    await one.goto(new URL(`/lives/${f.liveId}`, page.url()).href)
    await expect(one.getByText('현재 시청 약 1명', { exact: true })).toBeVisible()
    const duplicate = await first.newPage()
    await duplicate.goto(new URL(`/lives/${f.liveId}`, page.url()).href)
    await expect(duplicate.getByText('현재 시청 약 1명', { exact: true })).toBeVisible()
    const two = await second.newPage()
    await two.goto(new URL(`/lives/${f.liveId}`, page.url()).href)
    await expect(two.getByText('현재 시청 약 2명', { exact: true })).toBeVisible()
    await expect.poll(total).toBe(2)
    await page.goto('/lives')
    const preview = page.getByRole('link').filter({ hasText: f.name })
    await expect(preview.getByText('현재 시청 약 2명', { exact: true })).toBeVisible()
    await expect.poll(total).toBe(2)
    await page.goto(`/admin/lives/${f.liveId}`)
    await page.getByRole('button', { name: '방송 종료', exact: true }).click()
    await page.getByRole('button', { name: '종료 확정', exact: true }).click()
    await expect(page.getByText('방송을 종료했어요. 소개된 상품은 계속 구매할 수 있어요.', { exact: true })).toBeVisible()
    await expect.poll(total).toBe(0)
    const invalid = await request.post(`/api/live/v1/broadcasts/${f.liveId}/viewers/heartbeat`, { data: { viewerId: 'invalid' } })
    expect(invalid.status()).toBe(400)
  } finally { await first.close(); await second.close() }
})
