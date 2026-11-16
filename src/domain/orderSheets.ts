import type { CartSelection } from './types'

export type SheetStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
export interface SheetPayment {
  orderNumber: string; orderStatus: SheetStatus; paymentId: number | null; paymentStatus: string
  pgOrderId: string | null; amount: number; expiresAt: string; processingExpiresAt: string | null
  refundStatus: 'REQUESTED' | 'SUCCEEDED' | 'FAILED' | null
}
export interface SheetItem {
  orderItemId: number; skuId: number; productId: number; productName: string; sellerId: string
  mainImageUrl: string | null; selectedOptions: string | null; quantity: number; unitPrice: number
  totalAmount: number; discountAmount: number; payableAmount: number
  sourceCartItemId: number | null; sourceCartVersion: number | null
}
export interface OrderSheet {
  orderNumber: string; status: SheetStatus; failureReason: string | null; totalAmount: number
  discountAmount: number; payableAmount: number; expiresAt: string; processingExpiresAt: string | null
  paymentId: number | null; couponId: string | null; couponOrderItemId: number | null; items: SheetItem[]
}
export interface SheetView { order: OrderSheet; payment: SheetPayment }
export type SheetInput = ({ items: { skuId: string; quantity: number }[]; cartItems?: never } | { cartItems: CartSelection[]; items?: never }) & {
  buyerName: string; buyerPhone: string; expectedAmount: number; couponId?: string; couponSkuId?: string
}
export interface AuthenticatedPayment { paymentKey: string; pgOrderId: string; amount: number }
export interface OrderSheetsPort {
  create(input: SheetInput, key: string): Promise<SheetView>
  active(): Promise<SheetView | null>
  get(number: string): Promise<SheetView>
  prepare(number: string): Promise<SheetPayment>
  checkout(number: string): Promise<SheetPayment>
  approve(number: string, input: AuthenticatedPayment, key: string): Promise<SheetPayment>
  cancel(number: string): Promise<void>
}
/** 실제 SDK 구현은 팀원 인증 계약을 받은 뒤 연결한다. 준비 응답을 인증 결과로 만들지 않는다. */
export interface PaymentAuthentication {
  label?: string
  authenticate(input: { orderNumber: string; pgOrderId: string; amount: number }): Promise<AuthenticatedPayment | null>
}
export function sheetMessage(payment: SheetPayment): string {
  if (payment.refundStatus === 'REQUESTED') return '늦은 승인 환불을 기다리고 있어요'
  if (payment.refundStatus === 'FAILED') return '늦은 승인 환불 결과를 확인해 주세요'
  if (payment.refundStatus === 'SUCCEEDED') return '늦은 승인 환불이 완료되었어요'
  return { PENDING: '결제 인증을 진행해 주세요', PROCESSING: '결제 결과를 확인하고 있어요', PAID: '결제가 완료되었어요', FAILED: '결제 실패가 확정되었어요', EXPIRED: '주문 기한이 지났어요', CANCELLED: '주문이 취소되었어요', REFUNDED: '환불이 완료되었어요', PARTIALLY_REFUNDED: '일부 금액이 환불되었어요' }[payment.orderStatus]
}
export function needsSheetRefresh(p: SheetPayment) {
  if (p.refundStatus === 'SUCCEEDED' || p.refundStatus === 'FAILED') return false
  return p.orderStatus === 'PROCESSING' || p.refundStatus === 'REQUESTED' || ['UNKNOWN', 'APPROVING', 'PENDING'].includes(p.paymentStatus) || (p.orderStatus === 'PENDING' && p.paymentStatus === 'PREPARING')
}
