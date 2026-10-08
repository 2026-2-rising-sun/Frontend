/**
 * 도메인 타입. 화면과 HTTP API 어댑터가 모두 공유하는 계약이다.
 * 이 파일은 어떤 구현(HTTP)도 import 하지 않는다.
 */

/** 상품 판매 상태 (Commerce 기준). 공개 목록에는 SELLING / SOLD_OUT 만 노출된다. */
export type ProductStatus = 'READY' | 'SELLING' | 'SOLD_OUT' | 'HIDDEN'

export interface Product {
  id: string
  name: string
  description: string
  /** 대표 이미지 URL. 없으면 화면에서 기본 이미지로 대체한다. */
  imageUrl: string | null
  /** 양의 정수, 원 단위 */
  price: number
  /** 0 이상 정수 */
  stock: number
  purchasable?: boolean
  linkId?: string
  missing?: boolean
  status: ProductStatus
  /** 이 상품을 소개한 방송 (있는 경우) */
  featuredLive?: { id: string; title: string } | null
}

export type ProductSort = 'LATEST' | 'PRICE_ASC' | 'PRICE_DESC'
export type ProductStatusFilter = 'ALL' | 'SELLING' | 'SOLD_OUT'

/** 목록 조회는 일정 개수씩(페이지 단위) 가져온다. page 는 0부터 시작. */
export interface PageParams {
  page?: number
  cursor?: string | null
  size?: number
}

export interface Paged<T> {
  items: T[]
  page: number
  size: number
  totalCount: number
  nextCursor?: string | null
  hasNext: boolean
}

export interface ProductListParams extends PageParams {
  status?: ProductStatusFilter
  sort?: ProductSort
  /** 상품명 검색어 */
  query?: string
}

/** 방송 상태. READY = 준비 중(예정), LIVE = 진행 중, ENDED = 종료 */
export type LiveStatus = 'READY' | 'LIVE' | 'ENDED'

export interface LiveSummary {
  id: string
  title: string
  thumbnailUrl: string | null
  status: LiveStatus
  /** ISO 8601 (KST 표시는 화면에서 처리) */
  scheduledAt: string
  startedAt: string | null
  endedAt: string | null
  hostName: string
}

export interface LiveDetail extends LiveSummary {
  description: string
  /** 영상 재생 URL. 준비되지 않았으면 null. */
  playbackUrl: string | null
  playbackAllowed?: boolean
  channelArn?: string
}

export type OrderStatus = 'UNPAID' | 'CONFIRMING' | 'PAID' | 'FAILED' | 'CANCELED'

export interface Order {
  orderNumber: string
  groupNumber?: string | null
  status: OrderStatus
  /** 주문 당시 값이 보존된다. 이후 상품/가격이 바뀌어도 변하지 않는다. */
  productId?: string
  productName: string
  unitPrice: number
  quantity: number
  totalPrice: number
  ordererName: string
  orderedAt: string
  /**
   * 결제 가능 기한(ISO). 미결제 주문 만료를 채택한 경우에만 내려온다. 기한이 지나면 자동 취소되고 재고가 복구된다.
   * 결제를 시작한 주문(확인 중·완료)은 기한으로 취소되지 않는다.
   */
  expiresAt: string | null
  /** 취소 사유. USER = 사용자 취소, EXPIRED = 결제 기한 만료 */
  cancelReason: 'USER' | 'EXPIRED' | null
}

export interface CreateOrderInput {
  productId: string
  quantity: number
  /** 화면에서 확인한 단가. 서버의 현재 가격과 다르면 PRICE_CHANGED 로 거절된다. */
  expectedUnitPrice: number
  ordererName: string
  ordererPhone: string
  idempotencyKey: string
  cartItemId?: string
}

/** 관리 기능은 SELLER 역할만 이용한다. */

/** 관리용 상품 상태. DRAFT = 기본정보만 등록되고 판매 설정(가격·재고)이 아직 없는 상태. */
export type AdminProductStatus = 'DRAFT' | ProductStatus
export type AdminProductStatusFilter = 'ALL' | AdminProductStatus

export interface AdminProduct {
  id: string
  name: string
  description: string
  imageUrl: string | null
  /** 대표 이미지가 등록되었는지. 이미지가 없으면 판매를 시작할 수 없다. */
  hasImage: boolean
  /** 판매 설정 전(DRAFT)에는 null */
  price: number | null
  stock: number | null
  status: AdminProductStatus
  /** 기본정보 수정 충돌 감지용. 수정할 때 화면이 본 version 을 함께 보낸다. */
  version: number
  /** 판매 설정 응답에서 확인한 ID. 기존 상품 조회 계약에는 포함되지 않는다. */
  salesId: string | null
}

export interface AdminProductListParams extends PageParams {
  status?: AdminProductStatusFilter
  query?: string
}

export interface ProductBasicInput {
  name: string
  description: string
  /** 대표 이미지 파일(선택). 화면에서 형식·용량을 확인한 뒤 전달한다. */
  image?: File | null
}

export interface SaleInfoInput {
  /** 양의 정수, 원 단위 */
  price: number
  /** 0 이상 정수 (최초 재고) */
  stock: number
}

/** START_SALE: 판매 준비 → 판매 중 / HIDE: 비공개로 전환 / RESUME: 비공개 → 판매 중(재고 없으면 품절) */
export type SaleAction = 'START_SALE' | 'HIDE' | 'RESUME'

export interface LiveInput {
  title: string
  channelArn: string
  /** 예정 시작 시각 (ISO 8601, 화면은 한국 시간으로 입력) */
  scheduledAt: string
  /** AWS IVS 시청(재생) 연결 정보. 송출용 비밀 정보(스트림 키 등)는 입력하지 않는다. */
  playbackUrl: string
}

export interface AdminLive extends LiveDetail {
  version: number
  /** 연결 상품 (노출 순서대로, 공개 상태와 무관하게 모두) */
  products: Product[]
}

export interface CartSelection { itemId: string; version: number }
export interface CartCheckoutItem extends CartSelection {
  productId: string; productName: string; quantity: number; unitPrice: number; totalAmount: number
}
export interface CartCheckout { items: CartCheckoutItem[]; totalAmount: number }
export interface PaymentGroup {
  groupNumber: string
  status: 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
  totalAmount: number; expiresAt: string | null; orders: Order[]; paymentId: string | null
}
