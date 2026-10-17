import { test, expect } from '@playwright/test'

for (const { cart, failure } of [{ cart: false, failure: false }, { cart: true, failure: false }, { cart: false, failure: true }]) {
  test(`${cart ? 'cart' : 'direct'} checkout ${failure ? 'blocks lookup failure and retries' : 'only offers applicable coupons'}`, async ({ page }) => {
    let unavailable = false
    let lookupFailure = failure
    await page.route(/\/api\/(member|commerce|shopping|live|notification)\//, async route => {
      const request = route.request(); const url = new URL(request.url()); const path = url.pathname
      const json = (data: unknown) => route.fulfill({ json: { success: true, data } })
      if (path.includes('/auth/')) return json({ accessToken: 'test', refreshToken: 'test' })
      if (path.endsWith('/members/me')) return json({ memberId: 'user', email: 'user@local.test', displayName: '테스트 유저', roles: ['USER'] })
      if (path.endsWith('/payment-groups/active')) return route.fulfill({ status: 204 })
      if (path.endsWith('/me/coupons')) return json(['valid', 'wrong'].map(id => ({ id, couponId: id, name: id === 'valid' ? '상품 전용 쿠폰' : '다른 상품 쿠폰', fixedDiscount: 1000, status: 'AVAILABLE', claimedAt: '2026-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z' })))
      if (path.endsWith('/products/1')) return json({ productId: 1, name: '상품', price: 8900, available: 10, salesStatus: 'ON_SALE', purchasable: true })
      if (path.endsWith('/cart/items')) return json([{ id: 1, productId: 1, quantity: 1, version: 0 }])
      if (path.endsWith('/orders/checkout') || path.endsWith('/cart/checkout')) {
        const selected = cart ? request.postDataJSON().couponId : url.searchParams.get('couponId')
        if (selected && lookupFailure) return route.fulfill({ status: 503, json: { error: { message: '일시적으로 조회할 수 없습니다.' } } })
        if (selected === 'wrong' || (selected && unavailable)) return route.fulfill({ status: 409, json: { error: { code: 'CONFLICT', message: '적용 대상 상품이 없습니다.' } } })
        const quantity = cart ? 1 : Number(url.searchParams.get('quantity'))
        const totalAmount = 8900 * quantity
        const discountAmount = selected ? 1000 : 0
        return json({ productId: 1, productName: '상품', unitPrice: 8900, quantity, totalAmount, discountAmount, payableAmount: totalAmount - discountAmount, orderable: true, available: 10, salesStatus: 'ON_SALE', items: [{ itemId: 1, version: 0, productId: 1, productName: '상품', quantity, unitPrice: 8900, totalAmount }] })
      }
      return route.fulfill({ status: 404, json: { message: path } })
    })
    await page.goto('/login')
    await page.getByLabel('아이디 또는 이메일').fill('user@local.test')
    await page.getByLabel('비밀번호', { exact: true }).fill('user')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page).not.toHaveURL(/\/login$/)
    await page.goto(cart ? '/checkout/cart?itemIds=1' : '/checkout?productId=1&quantity=1')
    const picker = page.getByRole('combobox', { name: '사용할 보유 쿠폰' })
    if (failure) {
      await expect(page.getByText('적용 가능한 쿠폰을 확인하지 못했어요', { exact: true })).toBeVisible()
      await expect(picker).toBeDisabled()
      await expect(picker.locator('option')).toHaveText(['쿠폰 사용 안 함'])
      await expect(page.getByText('이 주문에 적용 가능한 보유 쿠폰이 없어요.')).toHaveCount(0)
      lookupFailure = false
      await page.getByRole('button', { name: '다시 조회', exact: true }).click()
    }
    await expect(picker).toBeEnabled()
    await expect(picker.locator('option')).toHaveText(['쿠폰 사용 안 함', '상품 전용 쿠폰 · 1,000원 할인'])
    await picker.selectOption('valid')
    await expect(page.getByText('7,900원', { exact: true })).toBeVisible()
    if (!cart) {
      unavailable = true
      await page.getByRole('button', { name: '수량 늘리기' }).click()
      await expect(picker.locator('option')).toHaveText(['쿠폰 사용 안 함'])
      await expect(picker).toHaveValue('')
      await expect(page.getByText('이 주문에 적용 가능한 보유 쿠폰이 없어요.')).toBeVisible()
      await expect(page.getByText('17,800원', { exact: true }).last()).toBeVisible()
    }
  })
}
