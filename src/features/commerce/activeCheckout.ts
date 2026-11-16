import type { Api } from '../../domain/ports'
/** 새 주문서가 없다는 응답을 받은 뒤에도 기존 진행 중 결제를 별도로 확인한다. */
export async function activeCheckout(api: Api): Promise<string | null> {
  const sheet = await api.orderSheets.active()
  if (sheet) return `/order-sheets/${encodeURIComponent(sheet.order.orderNumber)}`
  const legacy = await api.paymentGroups.active()
  return legacy ? `/payment-groups/${encodeURIComponent(legacy.groupNumber)}` : null
}
