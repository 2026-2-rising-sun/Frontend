import type { AuthenticatedPayment, OrderSheetsPort, SheetPayment } from '../../domain/orderSheets'
import { requestIdentity } from './checkoutRecovery'
import { saveApproval } from './sheetRecovery'
const running = new Map<string, Promise<SheetPayment>>()
/** 인증 콜백의 중복 마운트도 같은 원문·키를 사용한다. 서버 상태 확인 전 승인을 재전송하지 않는다. */
export function approveAuthenticatedPayment(api: OrderSheetsPort, member: string, number: string, payment: AuthenticatedPayment, signal?: AbortSignal) {
  const slot = `${member}:${number}:${JSON.stringify(payment)}`
  const current = running.get(slot)
  if (current) return current
  const task = (async () => {
    saveApproval(member, number, payment)
    const latest = await api.get(number)
    if (signal?.aborted || latest.payment.orderStatus !== 'PENDING') return latest.payment
    if (latest.payment.pgOrderId !== payment.pgOrderId || latest.payment.amount !== payment.amount) throw new Error('저장된 인증의 결제창이 변경되었어요. 주문 상태를 확인해 주세요.')
    return api.approve(number, payment, requestIdentity(member, `sheet-approval:${number}`, payment).key)
  })().finally(() => { running.delete(slot) })
  running.set(slot, task)
  return task
}
