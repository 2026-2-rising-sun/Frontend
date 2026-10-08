import { test, expect, type APIRequestContext } from '@playwright/test'
import { randomUUID } from 'node:crypto'

async function bearer(request: APIRequestContext, account: string) {
  const response = await request.post('/api/member/v1/auth/login', { data: { email: `${account}@local.test`, password: account } })
  expect(response.ok()).toBeTruthy()
  return { Authorization: `Bearer ${(await response.json()).data.accessToken}` }
}

async function broadcast(request: APIRequestContext) {
  const seller = await bearer(request, 'seller')
  const channel = randomUUID().slice(0, 8)
  const created = await request.post('/api/live/v1/admin/broadcasts', {
    headers: { ...seller, 'Idempotency-Key': randomUUID() },
    data: { title: `좋아요 E2E ${channel}`, channelArn: `arn:aws:ivs:ap-northeast-2:123456789012:channel/${channel}`,
      scheduledAt: new Date().toISOString(), playbackUrl: `https://stub.live-video.net/${channel}.m3u8` },
  })
  expect(created.ok()).toBeTruthy()
  const dto = (await created.json()).data
  const image = await request.post('/api/shopping/v1/admin/product-images', {
    headers: seller, multipart: { file: { name: 'like-fixture.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=', 'base64') } },
  })
  expect(image.ok()).toBeTruthy()
  const product = await request.post('/api/shopping/v1/admin/products', {
    headers: { ...seller, 'X-Idempotency-Key': randomUUID() },
    data: { name: `좋아요 상품 ${channel}`, description: '좋아요 브라우저 검증', mainImageId: (await image.json()).data.imageId },
  })
  expect(product.ok()).toBeTruthy()
  const productId = (await product.json()).data.productId
  const sale = await request.post('/api/commerce/v1/sales', {
    headers: seller, data: { productId, price: 10000, initialStock: 10 },
  })
  expect(sale.ok()).toBeTruthy()
  expect((await request.patch(`/api/commerce/v1/sales/${(await sale.json()).id}/status`, {
    headers: seller, data: { status: 'ON_SALE' },
  })).ok()).toBeTruthy()
  const linked = await request.post(`/api/live/v1/admin/broadcasts/${dto.id}/products`, {
    headers: seller, data: { productId, expectedVersion: dto.version },
  })
  expect(linked.ok()).toBeTruthy()
  const refreshed = await request.get(`/api/live/v1/admin/broadcasts/${dto.id}`, { headers: seller })
  expect(refreshed.ok()).toBeTruthy()
  dto.version = (await refreshed.json()).data.version
  expect((await request.post(`/api/live/v1/admin/broadcasts/${dto.id}/start?expectedVersion=${dto.version}`, { headers: seller })).ok()).toBeTruthy()
  return { id: String(dto.id), seller }
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('아이디 또는 이메일').fill('user')
  await page.getByLabel('비밀번호', { exact: true }).fill('user')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
}

test('kind: one member like, cancel, reload and lost response replay after broadcast ended', async ({ page, request }) => {
  const live = await broadcast(request)
  const member = await bearer(request, 'user')
  await login(page)
  await page.goto(`/lives/${live.id}`)
  await page.getByRole('button', { name: '좋아요 보내기', exact: true }).click()
  await expect(page.getByRole('button', { name: '좋아요 취소', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('좋아요 1', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: '좋아요 취소', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '좋아요 취소', exact: true }).click()
  await expect(page.getByText('좋아요 0', { exact: true })).toBeVisible()
  const attempts: string[] = []
  await page.route(`**/broadcasts/${live.id}/likes/mine`, async route => {
    if (route.request().method() !== 'PUT') { await route.continue(); return }
    attempts.push(route.request().headers()['idempotency-key'])
    if (attempts.length === 1) { const saved = await route.fetch(); expect(saved.ok()).toBeTruthy(); await route.abort('failed') }
    else await route.continue()
  })
  await page.getByRole('button', { name: '좋아요 보내기', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청 다시 확인', exact: true })).toBeEnabled()
  expect((await request.post(`/api/live/v1/admin/broadcasts/${live.id}/end`, { headers: live.seller })).ok()).toBeTruthy()
  await expect(page.getByRole('button', { name: '같은 요청 다시 확인', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '같은 요청 다시 확인', exact: true }).click()
  await expect(page.getByRole('button', { name: '좋아요 취소', exact: true })).toBeDisabled()
  expect(attempts).toHaveLength(2)
  expect(attempts[1]).toBe(attempts[0])
  const personal = await request.get(`/api/live/v1/broadcasts/${live.id}/likes/mine`, { headers: member })
  const saved = (await personal.json()).data
  expect(saved.liked).toBe(true)
  expect(saved.total).toBe(1)
  expect(saved.stateVersion).toBe(3)
  expect(saved.version).toBe(3)
})

test('kind: duplicate concurrent intent increments once; seller participation and public cancellation SSE', async ({ page, request }) => {
  const live = await broadcast(request)
  await page.goto(`/lives/${live.id}`)
  await expect(page.getByRole('button', { name: '좋아요 보내기', exact: true })).toBeDisabled()
  const member = await bearer(request, 'user')
  const key = randomUUID()
  const path = `/api/live/v1/broadcasts/${live.id}/likes/mine`
  const duplicates = await Promise.all([1, 2].map(() => request.put(path, { headers: { ...member, 'Idempotency-Key': key }, data: { liked: true } })))
  for (const response of duplicates) expect(response.ok()).toBeTruthy()
  await expect(page.getByText('좋아요 1', { exact: true })).toBeVisible()
  expect((await request.put(path, { headers: { ...live.seller, 'Idempotency-Key': randomUUID() }, data: { liked: true } })).ok()).toBeTruthy()
  await expect(page.getByText('좋아요 2', { exact: true })).toBeVisible()
  expect((await request.put(path, { headers: { ...member, 'Idempotency-Key': randomUUID() }, data: { liked: false } })).ok()).toBeTruthy()
  await expect(page.getByText('좋아요 1', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('좋아요 1', { exact: true })).toBeVisible()
})
