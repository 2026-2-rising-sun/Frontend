import type { Refund, RefundsPort, RefundTarget, RefundSummary, RefundableTarget } from '../../domain/refunds'
import { ApiError } from '../../domain/errors'
import { refundPending } from '../../domain/refunds'
import type { HttpClient } from './client'

type TargetDto = Omit<RefundTarget, 'cartItemId' | 'orderId' | 'productId'> & {
  cartItemId: number | null; orderId: number; productId: number
}
export type RefundSummaryDto = Omit<RefundSummary, 'id' | 'targets'> & { id: number; targets: TargetDto[] }
export type RefundDto = RefundSummaryDto & { paymentGroupNumber: string }
const mapRefundSummary = (dto: RefundSummaryDto): RefundSummary => ({
  ...dto, id: String(dto.id), targets: dto.targets.map((target) => ({
    ...target, cartItemId: target.cartItemId === null ? null : String(target.cartItemId),
    orderId: String(target.orderId), productId: String(target.productId),
  })),
})
const mapRefund = (dto: RefundDto): Refund => ({ ...mapRefundSummary(dto), paymentGroupNumber: dto.paymentGroupNumber })

export function createRefunds(request: HttpClient): RefundsPort {
  const path = (number: string) => `/commerce/v1/payment-groups/${encodeURIComponent(number)}/refunds`
  const list = async (number: string) => (await request<RefundDto[]>(path(number))).map(mapRefund)
  return {
    list,
    targets: async (number) => (await request<(Omit<RefundableTarget, 'orderId' | 'cartItemId'> & { orderId: number; cartItemId: number | null })[]>(`/commerce/v1/payment-groups/${encodeURIComponent(number)}/refundable-targets`)).map(target => ({ ...target, orderId: String(target.orderId), cartItemId: target.cartItemId === null ? null : String(target.cartItemId) })),
    async requestSelected(number, cartItemIds, key) {
      if (!cartItemIds.length || cartItemIds.length > 100 || new Set(cartItemIds).size !== cartItemIds.length || cartItemIds.some(id => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))) throw new ApiError('VALIDATION', '환불할 상품을 선택해 주세요.')
      return mapRefund(await request<RefundDto>(path(number), { method: 'POST', headers: { 'Idempotency-Key': key }, body: { cartItemIds: cartItemIds.map(Number) } }))
    },
    get: async (number, id) => mapRefund(await request<RefundDto>(`${path(number)}/${encodeURIComponent(id)}`)),
    async requestFull(number, key) {
      const before = await list(number)
      const pending = before.find(refundPending)
      if (pending) return pending
      if (before.some(refund => refund.status === 'SUCCESS')) throw new ApiError('INVALID_STATE', '일부 상품의 환불 이력이 있어 전체 환불을 요청할 수 없어요.')
      try {
        return mapRefund(await request<RefundDto>(path(number), {
          method: 'POST', headers: { 'Idempotency-Key': key },
        }))
      } catch (error) {
        // 접수 응답이 유실돼도 새 환불을 만들지 않고 서버에 남은 요청을 먼저 확인한다.
        const recovered = await list(number).catch(() => null)
        const created = recovered?.find((refund) => !before.some((old) => old.id === refund.id))
        if (created) return created
        throw error
      }
    },
    listSeller: async (params) => (await request<RefundSummaryDto[]>('/commerce/v1/seller/refunds', {
      query: { page: params?.page ?? 0, size: params?.size ?? 20 },
    })).map(mapRefundSummary),
    getSeller: async (id) => mapRefundSummary(await request<RefundSummaryDto>(`/commerce/v1/seller/refunds/${encodeURIComponent(id)}`)),
  }
}
