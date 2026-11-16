import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createHttpApi } from '../src/api/http'
import { needsSheetRefresh, sheetMessage, type SheetPayment } from '../src/domain/orderSheets'
import { activeCheckout } from '../src/features/commerce/activeCheckout'
Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5379' } } })
const pending: SheetPayment = { orderNumber: 'OS-A', orderStatus: 'PENDING', paymentId: 3, paymentStatus: 'CREATED', pgOrderId: 'pg-A', amount: 6000, expiresAt: '2026-11-16T12:10:00Z', processingExpiresAt: null, refundStatus: null }
test('새 Cart 주문은 선택 ID/버전·쿠폰SKU·할인후 예상금액과 생성키를 그대로 전달하고 준비로 승인하지 않는다', async () => {
  const calls: {path: string; options?: RequestInit}[] = []
  globalThis.fetch = async (url, options) => { calls.push({path:new URL(String(url)).pathname,options}); return Response.json({ order: {orderNumber:'OS-A'}, payment: pending }) }
  const api=createHttpApi('/api')
  const input={cartItems:[{itemId:'11',version:8}],buyerName:'회원',buyerPhone:'01012345678',expectedAmount:6000,couponId:'coupon',couponSkuId:'71'}
  await api.orderSheets.create(input,'same-create-key'); await api.orderSheets.create(input,'same-create-key')
  for(const call of calls) { assert.equal(call.path,'/api/commercecore/v1/order-sheets'); assert.deepEqual(JSON.parse(String(call.options?.body)),{...input,cartItems:[{itemId:11,version:8}],couponSkuId:71}); assert.equal(new Headers(call.options?.headers).get('X-Idempotency-Key'),'same-create-key') }
  await api.orderSheets.prepare('OS-A'); await api.orderSheets.checkout('OS-A')
  assert.equal(calls.some(c=>c.path.endsWith('/approval')),false)
})
test('단건은 상품ID를 대체하지 않고 확인된SKU와 수량을 보내며202/UNKNOWN은 같은승인키로 보존한다', async()=>{
  const calls: {path:string;options?:RequestInit}[]=[]
  globalThis.fetch=async(url,options)=>{calls.push({path:new URL(String(url)).pathname,options}); return Response.json({...pending,orderStatus:'PROCESSING',paymentStatus:'UNKNOWN'},{status:202})}
  const api=createHttpApi('/api')
  await api.orderSheets.create({items:[{skuId:'71',quantity:2}],buyerName:'회원',buyerPhone:'01012345678',expectedAmount:6000},'create')
  assert.deepEqual(JSON.parse(String(calls[0].options?.body)).items,[{skuId:71,quantity:2}])
  const body={paymentKey:'authenticated-key',pgOrderId:'pg-A',amount:6000}
  for(let i=0;i<2;i++){ const p=await api.orderSheets.approve('OS-A',body,'stable-approval'); assert.equal(p.paymentStatus,'UNKNOWN') }
  assert.equal(new Headers(calls[1].options?.headers).get('X-Idempotency-Key'),new Headers(calls[2].options?.headers).get('X-Idempotency-Key'))
  assert.deepEqual(calls[1].options?.body,calls[2].options?.body)
})
test('새active가있으면legacy를대신조회하거나새주문을만들지않고번호분실을복구한다',async()=>{
  const paths:string[]=[]
  globalThis.fetch=async url=>{paths.push(new URL(String(url)).pathname);return Response.json({order:{orderNumber:'OS-lost'},payment:pending})}
  assert.equal(await activeCheckout(createHttpApi('/api')),'/order-sheets/OS-lost');assert.equal(paths.length,1)
  globalThis.fetch=async url=>new URL(String(url)).pathname.endsWith('/order-sheets/active')?new Response(null,{status:204}):Response.json({groupNumber:'PG-old',orders:[],paymentId:null})
  assert.equal(await activeCheckout(createHttpApi('/api')),'/payment-groups/PG-old')
})
test('UNKNOWN·환불요청은성공이나실패로확정하지않고실제환불결과를구분한다',()=>{
  assert.equal(needsSheetRefresh({...pending,orderStatus:'PROCESSING',paymentStatus:'UNKNOWN'}),true)
  assert.match(sheetMessage({...pending,orderStatus:'EXPIRED',refundStatus:'REQUESTED'}),/기다리고/)
  assert.doesNotMatch(sheetMessage({...pending,orderStatus:'EXPIRED',refundStatus:'REQUESTED'}),/완료/)
  assert.match(sheetMessage({...pending,orderStatus:'EXPIRED',refundStatus:'SUCCEEDED'}),/완료/)
  assert.match(sheetMessage({...pending,orderStatus:'FAILED'}),/확정/)
})

test('네트워크 시간초과는 승인 실패로 만들거나 자동 재전송하지 않고 같은 요청 식별자를 남긴다',async()=>{
  const {createHttpClient}=await import('../src/api/http/client')
  const {requestIdentity}=await import('../src/features/commerce/checkoutRecovery')
  let calls=0
  globalThis.fetch=async(_url,options)=>{calls++;return new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}))}
  const payload={paymentKey:'authenticated',pgOrderId:'pg-A',amount:6000};const before=requestIdentity('timeout-member','sheet-approval:OS-A',payload).key
  await assert.rejects(createHttpClient('/api')('/commercecore/v1/order-sheets/OS-A/payment/approval',{method:'POST',timeoutMs:1,body:payload}),/같은 주문/)
  assert.equal(calls,1);assert.equal(requestIdentity('timeout-member','sheet-approval:OS-A',payload).key,before)
})
