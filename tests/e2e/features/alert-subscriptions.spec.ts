import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=', 'base64')
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
  return { name, productId, salesId, liveId: String(live.id), seller }
}

test('kind: 방송·재입고 알림 로그인 안내, 신청 응답과 해제의 실제 API 계약을 확인한다', async ({ page, request }) => {
  test.setTimeout(150000)
  const f = await fixture(request); const user = await member(request)
  await page.goto(`/lives/${f.liveId}`)
  await expect(page.getByRole('link', { name: '로그인하고 방송 시작 알림 신청', exact: true })).toBeVisible()
  await signIn(page, user.email, password)
  for (const target of [
    { url: `/lives/${f.liveId}`, label: '방송 시작', endpoint: '/broadcast-alerts' },
    { url: `/products/${f.productId}`, label: '재입고', endpoint: '/restock-alerts' },
  ]) {
    await page.goto(target.url)
    const region = page.getByRole('region', { name: `${target.label} 알림`, exact: true })
    await expect(region).toBeVisible()
    await expect.poll(async () => {
      const response = await request.post(`/api/notification/v1${target.endpoint}`, { headers: user.headers, data: target.endpoint === '/broadcast-alerts' ? { broadcastId: Number(f.liveId) } : { productId: f.productId } })
      return response.status()
    }, { timeout: 45000, intervals: [1000] }).toBe(201)
    const registration = page.waitForResponse(response => response.url().endsWith(`/api/notification/v1${target.endpoint}`) && response.request().method() === 'POST')
    await region.getByRole('button', { name: '알림 신청', exact: true }).click()
    expect((await registration).status()).toBe(201)
    await expect(region.getByText(`${target.label} 알림을 신청했어요.`, { exact: true })).toBeVisible()
    const cancellation = page.waitForResponse(response => response.url().includes(`/api/notification/v1${target.endpoint}/`) && response.request().method() === 'DELETE')
    await region.getByRole('button', { name: '알림 해제', exact: true }).click()
    expect((await cancellation).status()).toBe(204)
    await expect(region.getByText(`${target.label} 알림을 해제했어요.`, { exact: true })).toBeVisible()
  }
})


test('kind: 실제 방송 시작 이벤트가 알림·배지에 반영되고 읽음 후 개수가 줄어든다', async ({ page, request }) => {
  test.setTimeout(150000)
  const f = await fixture(request); const user = await member(request)
  await expect.poll(async () => {
    const response = await request.post('/api/notification/v1/broadcast-alerts', { headers: user.headers, data: { broadcastId: Number(f.liveId) } })
    return response.status()
  }, { timeout: 45000, intervals: [1000] }).toBe(201)
  const broadcast = await request.get(`/api/live/v1/seller/broadcasts/${f.liveId}`, { headers: f.seller })
  expect(broadcast.ok(), await broadcast.text()).toBeTruthy()
  const version = (await broadcast.json()).data.version
  const start = await request.post(`/api/live/v1/seller/broadcasts/${f.liveId}/start?expectedVersion=${version}`, { headers: f.seller })
  expect(start.ok(), await start.text()).toBeTruthy()
  await expect.poll(async () => {
    const response = await request.get('/api/notification/v1/notifications/unread-count', { headers: user.headers })
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json()).data.unreadCount
  }, { timeout: 45000, intervals: [1000] }).toBe(1)
  await signIn(page, user.email, password)
  await page.goto('/notifications')
  await expect(page.getByRole('link', { name: '알림함, 안 읽은 알림 1개', exact: true })).toBeVisible()
  const detail = page.getByRole('link', { name: '자세히 보기', exact: true })
  await expect(detail).toHaveAttribute('href', `/lives/${f.liveId}`)
  const read = page.waitForResponse(response => /\/api\/notification\/v1\/notifications\/[^/]+\/read$/.test(response.url()) && response.request().method() === 'POST')
  await page.getByRole('button', { name: '읽음 처리', exact: true }).click()
  expect((await read).status()).toBe(204)
  await expect(page.getByRole('button', { name: '읽음 처리', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: '알림함, 안 읽은 알림 0개', exact: true })).toBeVisible()
  const list = await request.get('/api/notification/v1/notifications', { headers: user.headers })
  expect(list.ok(), await list.text()).toBeTruthy()
  const notification = (await list.json()).data.items[0]
  expect(notification.eventType).toBe('LiveBroadcastStarted')
  expect(notification.linkValue).toBe(f.liveId)
  expect(notification.readAt).not.toBeNull()
  const end = await request.post(`/api/live/v1/seller/broadcasts/${f.liveId}/end`, { headers: f.seller })
  expect(end.ok(), await end.text()).toBeTruthy()
})


test('kind: 재입고 신청 후 실제 재고 복구 이벤트가 모바일 알림함과 읽음 상태에 반영된다', async ({ page, request }) => {
  test.setTimeout(150000)
  const f = await fixture(request); const user = await member(request)
  await signIn(page, user.email, password)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/products/${f.productId}`)
  const region = page.getByRole('region', { name: '재입고 알림', exact: true })
  await expect(region).toBeVisible()
  // Kafka의 상품 복제 완료를 기다린다. 신청 API는 같은 회원·상품에 멱등적이다.
  await expect.poll(async () => {
    const response = await request.post('/api/notification/v1/restock-alerts', { headers: user.headers, data: { productId: f.productId } })
    return response.status()
  }, { timeout: 45000, intervals: [1000] }).toBe(201)
  const registration = page.waitForResponse(response => response.url().endsWith('/api/notification/v1/restock-alerts') && response.request().method() === 'POST')
  await region.getByRole('button', { name: '알림 신청', exact: true }).click()
  expect((await registration).status()).toBe(201)
  await expect(region.getByText('재입고 알림을 신청했어요.', { exact: true })).toBeVisible()
  const stock = await request.patch(`/api/commerce/v1/sales/${f.salesId}/stock`, { headers: f.seller, data: { delta: 2 } })
  expect(stock.ok(), await stock.text()).toBeTruthy()
  await expect.poll(async () => {
    const response = await request.get('/api/notification/v1/notifications/unread-count', { headers: user.headers })
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json()).data.unreadCount
  }, { timeout: 45000, intervals: [1000] }).toBe(1)
  await page.goto('/notifications')
  await expect(page.getByRole('link', { name: '알림함, 안 읽은 알림 1개', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '자세히 보기', exact: true })).toHaveAttribute('href', `/products/${f.productId}`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const read = page.waitForResponse(response => /\/api\/notification\/v1\/notifications\/[^/]+\/read$/.test(response.url()) && response.request().method() === 'POST')
  await page.getByRole('button', { name: '읽음 처리', exact: true }).click()
  expect((await read).status()).toBe(204)
  await expect(page.getByRole('link', { name: '알림함, 안 읽은 알림 0개', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '읽음 처리', exact: true })).toHaveCount(0)
  const list = await request.get('/api/notification/v1/notifications', { headers: user.headers })
  expect(list.ok(), await list.text()).toBeTruthy()
  const notifications = (await list.json()).data.items
  expect(notifications).toHaveLength(1)
  expect(notifications[0].eventType).toBe('Restocked')
  expect(notifications[0].linkValue).toBe(String(f.productId))
  expect(notifications[0].readAt).not.toBeNull()
  await page.screenshot({ path: 'test-artifacts/restock-notification-mobile.png', fullPage: true })
})
