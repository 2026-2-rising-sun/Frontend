import { test, expect } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  await page.route('**/api/notification/**', route => route.fulfill({ json: { success: true, data: { unreadCount: 0 } } }))
})
test('바로 구매 수량 변경 중에는 이전 견적으로 주문하지 않는다', async ({ page }) => {
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  let creates = 0
  await page.route(/\/api\/(member|commercecore|catalog|live)\//, async route => {
    const request = route.request(); const url = new URL(request.url())
    if (url.pathname.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'token', refreshToken: 'refresh' } } })
    if (url.pathname.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: 'buyer', email: 'buyer@test.dev', displayName: '회원', roles: ['USER'] } } })
    if (url.pathname.endsWith('/order-sheets/active')) return route.fulfill({ status: 204 })
    if (url.pathname.endsWith('/payment-groups/active')) return route.fulfill({ status: 204 })
    if (url.pathname.endsWith('/products/1')) return route.fulfill({ json: { productId: 1, name: '상품', mainImageUrl: null, salesStatus: 'ON_SALE', price: 10000, available: 5 } })
    if (url.pathname.endsWith('/orders/checkout')) {
      if (url.searchParams.get('quantity') === '2') {
        await delayed
        return route.fulfill({ status: 409, json: { code: 'CONFLICT', message: '최신 가격을 확인해 주세요.' } })
      }
      return route.fulfill({ json: { skuId: 101, available: 5, productName: '상품', unitPrice: 10000, totalAmount: 10000, orderable: true, reason: null } })
    }
    if (url.pathname.endsWith('/orders') && request.method() === 'POST') creates++
    return route.fulfill({ status: 404 })
  })
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('buyer@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click(); await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  await page.goto('/checkout?productId=1&quantity=1')
  await page.getByLabel('연락처').fill('01012345678'); await page.getByLabel('주문 내용을 확인했으며 결제에 동의합니다').check()
  const submit = page.getByRole('button', { name: '결제하기', exact: true })
  await expect(submit).toBeEnabled()
  await page.getByRole('button', { name: '수량 늘리기' }).click()
  await expect(submit).toBeDisabled()
  release()
  await expect(page.getByRole('alert').filter({ hasText: '최신 금액을 확인하지 못했어요' })).toBeVisible()
  await expect(submit).toBeDisabled()
  expect(creates).toBe(0)
})
test('상품 그룹의 버전·선택을 새 주문서에 보존하고 인증 뒤에만 승인하며 응답유실·새로고침을 복구한다', async ({ page }) => {
  let status = 'PENDING'; let approvals = 0; let created = false
  let createBody: Record<string, unknown> = {}; const quotes: unknown[] = []
  const cart = [{ id: 11, productId: 41, skuId: 71, quantity: 2, version: 0 }, { id: 12, productId: 42, skuId: 72, quantity: 1, version: 0 }]
  const expiresAt = new Date(Date.now() + 600000).toISOString()
  const processingExpiresAt = new Date(Date.now() + 1200000).toISOString()
  const payment = () => ({ orderNumber:'OS-1', orderStatus:status, paymentId:9, paymentStatus:status === 'PROCESSING' ? 'UNKNOWN' : status === 'PAID' ? 'APPROVED':'CREATED',pgOrderId:'pg-latest',amount:25000,expiresAt,processingExpiresAt:status === 'PENDING' ? null:processingExpiresAt,refundStatus:null })
  const view = () => ({order:{orderNumber:'OS-1',status,totalAmount:25000,discountAmount:0,payableAmount:25000,expiresAt,processingExpiresAt:payment().processingExpiresAt,items:cart.map(i=>({orderItemId:i.id+100,skuId:i.skuId,productId:i.productId,productName:'상품 '+i.productId,unitPrice:i.id===11?10000:5000,quantity:i.quantity,sourceCartItemId:i.id,sourceCartVersion:i.version}))},payment:payment()})
  await page.route('http://127.0.0.1:57040/fixture/authentications', route => { const input=route.request().postDataJSON(); expect(input.pgOrderId).toBe('pg-latest'); return route.fulfill({json:{label:'PG_AUTH_DOUBLE',outcome:'authenticated',paymentKey:'authenticated-only',orderId:input.pgOrderId,amount:input.amount}}) })
  await page.route(/\/api\/(member|commercecore|catalog|live)\//, async route => {
    const request=route.request(); const path=new URL(request.url()).pathname; const json=(body:unknown)=>route.fulfill({json:body})
    if(path.includes('/auth/'))return json({success:true,data:{accessToken:'test-token',refreshToken:'test-refresh'}})
    if(path.endsWith('/members/me'))return json({success:true,data:{memberId:'buyer',displayName:'회원',email:'user@test.dev',roles:['USER']}})
    if(path.endsWith('/order-sheets/active'))return created?json(view()):route.fulfill({status:204})
    if(path.endsWith('/payment-groups/active'))return route.fulfill({status:204})
    if(path.endsWith('/cart/items/11')&&request.method()==='PATCH'){cart[0].quantity=request.postDataJSON().quantity;cart[0].version++;return json(cart[0])}
    if(path.endsWith('/cart/items'))return json(cart.map(i=>({productId:i.productId,productName:'상품 '+i.productId,saleEnabled:true,items:[{...i,unitPrice:i.id===11?10000:5000,available:10,purchasable:true}]})))
    if(path.endsWith('/cart/checkout')){quotes.push(request.postDataJSON());return json({items:cart.map(i=>({itemId:i.id,version:i.version,productId:i.productId,productName:'상품 '+i.productId,quantity:i.quantity,unitPrice:i.id===11?10000:5000,totalAmount:i.id===11?20000:5000})),totalAmount:25000,discountAmount:0,payableAmount:25000})}
    if(path.endsWith('/order-sheets')&&request.method()==='POST'){created=true;createBody=request.postDataJSON();return route.abort('connectionreset')}
    if(path.endsWith('/order-sheets/OS-1'))return json(view())
    if(path.endsWith('/payment/checkouts'))return json(payment())
    if(path.endsWith('/payment/approval')){expect(request.postDataJSON()).toEqual({paymentKey:'authenticated-only',pgOrderId:'pg-latest',amount:25000});approvals++;status='PROCESSING';return route.abort('connectionreset')}
    return route.fulfill({status:404})
  })
  await page.goto('/login');await page.getByLabel('아이디 또는 이메일').fill('user@test.dev');await page.getByLabel('비밀번호',{exact:true}).fill('password');await page.getByRole('button',{name:'로그인',exact:true}).click();await expect(page.getByRole('heading',{name:'내 계정',exact:true})).toBeVisible()
  await page.goto('/cart');const total=page.getByRole('region',{name:'장바구니 합계'});await expect(total).toContainText('25,000원')
  await page.getByLabel('상품 42 선택').uncheck();await expect(total).toContainText('20,000원')
  const row=page.locator('section').filter({has:page.getByRole('heading',{name:'상품 41',exact:true})})
  await row.getByRole('button',{name:'수량 늘리기'}).click();await expect(total).toContainText('30,000원');await expect(page.getByLabel('상품 42 선택')).not.toBeChecked()
  await row.getByRole('button',{name:'수량 줄이기'}).click();await expect(total).toContainText('20,000원')
  await page.getByLabel('전체 선택').check();await page.getByRole('link',{name:'선택 상품 주문',exact:true}).click()
  await expect.poll(()=>quotes[0]).toEqual({items:[{itemId:11,version:2},{itemId:12,version:0}]})
  await page.getByLabel('연락처').fill('01012345678');await page.getByLabel('상품별 주문과 통합 결제 금액을 확인했습니다').check();await page.getByRole('button',{name:'통합 주문 만들기'}).click()
  await expect(page).toHaveURL(/order-sheets\/OS-1/);expect(createBody).toMatchObject({cartItems:[{itemId:11,version:2},{itemId:12,version:0}],expectedAmount:25000})
  await expect(page.getByText('결제 인증을 진행해 주세요',{exact:true})).toBeVisible();expect(approvals).toBe(0)
  await page.getByRole('button',{name:'결제 인증하기',exact:true}).click();await expect(page.getByText('결제 결과를 확인하고 있어요',{exact:true})).toBeVisible()
  await page.reload();await expect(page.getByText('결제 결과를 확인하고 있어요',{exact:true})).toBeVisible();expect(approvals).toBe(1)
  status='PAID';await page.getByRole('button',{name:'주문 상태 다시 확인'}).click();await expect(page.getByText('결제가 완료되었어요',{exact:true})).toBeVisible()
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k==='commerce:buyer:sheet-cart'||k==='commerce:buyer:sheet-approval:OS-1'||k==='sheet:buyer:OS-1:approval'))).toEqual([])
  await page.screenshot({path:'test-artifacts/order-sheet-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'test-artifacts/order-sheet-mobile.png',fullPage:true})
})

test('changing payment group route clears previous purchase actions while the new group fails', async ({ page }) => {
  let mutations = 0
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  const expiresAt = new Date(Date.now() + 900000).toISOString()
  await page.route(/\/api\/(member|commercecore|catalog|live)\//, async route => {
    const request = route.request(); const path = new URL(request.url()).pathname
    if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'test-token', refreshToken: 'test-refresh' } } })
    if (path.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: ['USER'] } } })
    if (path.endsWith('/payment-groups/PG-A')) return route.fulfill({ json: { groupNumber: 'PG-A', status: 'PENDING_PAYMENT', totalAmount: 10000, expiresAt, orders: [], paymentId: null } })
    if (path.endsWith('/payment-groups/PG-B')) { await delayed; return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: '새 결제 묶음을 찾을 수 없어요.' } }) }
    if (request.method() === 'POST' && (path.endsWith('/payments') || path.endsWith('/cancel'))) mutations++
    return route.fulfill({ status: 404, json: { message: path } })
  })
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('user@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click(); await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  await page.goto('/payment-groups/PG-A')
  await expect(page.getByRole('button', { name: '통합 결제하기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '전체 주문 취소' })).toBeVisible()
  // 마운트된 앱과 로그인 계정은 유지한 채 경로만 변경한다.
  await page.evaluate(() => { history.pushState({}, '', '/payment-groups/PG-B'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page).toHaveURL(/\/payment-groups\/PG-B$/)
  await expect(page.getByRole('button', { name: '통합 결제하기' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전체 주문 취소' })).toHaveCount(0)
  await expect(page.getByText('결제 묶음 PG-A', { exact: true })).toHaveCount(0)
  release()
  await expect(page.getByText('새 결제 묶음을 찾을 수 없어요.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '통합 결제하기' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전체 주문 취소' })).toHaveCount(0)
  expect(mutations).toBe(0)
})

test('부분 환불 성공 이력이 있으면 전체 환불을 막고 서버가 확인한 남은 상품만 선택한다', async ({ page }) => {
  await page.route(/\/api\/(member|commercecore|notification)\//, async route => {
    const path = new URL(route.request().url()).pathname
    if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'test-token', refreshToken: 'test-refresh' } } })
    if (path.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: ['USER'] } } })
    if (path.endsWith('/unread-count')) return route.fulfill({ json: { success: true, data: { unreadCount: 0 } } })
    if (path.endsWith('/refunds')) return route.fulfill({ json: [{ id: 1, paymentGroupNumber: 'PG-PARTIAL', refundAmount: 5000, cumulativeRefundAmount: 5000, status: 'SUCCESS', requestedAt: '2026-10-17T00:00:00Z', resolvedAt: '2026-10-17T00:00:01Z', targets: [], recovery: null }] })
    if (path.endsWith('/refundable-targets')) return route.fulfill({ json: [{ orderId: 1, cartItemId: 101, productName: '환불 완료 상품', quantity: 1, refundAmount: 5000, refundable: false, unavailableReason: 'ALREADY_REQUESTED' }, { orderId: 2, cartItemId: 102, productName: '남은 상품', quantity: 1, refundAmount: 5000, refundable: true, unavailableReason: null }] })
    if (path.endsWith('/payment-groups/PG-PARTIAL')) return route.fulfill({ json: { groupNumber: 'PG-PARTIAL', status: 'PAID', totalAmount: 10000, payableAmount: 10000, discountAmount: 0, paymentId: 7, expiresAt: null, orders: [] } })
    return route.fulfill({ status: 404 })
  })
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('user@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  await page.goto('/payment-groups/PG-PARTIAL')
  await expect(page.getByText('일부 상품의 환불 이력이 있어요', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '전체 환불 요청', exact: true })).toHaveCount(0)
  await expect(page.getByText('아래에서 환불 가능한 남은 상품을 선택할 수 있어요.', { exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: '환불 완료 상품 · 1개' })).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: '남은 상품 · 1개' })).toBeEnabled()
  await expect(page.getByRole('button', { name: '선택 상품 환불 요청', exact: true })).toBeDisabled()
  await page.getByRole('checkbox', { name: '남은 상품 · 1개' }).check()
  await expect(page.getByRole('button', { name: '선택 상품 환불 요청', exact: true })).toBeEnabled()
})

for (const grouped of [false, true]) {
  test(`${grouped ? '0원 묶음' : '단건'} 결제 SUCCESS 응답 후에도 Core 주문 반영까지 완료를 표시하지 않는다`, async ({ page }) => {
    let started = false; let applied = false; let starts = 0
    const amount = grouped ? 0 : 1000
    const status = () => applied ? 'PAID' : started ? 'PAYMENT_CONFIRMING' : 'PENDING_PAYMENT'
    const order = () => ({ orderNumber: 'OD-LAG', groupNumber: grouped ? 'PG-LAG' : null, status: status(), productName: '반영 대기 상품', quantity: 1, unitPrice: 1000, totalAmount: 1000, discountAmount: 1000 - amount, payableAmount: amount, buyerName: '회원', createdAt: '2026-11-09T00:00:00Z', expiresAt: null })
    await page.route(/\/api\/(member|commercecore|notification)\//, async route => {
      const path = new URL(route.request().url()).pathname
      const json = (body: unknown) => route.fulfill({ json: body })
      if (path.includes('/auth/')) return json({ success: true, data: { accessToken: 'token', refreshToken: 'refresh' } })
      if (path.endsWith('/members/me')) return json({ success: true, data: { memberId: 'buyer', displayName: '회원', email: 'buyer@test.dev', roles: ['USER'] } })
      if (path.endsWith('/unread-count')) return json({ success: true, data: { unreadCount: 0 } })
      if (path.endsWith('/payments') && route.request().method() === 'POST') { started = true; starts++; return json({ paymentId: 9, status: 'SUCCESS' }) }
      if (path.endsWith('/payments/9')) return json({ paymentId: 9, status: 'SUCCESS' })
      if (path.endsWith('/orders/OD-LAG')) return json(order())
      if (path.endsWith('/payment-groups/PG-LAG')) return json({ groupNumber: 'PG-LAG', status: status(), orders: [order()], totalAmount: 1000, discountAmount: 1000 - amount, payableAmount: amount, paymentId: started ? 9 : null, expiresAt: null })
      if (path.endsWith('/refunds')) return json([])
      return route.fulfill({ status: 404 })
    })
    await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('buyer@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
    await page.goto(grouped ? '/payment-groups/PG-LAG' : '/orders/OD-LAG')
    await page.getByRole('button', { name: grouped ? '통합 결제하기' : '결제하기', exact: true }).click()
    const success = page.getByText(grouped ? '통합 결제가 완료되었어요' : '결제가 완료되었어요', { exact: true })
    await expect(page.getByText('결제 결과를 확인하고 있어요', { exact: true })).toBeVisible()
    await expect(success).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('결제 결과를 확인하고 있어요', { exact: true })).toBeVisible()
    await expect(success).toHaveCount(0)
    expect(starts).toBe(1)
    applied = true
    await page.getByRole('button', { name: '결과 다시 확인', exact: true }).click()
    await expect(success).toBeVisible()
    expect(starts).toBe(1)
  })
}


test('Cart 그룹의 가격과 구매불가 표시를 Catalog 조회값으로 덮지 않는다', async ({ page }) => {
  let catalogCalls = 0
  await page.route(/\/api\/(member|commercecore|catalog|live)\//, async route => {
    const path = new URL(route.request().url()).pathname
    const json = (body: unknown) => route.fulfill({ json: body })
    if (path.includes('/auth/')) return json({ success: true, data: { accessToken: 'token', refreshToken: 'refresh' } })
    if (path.endsWith('/members/me')) return json({ success: true, data: { memberId: 'buyer', email: 'buyer@test.dev', displayName: '회원', roles: ['USER'] } })
    if (path.endsWith('/payment-groups/active')) return route.fulfill({ status: 204 })
    if (path.endsWith('/cart/items')) return json([{ productId: 41, productName: '현재 서버 가격', mainImageUrl: null, saleEnabled: false, items: [{ id: 11, skuId: 71, quantity: 2, version: 7, unitPrice: 1200, available: 0, skuStatus: 'SOLD_OUT', purchasable: false }] }])
    if (path.includes('/catalog/')) { catalogCalls++; return json({ productId: 41, name: '오래된 상품', mainImageUrl: null, price: 99999, available: 100, salesStatus: 'ON_SALE' }) }
    return route.fulfill({ status: 404 })
  })
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('buyer@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  await page.goto('/cart')
  await expect(page.getByRole('heading', { name: '현재 서버 가격', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: '장바구니 합계' })).toContainText('2,400원')
  await expect(page.getByText('현재 구매할 수 없는 상품이에요.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '선택 상품 주문', exact: true })).toHaveAttribute('aria-disabled', 'true')
  expect(catalogCalls).toBe(0)
})

for (const outcome of ['cancelled', 'failed', 'authenticated-after-expiry'] as const) {
  test(`인증 ${outcome} 결과는 승인이나 주문 취소로 바꾸지 않는다`, async ({ page }) => {
    let status='PENDING'; let approvals=0; let cancellations=0
    const payment=()=>({orderNumber:'OS-auth',orderStatus:status,paymentId:5,paymentStatus:'CREATED',pgOrderId:'pg-auth',amount:4000,expiresAt:new Date(Date.now()+600000).toISOString(),processingExpiresAt:null,refundStatus:null})
    await page.route('http://127.0.0.1:57040/fixture/authentications',route=>{
      if(outcome==='authenticated-after-expiry')status='EXPIRED'
      return route.fulfill({json:outcome==='authenticated-after-expiry'?{label:'PG_AUTH_DOUBLE',outcome:'authenticated',paymentKey:'test-key',orderId:'pg-auth',amount:4000}:{label:'PG_AUTH_DOUBLE',outcome}})
    })
    await page.route(/\/api\/(member|commercecore)\//,route=>{
      const path=new URL(route.request().url()).pathname
      if(path.includes('/auth/'))return route.fulfill({json:{success:true,data:{accessToken:'test',refreshToken:'refresh'}}})
      if(path.endsWith('/members/me'))return route.fulfill({json:{success:true,data:{memberId:'auth-member',email:'user@test.dev',displayName:'회원',roles:['USER']}}})
      if(path.endsWith('/payment/approval')){approvals++;return route.fulfill({status:500})}
      if(path.endsWith('/cancel')){cancellations++;return route.fulfill({status:204})}
      if(path.endsWith('/payment/checkouts'))return route.fulfill({json:payment()})
      return route.fulfill({json:{order:{orderNumber:'OS-auth',status,totalAmount:4000,discountAmount:0,payableAmount:4000,items:[]},payment:payment()}})
    })
    await page.goto('/login');await page.getByLabel('아이디 또는 이메일').fill('user@test.dev');await page.getByLabel('비밀번호',{exact:true}).fill('password');await page.getByRole('button',{name:'로그인',exact:true}).click();await expect(page.getByRole('heading',{name:'내 계정',exact:true})).toBeVisible()
    await page.goto('/order-sheets/OS-auth');await page.getByRole('button',{name:'결제 인증하기',exact:true}).click()
    if(outcome==='cancelled')await expect(page.getByText('결제 인증을 취소했어요. 아직 승인 요청은 보내지 않았어요.')).toBeVisible()
    else if(outcome==='failed')await expect(page.getByText('결제 인증에 실패했어요. 승인 요청은 보내지 않았어요.')).toBeVisible()
    else await expect(page.getByText('주문 기한이 지났어요',{exact:true})).toBeVisible()
    expect(approvals).toBe(0);expect(cancellations).toBe(0)
  })
}

test('늦은 승인 환불요청·환불실패·환불성공을 구분하고 새 승인을 허용하지 않는다',async({page})=>{
  let refundStatus='REQUESTED';let approvals=0
  await page.route(/\/api\/(member|commercecore)\//,route=>{
    const path=new URL(route.request().url()).pathname
    if(path.includes('/auth/'))return route.fulfill({json:{success:true,data:{accessToken:'test',refreshToken:'refresh'}}})
    if(path.endsWith('/members/me'))return route.fulfill({json:{success:true,data:{memberId:'late-member',email:'user@test.dev',displayName:'회원',roles:['USER']}}})
    if(path.endsWith('/approval'))approvals++
    return route.fulfill({json:{order:{orderNumber:'OS-late',status:'EXPIRED',totalAmount:4000,discountAmount:0,payableAmount:4000,items:[]},payment:{orderNumber:'OS-late',orderStatus:'EXPIRED',paymentStatus:'APPROVED',refundStatus,pgOrderId:'pg-late',amount:4000,expiresAt:new Date(Date.now()-60000).toISOString(),processingExpiresAt:null}}})
  })
  await page.goto('/login');await page.getByLabel('아이디 또는 이메일').fill('user@test.dev');await page.getByLabel('비밀번호',{exact:true}).fill('password');await page.getByRole('button',{name:'로그인',exact:true}).click();await expect(page.getByRole('heading',{name:'내 계정',exact:true})).toBeVisible()
  await page.goto('/order-sheets/OS-late');await expect(page.getByText('늦은 승인 환불을 기다리고 있어요',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'결제 인증하기',exact:true})).toHaveCount(0)
  refundStatus='FAILED';await page.getByRole('button',{name:'주문 상태 다시 확인'}).click();await expect(page.getByText('늦은 승인 환불 결과를 확인해 주세요',{exact:true})).toBeVisible()
  refundStatus='SUCCEEDED';await page.getByRole('button',{name:'주문 상태 다시 확인'}).click();await expect(page.getByText('늦은 승인 환불이 완료되었어요',{exact:true})).toBeVisible();expect(approvals).toBe(0)
})

test('단건은 견적의 명시적 SKU·쿠폰할인후 금액으로 새 주문서만 준비한다',async({page})=>{
  let created:Record<string,unknown>|null=null;let approvals=0
  const p={orderNumber:'OS-direct',orderStatus:'PENDING',paymentStatus:'CREATED',paymentId:1,pgOrderId:'pg-direct',amount:6000,expiresAt:new Date(Date.now()+600000).toISOString(),processingExpiresAt:null,refundStatus:null}
  await page.route(/\/api\/(member|commercecore|catalog)\//,route=>{
    const req=route.request();const path=new URL(req.url()).pathname
    if(path.includes('/auth/'))return route.fulfill({json:{success:true,data:{accessToken:'test',refreshToken:'refresh'}}})
    if(path.endsWith('/members/me'))return route.fulfill({json:{success:true,data:{memberId:'direct-member',email:'user@test.dev',displayName:'회원',roles:['USER']}}})
    if(path.endsWith('/active'))return route.fulfill({status:204})
    if(path.endsWith('/me/coupons'))return route.fulfill({json:{success:true,data:[{couponId:'coupon-direct',name:'직접쿠폰',fixedDiscount:2000,status:'AVAILABLE',expiresAt:new Date(Date.now()+86400000).toISOString()}]}})
    if(path.endsWith('/products/41'))return route.fulfill({json:{productId:41,name:'상품41',price:4000,available:20,status:'ON_SALE',mainImageUrl:null}})
    if(path.endsWith('/orders/checkout')){const coupon=new URL(req.url()).searchParams.has('couponId');return route.fulfill({json:{skuId:71,available:20,productName:'상품41',unitPrice:4000,totalAmount:8000,orderable:true,discountAmount:coupon?2000:0,payableAmount:coupon?6000:8000}})}
    if(path.endsWith('/order-sheets')&&req.method()==='POST'){created=req.postDataJSON();return route.fulfill({status:201,json:{order:{orderNumber:'OS-direct',totalAmount:8000,discountAmount:2000,payableAmount:6000,items:[]},payment:p}})}
    if(path.endsWith('/approval'))approvals++
    if(path.endsWith('/order-sheets/OS-direct'))return route.fulfill({json:{order:{orderNumber:'OS-direct',totalAmount:8000,discountAmount:2000,payableAmount:6000,items:[]},payment:p}})
    return route.fulfill({status:404})
  })
  await page.goto('/login');await page.getByLabel('아이디 또는 이메일').fill('user@test.dev');await page.getByLabel('비밀번호',{exact:true}).fill('password');await page.getByRole('button',{name:'로그인',exact:true}).click();await expect(page.getByRole('heading',{name:'내 계정',exact:true})).toBeVisible()
  await page.goto('/checkout?productId=41&quantity=2');await page.getByRole('combobox',{name:'사용할 보유 쿠폰'}).selectOption('coupon-direct');await page.getByLabel('연락처').fill('01012345678');await page.getByLabel('주문 내용을 확인했으며 결제에 동의합니다').check();await page.getByRole('button',{name:'결제하기',exact:true}).click()
  await expect(page).toHaveURL(/order-sheets\/OS-direct/);expect(created).toEqual({items:[{skuId:71,quantity:2}],buyerName:'회원',buyerPhone:'01012345678',expectedAmount:6000,couponId:'coupon-direct',couponSkuId:71});expect(approvals).toBe(0)
})
