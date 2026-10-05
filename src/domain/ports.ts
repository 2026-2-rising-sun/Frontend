import type { AuthPort } from './auth'
import type {
  AdminLive,
  AdminProduct,
  AdminProductListParams,
  CreateOrderInput,
  LiveInput,
  LiveDetail,
  LiveStatus,
  LiveSummary,
  Order,
  PageParams,
  Paged,
  Product,
  ProductBasicInput,
  ProductListParams,
  SaleAction,
  SaleInfoInput,
} from './types'

/**
 * 프론트가 백엔드에 요구하는 API 계약(포트).
 * - 실제 구현: src/api/http
 * - mock 구현: src/mocks
 * 화면(features/*)은 이 인터페이스에만 의존한다.
 */

/** Shopping — 상품 (가격·재고·판매 상태는 Commerce 정보가 합쳐져 내려온다) */
export interface ProductsPort {
  list(params?: ProductListParams): Promise<Paged<Product>>
  get(productId: string): Promise<Product>
}

/** Live — 방송. 영상과 방송 상품 조회는 서로 실패가 전파되지 않도록 분리한다. */
export interface LivesPort {
  list(params?: PageParams & { status?: LiveStatus }): Promise<Paged<LiveSummary>>
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

/** Shopping + Commerce — 관리용 상품. 기본정보(Shopping)와 판매정보(Commerce)를 한 흐름으로 다룬다. */
export interface AdminProductsPort {
  list(params?: AdminProductListParams): Promise<Paged<AdminProduct>>
  get(productId: string): Promise<AdminProduct>
  /** 기본정보만 있는 상품(DRAFT)을 만든다. 판매 설정 전에는 공개·주문 대상이 아니다. */
  create(input: ProductBasicInput): Promise<AdminProduct>
  /** 이름·설명·대표 이미지 수정. version 이 다르면 CONFLICT (조용히 덮어쓰지 않는다). */
  updateBasicInfo(productId: string, input: ProductBasicInput & { version: number }): Promise<AdminProduct>
  /** 최초 판매 설정 (가격·재고). DRAFT → 판매 준비. 이미 설정된 상품은 INVALID_STATE. */
  setSaleInfo(productId: string, input: SaleInfoInput): Promise<AdminProduct>
  /** 새로 생기는 주문부터 적용된다. 기존 주문 금액은 바뀌지 않는다. */
  changePrice(productId: string, price: number): Promise<AdminProduct>
  /** 재고 수정. 화면이 본 재고(expectedStock)와 다르면 CONFLICT — 그 사이 주문 차감이 사라지지 않게 한다. */
  setStock(productId: string, input: { stock: number; expectedStock: number }): Promise<AdminProduct>
  changeSaleStatus(productId: string, action: SaleAction): Promise<AdminProduct>
}

/** Live — 관리용 방송. 상태별로 가능한 동작이 다르다. (준비 중: 전체 편집 / 진행 중: 순서만 / 종료: 조회만) */
export interface AdminLivesPort {
  list(params?: PageParams & { status?: LiveStatus }): Promise<Paged<LiveSummary>>
  get(liveId: string): Promise<AdminLive>
  create(input: LiveInput): Promise<AdminLive>
  /** 준비 중 방송만 수정. version 이 다르면 CONFLICT. */
  update(liveId: string, input: LiveInput & { version: number }): Promise<AdminLive>
  /** 준비 중 방송에 공개 상품(판매 중·품절)을 연결. 같은 방송에 중복 연결 불가. */
  linkProduct(liveId: string, productId: string): Promise<AdminLive>
  unlinkProduct(liveId: string, productId: string): Promise<AdminLive>
  /** 노출 순서 변경. 준비 중·진행 중만 가능하며 이미 연결된 상품 전체를 정확히 한 번씩 포함해야 한다. */
  reorderProducts(liveId: string, productIds: string[]): Promise<AdminLive>
  /** 영상 연결 정보와 판매 가능한 연결 상품이 있을 때만 시작할 수 있다. */
  start(liveId: string): Promise<AdminLive>
  end(liveId: string): Promise<AdminLive>
}

export interface Api {
  auth: AuthPort
  products: ProductsPort
  lives: LivesPort
  orders: OrdersPort
  payments: PaymentsPort
  admin: { products: AdminProductsPort; lives: AdminLivesPort }
}
