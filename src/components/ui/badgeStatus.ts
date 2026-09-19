import type { LiveStatus, OrderStatus, ProductStatus } from '../../domain/types'

/** Figma "Status Badge" 의 Status 값. 방송 / 상품 / 주문 상태를 한 컴포넌트로 표시한다. */
export type BadgeStatus =
  | 'live'
  | 'scheduled'
  | 'ended'
  | 'ready'
  | 'selling'
  | 'soldOut'
  | 'hidden'
  | 'unpaid'
  | 'confirming'
  | 'paid'
  | 'failed'
  | 'canceled'

export const BADGE_LABEL: Record<BadgeStatus, string> = {
  live: 'LIVE',
  scheduled: '방송 예정',
  ended: '방송 종료',
  ready: '판매 준비',
  selling: '판매 중',
  soldOut: '품절',
  hidden: '비공개',
  unpaid: '결제 전',
  confirming: '결제 확인 중',
  paid: '결제 완료',
  failed: '결제 실패',
  canceled: '취소',
}

const LIVE: Record<LiveStatus, BadgeStatus> = { LIVE: 'live', READY: 'scheduled', ENDED: 'ended' }
const PRODUCT: Record<ProductStatus, BadgeStatus> = { READY: 'ready', SELLING: 'selling', SOLD_OUT: 'soldOut', HIDDEN: 'hidden' }
const ORDER: Record<OrderStatus, BadgeStatus> = {
  UNPAID: 'unpaid',
  CONFIRMING: 'confirming',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELED: 'canceled',
}

export const liveBadge = (status: LiveStatus) => LIVE[status]
export const productBadge = (status: ProductStatus) => PRODUCT[status]
export const orderBadge = (status: OrderStatus) => ORDER[status]
