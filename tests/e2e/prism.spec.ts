import { test, expect } from '@playwright/test'
test('Prism: anonymous product read and login-gated checkout/cart', async ({ page, request }) => {
  const result = await request.get('/api/shopping/v1/products/1'); expect(result.ok()).toBeTruthy()
  const product = (await result.json()).data
  await page.goto('/products/1'); await expect(page.getByRole('heading', { name: product.name, exact: true })).toBeVisible()
  await page.getByRole('link', { name: '바로 구매', exact: true }).click()
  await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible()
  await page.getByLabel('아이디 또는 이메일').fill('user'); await page.getByLabel('비밀번호', { exact: true }).fill('user')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '주문서', exact: true })).toBeVisible()
  await expect(page.getByLabel('주문자 이름')).toBeVisible(); await expect(page.getByLabel('연락처')).toBeVisible()
  await expect(page.getByLabel('주문 조회 비밀번호')).toHaveCount(0)
  await page.getByRole('link', { name: '장바구니', exact: true }).click()
  await expect(page.getByRole('heading', { name: '장바구니', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '삭제', exact: true }).first()).toBeVisible()
})
test('Prism: public Live DTO and reads render without login', async ({ page, request }) => {
  const result = await request.get('/api/live/v1/broadcasts/12'); expect(result.ok()).toBeTruthy()
  const live = (await result.json()).data
  await page.goto('/lives/12'); await expect(page.getByRole('heading', { name: live.title, exact: true })).toBeVisible()
  await page.getByRole('tab', { name: '채팅', exact: true }).click()
  await expect(page.getByRole('link', { name: '로그인하고 참여하기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '좋아요 보내기' })).toBeDisabled()
  await expect(page.getByLabel('최근 채팅')).toBeVisible()
})
test('Prism: member order history and logout', async ({ page }) => {
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('user'); await page.getByLabel('비밀번호', { exact: true }).fill('user')
  await page.getByRole('button', { name: '로그인', exact: true }).click(); await expect(page.getByRole('heading', { name: '내 계정' })).toBeVisible()
  await page.getByRole('link', { name: '내 주문', exact: true }).first().click(); await expect(page.getByRole('heading', { name: '내 주문', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click(); await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible()
})
