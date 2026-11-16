import { test, expect, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const required=(key:string)=>{const value=process.env[key];if(!value)throw new Error(`${key} 검증 설정이 필요합니다.`);return value}
async function login(page:Page){
  await page.goto('/login');await page.getByLabel('아이디 또는 이메일').fill(required('ORDER_SHEET_E2E_EMAIL'));await page.getByLabel('비밀번호',{exact:true}).fill(required('ORDER_SHEET_E2E_PASSWORD'))
  const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/auth/login'));await page.getByRole('button',{name:'로그인',exact:true}).click();const data=await(await response).json();await expect(page.getByRole('heading',{name:'내 계정',exact:true})).toBeVisible()
  return {Authorization:`Bearer ${data.data.accessToken}`}
}
async function create(page:Page,coupon=false){
  await page.goto(`/checkout?productId=${required('ORDER_SHEET_E2E_PRODUCT_ID')}&quantity=2`);await expect(page.getByRole('heading',{name:'주문서',exact:true})).toBeVisible()
  if(coupon)await page.getByRole('combobox',{name:'사용할 보유 쿠폰'}).selectOption(required('ORDER_SHEET_E2E_COUPON_ID'))
  await page.getByLabel('연락처').fill('01012345678');await page.getByLabel('주문 내용을 확인했으며 결제에 동의합니다').check()
  const created=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/order-sheets')&&r.request().method()==='POST');await page.getByRole('button',{name:'결제하기',exact:true}).click();const response=await created;expect(response.status()).toBe(201);const view=await response.json();expect(view.payment.orderStatus).toBe('PENDING');expect(view.payment.processingExpiresAt).toBeNull();expect(response.request().postDataJSON().items).toEqual([{skuId:Number(required('ORDER_SHEET_E2E_SKU_ID')),quantity:2}]);await expect(page).toHaveURL(new RegExp(`/order-sheets/${view.order.orderNumber}`));return view
}
const api='/api/commercecore/v1'

test('실제 단건 SKU·쿠폰·인증 취소와 실패·새 결제창·202 재진입·사용자 취소를 확인한다',async({page},info)=>{
  const backendSha=required('ORDER_SHEET_E2E_BACKEND_SHA');const frontendSha=required('ORDER_SHEET_E2E_FRONTEND_SHA');const headers=await login(page);const numbers:string[]=[];const calls:{path:string;status:number}[]=[];const checkoutIds:string[]=[]
  page.on('response',async r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/commercecore/'))calls.push({path,status:r.status()});if(path.endsWith('/payment/checkouts')&&r.ok())checkoutIds.push((await r.json()).pgOrderId)})
  try{
    const view=await create(page,true);const number=view.order.orderNumber;numbers.push(number)
    expect(view.order.discountAmount).toBe(Number(required('ORDER_SHEET_E2E_COUPON_DISCOUNT')))
    for(const outcome of ['cancelled','failed']){
      await page.goto(`/order-sheets/${number}?authDoubleOutcome=${outcome}`);await page.getByRole('button',{name:'결제 인증하기',exact:true}).click()
      await expect(page.getByText(outcome==='cancelled'?'결제 인증을 취소했어요. 아직 승인 요청은 보내지 않았어요.':'결제 인증에 실패했어요. 승인 요청은 보내지 않았어요.')).toBeVisible()
      const current=await(await page.request.get(`${api}/order-sheets/${number}`,{headers})).json();expect(current.payment.orderStatus).toBe('PENDING');expect(current.payment.expiresAt).toBe(view.payment.expiresAt);expect(current.payment.processingExpiresAt).toBeNull();expect(calls.filter(c=>c.path.endsWith('/approval')).length).toBe(0)
    }
    await page.goto(`/order-sheets/${number}?authDoubleScenario=pending`)
    const approved=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/approval'));await page.getByRole('button',{name:'결제 인증하기',exact:true}).click();const response=await approved;expect(response.status()).toBe(202);const processing=await response.json();expect(processing.orderStatus).toBe('PROCESSING');expect(processing.processingExpiresAt).not.toBeNull();expect(processing.expiresAt).toBe(view.payment.expiresAt)
    await page.reload();await expect(page.getByText('결제가 완료되었어요',{exact:true})).toBeVisible({timeout:45000});expect(calls.filter(c=>c.path.endsWith('/approval')).length).toBe(1);expect(new Set(checkoutIds).size).toBe(3)
    const final=await(await page.request.get(`${api}/order-sheets/${number}`,{headers})).json();expect(final.payment.orderStatus).toBe('PAID');expect(final.payment.processingExpiresAt).toBe(processing.processingExpiresAt);expect(final.order.payableAmount).toBe(view.order.payableAmount)
    await page.screenshot({path:info.outputPath('direct-paid.png'),fullPage:true})
    const cancelled=await create(page);numbers.push(cancelled.order.orderNumber);const cancelResponse=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(`/order-sheets/${cancelled.order.orderNumber}/cancel`)&&r.request().method()==='POST');await page.getByRole('button',{name:'주문 취소',exact:true}).click();expect((await cancelResponse).status()).toBe(204);await expect(page.getByText('주문이 취소되었어요',{exact:true})).toBeVisible();expect((await page.request.get(`${api}/order-sheets/active`,{headers})).status()).toBe(204)
    await writeFile(info.outputPath('direct-real-evidence.json'),JSON.stringify({backendSha,frontendSha,created:view,processing,final,cancelledOrder:cancelled.order.orderNumber,calls,checkoutIds,authentication:'PG_AUTH_DOUBLE',realPg:false},null,2))
  }finally{for(const number of numbers){const v=await(await page.request.get(`${api}/order-sheets/${number}`,{headers})).json();if(v.payment.orderStatus==='PENDING')expect((await page.request.post(`${api}/order-sheets/${number}/cancel`,{headers})).status()).toBe(204)}}
})

test('실제 늦은 승인 Kafka 결과는 주문을 복원하지 않고 환불요청 대기로 표시한다',async({page},info)=>{
  const backendSha=required('ORDER_SHEET_E2E_BACKEND_SHA');const frontendSha=required('ORDER_SHEET_E2E_FRONTEND_SHA');const signalFile=required('ORDER_SHEET_E2E_LATE_SIGNAL_FILE');const headers=await login(page)
  const view=await create(page);const number=view.order.orderNumber;let authResult:Record<string,unknown>={}
  page.on('response',async r=>{if(new URL(r.url()).pathname==='/fixture/authentications'&&r.ok())authResult=await r.json()})
  await page.goto(`/order-sheets/${number}?authDoubleScenario=late`)
  const approved=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/approval'));await page.getByRole('button',{name:'결제 인증하기',exact:true}).click();const response=await approved;expect(response.status()).toBe(202);const processing=await response.json();expect(processing.orderStatus).toBe('PROCESSING')
  // Backend 소유자만 이 전용DB의 기한과 대역 승인을 제어한다. 브라우저는 제어 API를 호출하지 않는다.
  await writeFile(signalFile,JSON.stringify({orderNumber:number,paymentId:processing.paymentId,paymentKey:authResult.paymentKey,pgOrderId:processing.pgOrderId}),{mode:0o600})
  await expect(page.getByText('늦은 승인 환불을 기다리고 있어요',{exact:true})).toBeVisible({timeout:90000})
  const final=await(await page.request.get(`${api}/order-sheets/${number}`,{headers})).json();expect(['EXPIRED','CANCELLED']).toContain(final.payment.orderStatus);expect(final.payment.refundStatus).toBe('REQUESTED');await expect(page.getByRole('button',{name:'결제 인증하기',exact:true})).toHaveCount(0)
  await page.screenshot({path:info.outputPath('late-requested.png'),fullPage:true});await page.reload();await expect(page.getByText('늦은 승인 환불을 기다리고 있어요',{exact:true})).toBeVisible()
  await writeFile(info.outputPath('late-real-evidence.json'),JSON.stringify({backendSha,frontendSha,created:view,processing,final,authentication:'PG_AUTH_DOUBLE',realPg:false,realRefundCompleted:false},null,2))
})

test('실제 legacy 주문 재진입은 기존 번호와 기한을 보존하고 신규 주문을 만들지 않는다',async({page},info)=>{
  const headers=await login(page);const number=required('ORDER_SHEET_E2E_LEGACY_GROUP');let creates=0;let approvals=0
  page.on('request',r=>{const path=new URL(r.url()).pathname;if(r.method()==='POST'&&path.endsWith('/order-sheets'))creates++;if(r.method()==='POST'&&path.endsWith('/payments'))approvals++})
  const before=await(await page.request.get(`${api}/payment-groups/${number}`,{headers})).json();expect((await page.request.get(`${api}/order-sheets/active`,{headers})).status()).toBe(204)
  await page.goto(`/checkout?productId=${required('ORDER_SHEET_E2E_PRODUCT_ID')}&quantity=1`);await expect(page.getByRole('heading',{name:'주문서',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'진행 중인 결제 확인'})).toHaveAttribute('href',`/payment-groups/${number}`)
  await page.getByLabel('연락처').fill('01012345678');await page.getByLabel('주문 내용을 확인했으며 결제에 동의합니다').check();await page.getByRole('button',{name:'결제하기',exact:true}).click();await expect(page).toHaveURL(new RegExp(`/payment-groups/${number}`))
  await expect(page.getByText('결제를 진행해 주세요',{exact:true})).toBeVisible();const after=await(await page.request.get(`${api}/payment-groups/${number}`,{headers})).json();expect(after.expiresAt).toBe(before.expiresAt);expect(after.status).toBe(before.status);expect(creates).toBe(0);expect(approvals).toBe(0)
  await writeFile(info.outputPath('legacy-reentry-evidence.json'),JSON.stringify({backendSha:required('ORDER_SHEET_E2E_BACKEND_SHA'),frontendSha:required('ORDER_SHEET_E2E_FRONTEND_SHA'),number,before,after,newOrderCreates:creates,paymentExecutions:approvals},null,2))
})

test('실제 PENDING 사용자 취소의 HTTP204와 후속 상태 표시를 함께 확인한다',async({page},info)=>{
  const headers=await login(page);const events:{path:string;status:number;orderStatus?:string}[]=[]
  page.on('response',async r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/commercecore/')){const item:{path:string;status:number;orderStatus?:string}={path,status:r.status()};events.push(item);if(r.status()===200&&/\/order-sheets\/[^/]+$/.test(path)){const v=await r.json().catch(()=>null);item.orderStatus=v?.payment?.orderStatus}}})
  const view=await create(page);const number=view.order.orderNumber
  try{
    await expect(page.getByText('결제 인증을 진행해 주세요',{exact:true})).toBeVisible()
    const cancelled=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(`/order-sheets/${number}/cancel`)&&r.request().method()==='POST')
    await page.getByRole('button',{name:'주문 취소',exact:true}).click();expect((await cancelled).status()).toBe(204)
    await expect(page.getByText('주문이 취소되었어요',{exact:true})).toBeVisible()
    const final=await(await page.request.get(`${api}/order-sheets/${number}`,{headers})).json();expect(final.payment.orderStatus).toBe('CANCELLED');expect((await page.request.get(`${api}/order-sheets/active`,{headers})).status()).toBe(204)
    await writeFile(info.outputPath('cancel-real-evidence.json'),JSON.stringify({backendSha:required('ORDER_SHEET_E2E_BACKEND_SHA'),frontendSha:required('ORDER_SHEET_E2E_FRONTEND_SHA'),created:view,final,events},null,2))
  }finally{
    await writeFile(info.outputPath('cancel-http-events.json'),JSON.stringify(events,null,2))
    const v=await(await page.request.get(`${api}/order-sheets/${number}`,{headers})).json();if(v.payment.orderStatus==='PENDING')await page.request.post(`${api}/order-sheets/${number}/cancel`,{headers})
  }
})

test('실 위젯 provider 소스와 SDK인터페이스 대역의 콜백을 실제 Core 승인으로 연결한다',async({page},info)=>{
  const headers=await login(page);const backendSha=required('ORDER_SHEET_E2E_BACKEND_SHA');const frontendSha=required('ORDER_SHEET_E2E_FRONTEND_SHA');const calls:{path:string;status:number;referer:string}[]=[];let externalSdkRequests=0
  page.on('request',r=>{if(new URL(r.url()).hostname.includes('tosspayments'))externalSdkRequests++})
  page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))calls.push({path,status:r.status(),referer:r.request().headers().referer??''})})
  const member=await(await page.request.get('/api/member/v1/members/me',{headers})).json();const created=await create(page);const number=created.order.orderNumber
  try{
    await expect(page.getByText('결제 인증을 진행해 주세요',{exact:true})).toBeVisible()
    const r=await page.request.post(`${api}/order-sheets/${number}/payment/checkouts`,{headers});expect(r.status()).toBe(200);const ready=await r.json();expect(ready.orderStatus).toBe('PENDING');expect(ready.processingExpiresAt).toBeNull()
    await page.evaluate(async(input)=>{
      const {tossWidgetAuthentication}=await import('/src/features/commerce/tossWidgetAuthentication.ts')
      const log:string[]=[];const save=()=>sessionStorage.setItem('SDK_INTERFACE_DOUBLE:real-calls',JSON.stringify(log))
      const provider=tossWidgetAuthentication({memberId:()=>input.memberId,configuration:async()=>({clientKey:'test_gck_SDK_INTERFACE_DOUBLE_ONLY',customerKey:'SDK_INTERFACE_DOUBLE_CUSTOMER_ONLY'}),load:async()=>({widgets:()=>({
        setAmount:async({value,currency}:{value:number;currency:string})=>{if(value!==input.amount||currency!=='KRW')throw new Error('금액누락');log.push('setAmount');save()},
        renderPaymentMethods:async({selector}:{selector:string})=>{document.querySelector(selector)!.textContent='SDK 인터페이스 대역 — 실제 SDK/PG 인증 아님';log.push('renderPaymentMethods');save();return{destroy:async()=>undefined}},
        renderAgreement:async()=>{log.push('renderAgreement');save();return{destroy:async()=>undefined}},
        requestPayment:async(request:{orderId:string;successUrl:string;failUrl:string})=>{
          if(request.orderId!==input.pgOrderId)throw new Error('결제창ID변경');log.push('requestPayment');save()
          const r=await fetch('http://127.0.0.1:57040/fixture/authentications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderNumber:input.number,pgOrderId:request.orderId,amount:input.amount,outcome:'authenticated',scenario:'pending'})});const result=await r.json();if(result.label!=='PG_AUTH_DOUBLE'||result.outcome!=='authenticated')throw new Error('인증대역오류')
          const url=new URL(request.successUrl);url.searchParams.set('paymentKey',result.paymentKey);url.searchParams.set('orderId',result.orderId);url.searchParams.set('amount',String(result.amount));window.location.assign(url.href)
        },
      })})as never})
      void provider.authenticate({orderNumber:input.number,pgOrderId:input.pgOrderId,amount:input.amount})
    },{memberId:member.data.memberId,number,pgOrderId:ready.pgOrderId,amount:ready.amount})
    await expect(page.getByRole('dialog',{name:'결제 수단 선택'})).toBeVisible();expect(calls.filter(c=>c.path.endsWith('/approval')).length).toBe(0)
    const approved=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/approval'));await page.getByRole('button',{name:'선택한 수단으로 인증',exact:true}).click();const response=await approved;expect(response.status()).toBe(202);const processing=await response.json();expect(processing.orderStatus).toBe('PROCESSING')
    await expect(page.getByText('결제가 완료되었어요',{exact:true})).toBeVisible({timeout:45000});expect(calls.filter(c=>c.path.endsWith('/approval')).length).toBe(1);expect(externalSdkRequests).toBe(0);expect(calls.every(c=>!c.referer.includes('paymentKey'))).toBe(true)
    const final=await(await page.request.get(`${api}/order-sheets/${number}`,{headers})).json();expect(final.payment.orderStatus).toBe('PAID');expect(final.payment.processingExpiresAt).toBe(processing.processingExpiresAt);expect(page.url()).not.toContain('paymentKey')
    const sdkCalls=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('SDK_INTERFACE_DOUBLE:real-calls')??'[]'));expect(sdkCalls).toEqual(['setAmount','renderPaymentMethods','renderAgreement','requestPayment'])
    await page.screenshot({path:info.outputPath('widget-callback-paid.png'),fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:info.outputPath('widget-callback-paid-mobile.png'),fullPage:true})
    await page.reload();await expect(page.getByText('결제가 완료되었어요',{exact:true})).toBeVisible();expect(calls.filter(c=>c.path.endsWith('/approval')).length).toBe(1)
    await writeFile(info.outputPath('widget-callback-real-evidence.json'),JSON.stringify({backendSha,frontendSha,created,ready,processing,final,calls,sdkCalls,sdkBinaryExecuted:false,sdkInterfaceDouble:true,authentication:'PG_AUTH_DOUBLE',realPg:false},null,2))
  }finally{const v=await(await page.request.get(`${api}/order-sheets/${number}`,{headers})).json();if(v.payment.orderStatus==='PENDING')expect((await page.request.post(`${api}/order-sheets/${number}/cancel`,{headers})).status()).toBe(204)}
})
