import { ApiError } from '../domain/errors'
import type { OrdersPort, PaymentsPort } from '../domain/ports'
import type { Order } from '../domain/types'
import { getMockSettings } from './control'
import { db, persist, type StoredOrder } from './db'
import { isPublic } from './mappers'
import { simulateNetwork } from './simulate'

const toPublic = ({
  ordererPhone: _phone,
  lookupPassword: _pw,
  resolveAt: _r,
  finalStatus: _f,
  stockRestored: _s,
  ...order
}: StoredOrder): Order => order

/** 확보했던 재고를 한 번만 되돌린다. (실패·취소) */
const restoreStock = (order: StoredOrder) => {
  if (order.stockRestored) return
  const product = db.products.find((p) => p.id === order.productId)
  if (product) {
    product.stock = (product.stock ?? 0) + order.quantity
    if (product.status === 'SOLD_OUT' && product.stock > 0) product.status = 'SELLING'
  }
  order.stockRestored = true
}

/** 지연 시나리오의 확정 시각이 지났으면 결과를 반영하고, 미결제 주문은 결제 기한이 지났으면 만료 취소한다. (새로고침해도 이어지도록 조회 시점에 처리) */
const settle = (order: StoredOrder) => {
  // 결제를 시작하지 않은(UNPAID) 주문만 기한으로 취소한다. 확인 중·완료 주문은 시간 초과로 취소하지 않는다.
  if (order.status === 'UNPAID' && order.expiresAt && Date.now() >= +new Date(order.expiresAt)) {
    order.status = 'CANCELED'
    order.cancelReason = 'EXPIRED'
    restoreStock(order)
    persist()
  }
  if (order.status === 'CONFIRMING' && order.resolveAt && order.finalStatus && Date.now() >= order.resolveAt) {
    order.status = order.finalStatus
    if (order.finalStatus === 'FAILED') restoreStock(order)
    persist()
  }
  return order
}

/** 주문번호 + 조회 비밀번호 확인. 존재 여부가 드러나지 않도록 둘 다 UNAUTHORIZED 로 응답한다. */
const authorize = (orderNumber: string, lookupPassword: string) => {
  const order = db.orders[orderNumber]
  if (!order || order.lookupPassword !== lookupPassword) {
    throw new ApiError('UNAUTHORIZED', '주문번호 또는 조회 비밀번호가 일치하지 않아요.')
  }
  return settle(order)
}

export const mockOrdersApi: OrdersPort = {
  async create(input) {
    await simulateNetwork('write')
    if (!input.ordererName.trim() || !input.ordererPhone.trim() || input.lookupPassword.length < 4) {
      throw new ApiError('VALIDATION', '주문자 정보를 확인해 주세요.')
    }
    if (!Number.isInteger(input.quantity) || input.quantity < 1) {
      throw new ApiError('VALIDATION', '수량은 1 이상의 정수여야 해요.')
    }

    const product = db.products.find((p) => p.id === input.productId)
    // 기본정보만·판매 준비·비공개 상품은 주문할 수 없다.
    if (!product || !isPublic(product)) throw new ApiError('NOT_FOUND', '상품을 찾을 수 없어요.')
    if (product.status === 'SOLD_OUT') throw new ApiError('OUT_OF_STOCK', '품절된 상품이에요.')
    const unitPrice = product.price ?? 0
    const available = product.stock ?? 0
    // 화면에서 본 가격과 현재 가격이 다르면 새 금액을 확인받도록 거절한다.
    if (unitPrice !== input.expectedUnitPrice) {
      throw new ApiError('PRICE_CHANGED', '가격이 변경되었어요.', { currentUnitPrice: unitPrice })
    }
    if (available < input.quantity) {
      throw new ApiError('OUT_OF_STOCK', '재고가 부족해요.', { stock: available })
    }

    product.stock = available - input.quantity
    if (product.stock === 0) product.status = 'SOLD_OUT'

    const order: StoredOrder = {
      orderNumber: db.nextOrderNumber(),
      status: 'UNPAID',
      productId: product.id,
      productName: product.name, // 주문 당시 상품명 보존
      unitPrice,
      quantity: input.quantity,
      totalPrice: unitPrice * input.quantity,
      ordererName: input.ordererName.trim(),
      ordererPhone: input.ordererPhone.trim(),
      lookupPassword: input.lookupPassword,
      orderedAt: new Date().toISOString(),
      expiresAt: getMockSettings().orderExpiryMs > 0 ? new Date(Date.now() + getMockSettings().orderExpiryMs).toISOString() : null,
      cancelReason: null,
    }
    db.orders[order.orderNumber] = order
    persist()
    return toPublic(order)
  },

  async lookup(orderNumber, lookupPassword) {
    await simulateNetwork('write')
    return toPublic(authorize(orderNumber, lookupPassword))
  },

  async cancel(orderNumber, lookupPassword) {
    await simulateNetwork('write')
    const order = authorize(orderNumber, lookupPassword)
    if (order.status !== 'UNPAID') {
      throw new ApiError('INVALID_STATE', '결제 전 주문만 취소할 수 있어요.')
    }
    order.status = 'CANCELED'
    order.cancelReason = 'USER'
    restoreStock(order)
    persist()
    return toPublic(order)
  },
}

export const mockPaymentsApi: PaymentsPort = {
  async start(orderNumber, lookupPassword) {
    await simulateNetwork('write')
    const order = authorize(orderNumber, lookupPassword)
    // 이미 확인 중이면 새 결제를 만들지 않고 기존 결과 확인으로 이어진다.
    if (order.status === 'CONFIRMING') return toPublic(order)
    if (order.status !== 'UNPAID') throw new ApiError('INVALID_STATE', '결제할 수 없는 주문이에요.')

    // 시나리오는 결제를 시작하는 시점에 고정된다 (이후 설정을 바꿔도 이 주문은 그대로).
    const { paymentScenario, confirmDelayMs } = getMockSettings()
    if (paymentScenario === 'SUCCESS') {
      order.status = 'PAID'
    } else if (paymentScenario === 'FAIL') {
      order.status = 'FAILED'
      restoreStock(order)
    } else {
      order.status = 'CONFIRMING'
      order.finalStatus = paymentScenario === 'DELAYED_SUCCESS' ? 'PAID' : 'FAILED'
      order.resolveAt = Date.now() + confirmDelayMs
    }
    persist()
    return toPublic(order)
  },
}
