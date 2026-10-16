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


test('kind: 쿠폰 이벤트 생성·공개·회원 발급·종료를 실제 API로 확인한다', async ({ page, request, browser }) => {
  test.setTimeout(150000)
  const f = await fixture(request)
  const now = Date.now()
  const couponName = `방송 쿠폰 ${randomUUID().slice(0, 8)}`
  const response = await request.post('/api/commerce/v1/seller/coupons', { headers: f.seller, data: {
    name: couponName, fixedDiscount: 500, issuanceLimit: 10, startsAt: new Date(now - 60000).toISOString(), endsAt: new Date(now + 3600000).toISOString(), expiresAt: new Date(now + 7200000).toISOString(), productIds: [f.productId],
  } })
  expect(response.ok(), await response.text()).toBeTruthy()
  const coupon = (await response.json()).data
  await signIn(page, 'seller@local.test', 'seller')
  await page.goto(`/admin/lives/${f.liveId}`)
  const panel = page.getByRole('region', { name: '방송 이벤트', exact: true })
  await panel.getByLabel('이벤트 유형').selectOption('COUPON_DROP')
  // 보존된 기존 쿠폰이 여러 페이지에 있어도 이번 검증용 쿠폰을 찾아 선택한다.
  const select = panel.getByLabel('이벤트 쿠폰')
  for (let index = 0; index < 100; index++) {
    await expect(select).toBeEnabled()
    if (await select.locator('option').filter({ hasText: couponName }).count()) break
    const next = panel.getByRole('button', { name: '다음 쿠폰', exact: true })
    await expect(next).toBeEnabled(); await next.click()
  }
  await select.selectOption(String(coupon.id))
  await panel.getByLabel('이벤트 제목', { exact: true }).fill(couponName)
  await panel.getByRole('button', { name: '이벤트 준비하기', exact: true }).click()
  const card = panel.getByRole('article').filter({ hasText: couponName })
  await expect(card).toBeVisible()
  await page.getByRole('button', { name: '방송 시작', exact: true }).click()
  await expect(card.getByRole('button', { name: '이벤트 열기', exact: true })).toBeEnabled()
  await card.getByRole('button', { name: '이벤트 열기', exact: true }).click()
  const viewerContext = await browser.newContext()
  const viewer = await viewerContext.newPage()
  try {
    await viewer.goto(new URL(`/lives/${f.liveId}`, page.url()).href)
    await viewer.getByRole('link', { name: '로그인하고 쿠폰 받기' }).click()
    await viewer.getByLabel(/아이디 또는 이메일|^이메일$/).fill('user@local.test')
    await viewer.getByLabel('비밀번호', { exact: true }).fill('user')
    await viewer.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(viewer).toHaveURL(new RegExp(`/lives/${f.liveId}$`))
    await viewer.getByRole('button', { name: '쿠폰 받기', exact: true }).click()
    await expect(viewer.getByRole('button', { name: '쿠폰 받기 완료', exact: true })).toBeDisabled()
    const member = await token(request, 'user@local.test', 'user')
    const mine = await request.get('/api/commerce/v1/me/coupons?size=100', { headers: member })
    expect(mine.ok(), await mine.text()).toBeTruthy()
    expect((await mine.json()).data.some((item: { couponId: string }) => String(item.couponId) === String(coupon.id))).toBeTruthy()
    await viewer.reload()
    await expect(viewer.getByText(`방송 중 이벤트 · ${couponName}`, { exact: true })).toBeVisible()
    await card.getByRole('button', { name: '이벤트 종료', exact: true }).click()
    await expect(viewer.getByText(`방송 중 이벤트 · ${couponName}`, { exact: true })).toHaveCount(0, { timeout: 25000 })
  } finally {
    await viewerContext.close()
    await page.getByRole('button', { name: '방송 종료', exact: true }).click()
  }
})
