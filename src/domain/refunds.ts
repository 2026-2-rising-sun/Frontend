export type RefundStatus = 'PROCESSING' | 'UNKNOWN' | 'SUCCESS' | 'FAILED'
export interface RefundTarget {
  cartItemId: string | null
  orderId: string
  productId: string
  productName: string
  quantity: number
  refundAmount: number
}
export interface RefundSummary {
  id: string
  refundAmount: number
  cumulativeRefundAmount: number
  status: RefundStatus
  requestedAt: string
  resolvedAt: string | null
  targets: RefundTarget[]
  recovery: { retryCount: number; retryExhausted: boolean; nextActionAt: string } | null
}
export interface Refund extends RefundSummary { paymentGroupNumber: string }
export interface RefundsPort {
  list(groupNumber: string): Promise<Refund[]>
  get(groupNumber: string, id: string): Promise<Refund>
  requestFull(groupNumber: string, idempotencyKey: string): Promise<Refund>
}
export const refundPending = (refund: RefundSummary) => refund.status === 'PROCESSING' || refund.status === 'UNKNOWN'
export const remainingRefundAmount = (paid: number, refunds: Refund[]) =>
  Math.max(0, paid - Math.max(0, ...refunds.map((refund) => refund.cumulativeRefundAmount)))
export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  PROCESSING: '환불 처리 중', UNKNOWN: '환불 결과 확인 중', SUCCESS: '환불 완료', FAILED: '환불 실패',
}
