import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { beginWidgetReturn, captureWidgetReturn, readWidgetReturn } from '../src/features/commerce/widgetReturn'
import { approveAuthenticatedPayment } from '../src/features/commerce/sheetApproval'
import type { OrderSheetsPort, SheetPayment } from '../src/domain/orderSheets'
const values=new Map<string,string>()
Object.assign(globalThis,{sessionStorage:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}})
function returnTo(href:string){const history={state:null,replaceState(_s:unknown,_t:string,path:string){Object.assign(globalThis.window.location,{href:new URL(path,'http://localhost').href})}};Object.assign(globalThis,{window:{location:{href},history}});captureWidgetReturn()}
const intent={memberId:'widget-member',orderNumber:'OS-widget',pgOrderId:'pg-current',amount:4000}
test('실 위젯 리다이렉트의 nonce·창·금액을대조하고 인증키를주소에서먼저제거한다',()=>{
  const url=beginWidgetReturn(intent,'http://localhost');returnTo(url.successUrl+'&paymentKey=authenticated-only&orderId=pg-current&amount=4000')
  assert.equal(window.location.href,'http://localhost/order-sheets/OS-widget/payment-return');assert.deepEqual(readWidgetReturn('widget-member','OS-widget'),{outcome:'success',payment:{paymentKey:'authenticated-only',pgOrderId:'pg-current',amount:4000}})
  assert.equal(readWidgetReturn('other-member','OS-widget'),null)
})
test('실패콜백은orderId가없어도저장한주문으로복원하고금액조작·중복값은승인하지않는다',()=>{
  let url=beginWidgetReturn(intent,'http://localhost');returnTo(url.failUrl+'&code=PAY_PROCESS_CANCELED');assert.match(readWidgetReturn('widget-member','OS-widget')?.outcome==='failure'?(readWidgetReturn('widget-member','OS-widget')as{message:string}).message:'',/취소/)
  url=beginWidgetReturn(intent,'http://localhost');returnTo(url.successUrl+'&paymentKey=x&orderId=pg-current&amount=3999');assert.equal(readWidgetReturn('widget-member','OS-widget')?.outcome,'failure')
  url=beginWidgetReturn(intent,'http://localhost');returnTo(url.successUrl+'&paymentKey=x&orderId=pg-current&amount=4000&amount=3999');assert.equal(readWidgetReturn('widget-member','OS-widget')?.outcome,'failure')
})
const pending:SheetPayment={orderNumber:'OS-widget',orderStatus:'PENDING',pgOrderId:'pg-current',amount:4000,paymentId:1,paymentStatus:'CREATED',expiresAt:'2026-11-16T14:10:00Z',processingExpiresAt:null,refundStatus:null}
test('중복콜백은같은승인한번만접수하고기한종료·이전결제창은조회후재승인하지않는다',async()=>{
  let posts=0;const api={get:async()=>({order:{},payment:pending}),approve:async()=>{posts++;return {...pending,orderStatus:'PROCESSING'}}}as unknown as OrderSheetsPort
  const input={paymentKey:'authenticated-only',pgOrderId:'pg-current',amount:4000}
  await Promise.all([approveAuthenticatedPayment(api,'widget-member','OS-widget',input),approveAuthenticatedPayment(api,'widget-member','OS-widget',input)]);assert.equal(posts,1)
  api.get=async()=>({order:{},payment:{...pending,orderStatus:'EXPIRED'}})as never;await approveAuthenticatedPayment(api,'widget-member','OS-widget',input);assert.equal(posts,1)
  api.get=async()=>({order:{},payment:{...pending,pgOrderId:'pg-new'}})as never;await assert.rejects(approveAuthenticatedPayment(api,'widget-member','OS-widget',input),/변경/);assert.equal(posts,1)
})
