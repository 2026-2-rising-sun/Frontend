import type { AdminProductStatus, LiveDetail, Order, Product } from '../domain/types'
import { seedLiveProductIds, seedProducts } from './data/products'
import { seedLives } from './data/lives'

/** 인메모리 mock DB. 새로고침 후에도 주문·재고·관리 변경이 남도록 sessionStorage 에 저장한다. */

/** mock 이 저장하는 상품. 판매 설정 전(DRAFT)에는 price/stock 이 null 이다. */
export interface StoredProduct {
  id: string
  name: string
  description: string
  imageUrl: string | null
  hasImage: boolean
  price: number | null
  stock: number | null
  status: AdminProductStatus
  version: number
  featuredLive?: { id: string; title: string } | null
}

export interface StoredLive extends LiveDetail {
  version: number
  /** 연결 상품 id (노출 순서대로) */
  productIds: string[]
}

export interface StoredOrder extends Order {
  ordererPhone: string
  lookupPassword: string
  /** 지연 시나리오: 이 시각 이후 조회하면 finalStatus 로 확정된다. */
  resolveAt?: number
  finalStatus?: 'PAID' | 'FAILED'
  /** 재고 복구를 한 번만 하기 위한 표시 */
  stockRestored?: boolean
}

interface DbState {
  products: StoredProduct[]
  lives: StoredLive[]
  orders: Record<string, StoredOrder>
  sequence: number
  productSequence: number
  liveSequence: number
}

const STORAGE_KEY = 'shoppinglive:mock-db:v2'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const toStored = (p: Product): StoredProduct => ({
  ...clone(p),
  // 시드 중 "이미지 없는 판매 준비 상품"(p-9)은 이미지 등록 → 판매 시작 흐름을 시연하기 위한 것
  hasImage: p.id !== 'p-9',
  version: 1,
})

const draftSeed: StoredProduct = {
  id: 'p-27',
  name: '기본정보만 등록된 상품',
  description: '판매 설정(가격·재고) 전 상품은 공개 목록과 주문 대상에서 제외됩니다.',
  imageUrl: null,
  hasImage: false,
  price: null,
  stock: null,
  status: 'DRAFT',
  version: 1,
  featuredLive: null,
}

const initialState = (): DbState => ({
  // 최신 등록 순: 방금 기본정보만 등록된 상품이 가장 위에 온다.
  products: [clone(draftSeed), ...seedProducts.map(toStored)],
  lives: seedLives.map((l) => ({ ...clone(l), version: 1, productIds: [...(seedLiveProductIds[l.id] ?? [])] })),
  orders: {},
  sequence: 0,
  productSequence: 100,
  liveSequence: 100,
})

const load = (): DbState => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DbState
  } catch {
    /* 저장소를 못 읽어도 시드로 시작한다 */
  }
  return initialState()
}

let state: DbState = load()

export const persist = () => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* 저장 실패는 무시 (메모리 상태로 계속 동작) */
  }
}

export const db = {
  get products() {
    return state.products
  },
  get lives() {
    return state.lives
  },
  get orders() {
    return state.orders
  },
  nextOrderNumber() {
    state.sequence += 1
    const d = new Date()
    const yymmdd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    return `LC-${yymmdd}-${String(state.sequence).padStart(4, '0')}`
  },
  nextProductId() {
    state.productSequence += 1
    return `p-${state.productSequence}`
  },
  nextLiveId() {
    state.liveSequence += 1
    return `l-${state.liveSequence}`
  },
}

/** 데이터를 시드 상태로 되돌린다 (Mock 패널의 "초기화"). */
export const resetDb = () => {
  state = initialState()
  persist()
}
