import type {
  CreateOrderInput,
  LiveDetail,
  LiveStatus,
  LiveSummary,
  Order,
  Product,
  ProductListParams,
} from './types'

/**
 * 프론트가 백엔드에 요구하는 API 계약(포트).
 * - 실제 구현: src/api/http
 * - mock 구현: src/mocks
 * 화면(features/*)은 이 인터페이스에만 의존한다.
 */

/** Shopping — 상품 (가격·재고·판매 상태는 Commerce 정보가 합쳐져 내려온다) */
export interface ProductsPort {
  list(params?: ProductListParams): Promise<Product[]>
  get(productId: string): Promise<Product>
}

/** Live — 방송. 영상과 방송 상품 조회는 서로 실패가 전파되지 않도록 분리한다. */
export interface LivesPort {
  list(status?: LiveStatus): Promise<LiveSummary[]>
  get(liveId: string): Promise<LiveDetail>
  /** 방송에 연결된 상품 (노출 순서대로) */
  listProducts(liveId: string): Promise<Product[]>
}

/** Commerce — 주문. 로그인 없이 주문번호 + 조회 비밀번호로 접근한다. */
export interface OrdersPort {
  create(input: CreateOrderInput): Promise<Order>
  lookup(orderNumber: string, lookupPassword: string): Promise<Order>
  /** 결제 시작 전(UNPAID) 주문만 취소 가능 */
  cancel(orderNumber: string, lookupPassword: string): Promise<Order>
}

/** Commerce — 내부 Mock 결제. 결과가 미확정이면 CONFIRMING 상태로 돌아온다. */
export interface PaymentsPort {
  start(orderNumber: string, lookupPassword: string): Promise<Order>
}

export interface Api {
  products: ProductsPort
  lives: LivesPort
  orders: OrdersPort
  payments: PaymentsPort
}
