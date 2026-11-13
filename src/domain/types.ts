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
  /** 주문 가능 재고 (예약분 제외). 0 이상 정수, 수량 미제공 시 null. */
  stock: number | null
  purchasable?: boolean
  linkId?: string
  missing?: boolean
  status: ProductStatus
  /** 이 상품을 소개한 방송 (있는 경우) */
  featuredLive?: { id: string; title: string } | null
  /** 1단계 상품 분류. null 은 미분류. */
  category?: ProductCategory | null
  /** 아래는 아직 Backend 계약에 없는 표시용 정보다. 지금은 로컬 모의 서버만 보내고, 없으면 화면에서 숨긴다. */
  brand?: string | null
  /** 할인 전 가격. price(베리특가)보다 클 때만 값이 있다. */
  originalPrice?: number | null
  /** 리뷰 만족도 4단계별 인원 */
  satisfaction?: Satisfaction | null
  freeShipping?: boolean
  /** 선택 옵션 묶음(컬러, 사이즈, 구성 등). 비어 있으면 옵션 없는 상품이다. */
  options?: ProductOptionGroup[]
  /** 라이브 방송 쿠폰 할인(베리특가). 방송이 정한 기간 안에서만 붙는다. */
  liveDeal?: LiveDeal | null
  /** 지금 주문 진행 중인 수 */
  orderingCount?: number | null
  /** 지금 상품을 보고 있는 사람 수 */
  viewingCount?: number | null
}

/** 라이브 할인. discount 는 베리특가에서 빼는 금액(원), 기간은 양 끝 포함이다. */
export interface LiveDeal { broadcastId: string; broadcastTitle: string; discount: number; startsAt: string; endsAt: string }

/** 옵션 묶음 하나. 값마다 기본 가격에 더할 금액(음수 가능)과 품절 여부가 있다. */
export interface ProductOptionGroup { name: string; values: { label: string; extraPrice: number; soldOut: boolean }[] }

/** 리뷰 만족도 4단계(매우 만족해요, 만족해요, 아쉬워요, 매우 아쉬워요)별 인원 */
export interface Satisfaction { veryGood: number; good: number; bad: number; veryBad: number }

/** Catalog 공개 목록의 1단계 상품 분류 (catalog-service.yaml ProductCategory) */
export type ProductCategory = 'FASHION' | 'BEAUTY' | 'FOOD' | 'LIVING' | 'DIGITAL' | 'KIDS' | 'ETC'
/** 화면에 보여 주는 분류와 순서. 계약의 KIDS, ETC 는 고객 화면에서 쓰지 않는다. */
export const PRODUCT_CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'FOOD', label: '식품' },
  { value: 'LIVING', label: '생활' },
  { value: 'DIGITAL', label: '가전' },
  { value: 'BEAUTY', label: '뷰티' },
  { value: 'FASHION', label: '패션' },
]
/** 분류 이름. 미분류(null)나 화면에서 쓰지 않는 분류면 null. */
export const categoryLabel = (value: ProductCategory | null | undefined) => PRODUCT_CATEGORIES.find(category => category.value === value)?.label ?? null
const CONTRACT_CATEGORIES: readonly string[] = ['FASHION', 'BEAUTY', 'FOOD', 'LIVING', 'DIGITAL', 'KIDS', 'ETC']
export const isProductCategory = (value: string | null | undefined): value is ProductCategory => CONTRACT_CATEGORIES.includes(value ?? '')

/** 상품 정렬. LATEST, PRICE_ASC, PRICE_DESC 만 계약에 있고 RANKING(기본), SALES, REVIEWS 는 아직 화면 확인용이다. */
export type ProductSort = 'RANKING' | 'SALES' | 'REVIEWS' | 'LATEST' | 'PRICE_ASC' | 'PRICE_DESC'
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
  /** 생략하면 미분류를 포함한 전체 */
  category?: ProductCategory
  /** 아래는 아직 계약에 없는 필터다. 지금은 로컬 모의 서버만 적용한다. */
  freeShipping?: boolean
  /** 베리특가(price) 기준 원 단위 범위. 양 끝 포함. */
  minPrice?: number
  maxPrice?: number
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
  thumbnailId?: string | null
  videoStatus?: 'READY' | 'NOT_READY' | 'UNAVAILABLE' | null
  playbackAllowed?: boolean
  channelArn?: string
}

export type OrderStatus = 'UNPAID' | 'CONFIRMING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED'

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
  discountAmount: number
  payableAmount: number
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
  couponId?: string
}

/** 관리 기능은 SELLER 역할만 이용한다. */

/** 관리용 상품 상태. DRAFT = 기본정보만 등록되고 판매 설정(가격·재고)이 아직 없는 상태. */
export type SellerProductStatus = 'DRAFT' | 'UNKNOWN' | ProductStatus
export type SellerProductStatusFilter = 'ALL' | Exclude<SellerProductStatus, 'UNKNOWN'>

export interface SellerProduct {
  id: string
  name: string
  description: string
  imageUrl: string | null
  /** 대표 이미지가 등록되었는지. 이미지가 없으면 판매를 시작할 수 없다. */
  hasImage: boolean
  /** 판매 설정 전(DRAFT)에는 null */
  price: number | null
  stock: number | null
  /** 결제 대기 주문이 예약한 수량. 판매 가능 재고와 별도다. */
  reservedStock?: number
  status: SellerProductStatus
  /** 기본정보 수정 충돌 감지용. 수정할 때 화면이 본 version 을 함께 보낸다. */
  version: number
  /** 본인 상품 확인 후 주문서 조회 또는 판매 설정 응답으로 확인한 ID. */
  salesId: string | null
}

export interface SellerProductListParams extends PageParams {
  status?: SellerProductStatusFilter
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
  hostName?: string
  description?: string
  thumbnailId?: string
  thumbnail?: File | null
  title: string
  channelArn: string
  /** 예정 시작 시각 (ISO 8601, 화면은 한국 시간으로 입력) */
  scheduledAt: string
  /** AWS IVS 시청(재생) 연결 정보. 송출용 비밀 정보(스트림 키 등)는 입력하지 않는다. */
  playbackUrl: string
}

export interface SellerLive extends LiveDetail {
  version: number
  /** 연결 상품 (노출 순서대로, 공개 상태와 무관하게 모두) */
  products: Product[]
}

export interface CartSelection { itemId: string; version: number }
export interface CartCheckoutItem extends CartSelection {
  productId: string; productName: string; quantity: number; unitPrice: number; totalAmount: number
}
export interface CartCheckout { items: CartCheckoutItem[]; totalAmount: number; discountAmount?: number; payableAmount?: number; couponId?: string | null }
export interface PaymentGroup {
  groupNumber: string
  status: 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'
  discountAmount: number; payableAmount: number; couponId: string | null
  totalAmount: number; expiresAt: string | null; orders: Order[]; paymentId: string | null
}
