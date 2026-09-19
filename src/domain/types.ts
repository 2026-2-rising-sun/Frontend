/**
 * 도메인 타입. 화면·실제 API 어댑터·mock 어댑터가 모두 공유하는 계약이다.
 * 이 파일은 어떤 구현(http / mock)도 import 하지 않는다.
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
  status: ProductStatus
  /** 이 상품을 소개한 방송 (있는 경우) */
  featuredLive?: { id: string; title: string } | null
}

export type ProductSort = 'LATEST' | 'PRICE_ASC' | 'PRICE_DESC'
export type ProductStatusFilter = 'ALL' | 'SELLING' | 'SOLD_OUT'

/** 목록 조회는 일정 개수씩(페이지 단위) 가져온다. page 는 0부터 시작. */
export interface PageParams {
  page?: number
  size?: number
}

export interface Paged<T> {
  items: T[]
  page: number
  size: number
  totalCount: number
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
}

export type OrderStatus = 'UNPAID' | 'CONFIRMING' | 'PAID' | 'FAILED' | 'CANCELED'

export interface Order {
  orderNumber: string
  status: OrderStatus
  /** 주문 당시 값이 보존된다. 이후 상품/가격이 바뀌어도 변하지 않는다. */
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  totalPrice: number
  ordererName: string
  orderedAt: string
}

export interface CreateOrderInput {
  productId: string
  quantity: number
  /** 화면에서 확인한 단가. 서버의 현재 가격과 다르면 PRICE_CHANGED 로 거절된다. */
  expectedUnitPrice: number
  ordererName: string
  ordererPhone: string
  /** 주문 조회·결제·취소에 쓰는 비밀번호 (계정 아님) */
  lookupPassword: string
}
