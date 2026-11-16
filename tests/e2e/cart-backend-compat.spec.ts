import { test, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import type { CartProductGroupDto } from '../../src/api/http/mappers'
const required = (name: string) => { const value=process.env[name]; if(!value)throw new Error(`격리 실서버 검증 설정 ${name}이 필요합니다.`);return value }

test('실제 Core·Payment와 인증대역에서 쿠폰 주문·승인 결과·Cart 버전 조건부 정리를 확인한다',async({page},info)=>{
  const backendSha=required('CART_E2E_BACKEND_SHA');const frontendSha=required('CART_E2E_FRONTEND_SHA')
  const productIds=required('CART_E2E_PRODUCT_IDS').split(',').map(Number)
  expect(productIds.length).toBe(2);expect(new Set(productIds).size).toBe(2);expect(productIds.every(id=>Number.isSafeInteger(id)&&id>0)).toBe(true)
  const calls:{method:string;path:string;body:unknown;status:number}[]=[]
  page.on('response',response=>{
    const req=response.request();const path=new URL(req.url()).pathname
    if(path.startsWith('/api/commercecore/')){const body=req.postDataJSON();calls.push({method:req.method(),path,body:body?.paymentKey?{...body,paymentKey:'[PG_AUTH_DOUBLE]'}:body,status:response.status()})}
  })
  await page.goto('/login');await page.getByLabel('아이디 또는 이메일').fill(required('CART_E2E_EMAIL'));await page.getByLabel('비밀번호',{exact:true}).fill(required('CART_E2E_PASSWORD'))
  const login=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/auth/login'));await page.getByRole('button',{name:'로그인',exact:true}).click();const data=await(await login).json()
  await expect(page.getByRole('heading',{name:'내 계정',exact:true})).toBeVisible()
  const headers={Authorization:`Bearer ${data.data?.accessToken??data.accessToken}`};const api='/api/commercecore/v1';const ids:string[]=[];let number:string|undefined
  try{
    const empty=await page.request.get(`${api}/cart/items`,{headers});expect(empty.status()).toBe(200);expect(await empty.json()).toEqual([])
    for(const [i,productId]of productIds.entries()){const r=await page.request.post(`${api}/cart/items`,{headers,data:{productId,quantity:i===0?2:1}});expect(r.status()).toBe(201);ids.push(String((await r.json()).id))}
    const r=await page.request.get(`${api}/cart/items`,{headers});const wire:CartProductGroupDto[]=await r.json()
    const g1=wire.find(g=>Number(g.productId)===productIds[0])!;const g2=wire.find(g=>Number(g.productId)===productIds[1])!;const first=g1.items[0];const second=g2.items[0]
    expect(String(first.id)).not.toBe(String(first.skuId));expect(String(first.id)).not.toBe(String(g1.productId))
    const price=first.unitPrice??NaN;const secondPrice=second.unitPrice??NaN
    await page.goto('/cart');await page.reload();const total=page.getByRole('region',{name:'장바구니 합계'})
    await expect(total).toContainText((price*2+secondPrice).toLocaleString('ko-KR')+'원')
    await page.getByLabel(`${g2.productName} 선택`,{exact:true}).uncheck();await expect(total).toContainText((price*2).toLocaleString('ko-KR')+'원')
    const row=page.locator('section').filter({has:page.getByRole('heading',{name:g1.productName!,exact:true})})
    await row.getByRole('button',{name:'수량 늘리기'}).click();await expect(total).toContainText((price*3).toLocaleString('ko-KR')+'원')
    await page.getByLabel(`${g2.productName} 선택`,{exact:true}).check();await page.reload();await expect(total).toContainText((price*3+secondPrice).toLocaleString('ko-KR')+'원')
    await page.getByRole('link',{name:'선택 상품 주문',exact:true}).click();await expect(page.getByRole('heading',{name:'선택 상품 주문서',exact:true})).toBeVisible()
    const coupon=required('CART_E2E_COUPON_ID');await page.getByRole('combobox',{name:'사용할 보유 쿠폰'}).selectOption(coupon);await page.getByRole('combobox',{name:'쿠폰 적용 상품'}).selectOption(String(first.id))
    await page.getByLabel('연락처').fill('01012345678');await page.getByLabel('상품별 주문과 통합 결제 금액을 확인했습니다').check()
    const createdResponse=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/order-sheets')&&r.request().method()==='POST')
    await page.getByRole('button',{name:'통합 주문 만들기'}).click();const created=await createdResponse;expect(created.status()).toBe(201);const view=await created.json();number=view.order.orderNumber
    expect(view.payment.orderStatus).toBe('PENDING');expect(view.payment.processingExpiresAt).toBeNull()
    const body=created.request().postDataJSON();expect(body).toMatchObject({cartItems:[{itemId:Number(first.id),version:first.version+1},{itemId:Number(second.id),version:second.version}],couponId:coupon,couponSkuId:first.skuId,expectedAmount:view.order.payableAmount})
    expect(view.order.discountAmount).toBe(Number(required('CART_E2E_COUPON_DISCOUNT')))
    expect(view.order.totalAmount).toBe(price*3+secondPrice)
    await expect(page).toHaveURL(new RegExp(`/order-sheets/${number}`));await expect(page.getByText('결제 인증을 진행해 주세요',{exact:true})).toBeVisible()
    expect(calls.filter(c=>c.path.endsWith('/approval')).length).toBe(0)
    // 승인 전에 수정한 Cart 행은 원본 version과 달라져 성공 후에도 보존돼야 한다.
    const changed=await page.request.patch(`${api}/cart/items/${first.id}`,{headers,data:{quantity:4}});expect(changed.status()).toBe(200);const current=await changed.json();expect(current.version).toBe(first.version+2)
    await page.getByRole('button',{name:'결제 인증하기',exact:true}).click();await expect(page.getByText('결제가 완료되었어요',{exact:true})).toBeVisible({timeout:45000})
    await page.reload();await expect(page.getByText('결제가 완료되었어요',{exact:true})).toBeVisible();expect(calls.filter(c=>c.path.endsWith('/approval')).length).toBe(1)
    const final=await page.request.get(`${api}/order-sheets/${number}`,{headers});expect(final.status()).toBe(200);const finalView=await final.json();expect(finalView.payment.orderStatus).toBe('PAID');expect(finalView.order.payableAmount).toBe(view.order.payableAmount)
    const rows:CartProductGroupDto[]=await(await page.request.get(`${api}/cart/items`,{headers})).json();const all=rows.flatMap(g=>g.items)
    expect(all.find(i=>String(i.id)===String(first.id))).toMatchObject({quantity:4,version:first.version+2});expect(all.find(i=>String(i.id)===String(second.id))).toBeUndefined()
    const coupons=await(await page.request.get(`${api}/me/coupons`,{headers})).json();expect(coupons.data.find((c:{couponId:string})=>c.couponId===coupon)?.status).toBe('USED')
    await page.screenshot({path:info.outputPath('paid-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:info.outputPath('paid-mobile.png'),fullPage:true})
    await writeFile(info.outputPath('real-relay-evidence.json'),JSON.stringify({backendSha,frontendSha,wire,calls,created:view,final:finalView,cartAfter:rows,authentication:'PG_AUTH_DOUBLE',realPg:false},null,2))
  }finally{
    if(number){const view=await(await page.request.get(`${api}/order-sheets/${number}`,{headers})).json();if(view.payment.orderStatus==='PENDING')expect((await page.request.post(`${api}/order-sheets/${number}/cancel`,{headers})).status()).toBe(204)}
    for(const id of ids){const r=await page.request.delete(`${api}/cart/items/${id}`,{headers});expect([204,404]).toContain(r.status())}
  }
})
