import type { Order, Product } from '../domain/types'
import { seedLiveProductIds, seedProducts } from './data/products'
import { seedLives } from './data/lives'

/** 인메모리 mock DB. 새로고침 후에도 주문·재고가 남도록 sessionStorage 에 저장한다. */

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
  products: Product[]
  orders: Record<string, StoredOrder>
  sequence: number
}

const STORAGE_KEY = 'shoppinglive:mock-db:v1'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const initialState = (): DbState => ({ products: clone(seedProducts), orders: {}, sequence: 0 })

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
  get orders() {
    return state.orders
  },
  lives: seedLives,
  liveProductIds: seedLiveProductIds,
  nextOrderNumber() {
    state.sequence += 1
    const d = new Date()
    const yymmdd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    return `LC-${yymmdd}-${String(state.sequence).padStart(4, '0')}`
  },
}

/** 데이터를 시드 상태로 되돌린다 (Mock 패널의 "초기화"). */
export const resetDb = () => {
  state = initialState()
  persist()
}
