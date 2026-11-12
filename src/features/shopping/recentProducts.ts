import type { Api } from '../../domain/ports'
import type { Product } from '../../domain/types'

const KEY = 'berryon:recent-products'
const MAX_STORED = 20
const MAX_RECENT_SHOWN = 8
const MAX_RELATED = 12
const MAX_CATEGORIES = 3

/** 브라우저에 저장한 최근 본 상품 번호. 최근 것이 앞이다. 저장소를 못 쓰면 빈 목록이다. */
export function readRecentIds(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): string[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** 상품 상세를 열 때 호출한다. 같은 상품은 맨 앞으로 옮기고 최대 20개만 남긴다. */
export function recordRecentProduct(id: string, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.localStorage) {
  try {
    const ids = [id, ...readRecentIds(storage).filter(saved => saved !== id)].slice(0, MAX_STORED)
    storage?.setItem(KEY, JSON.stringify(ids))
  } catch {
    // 개인정보 보호 모드 등에서 저장이 막혀도 상품 화면은 그대로 보여 준다.
  }
}

const visible = (product: Product) => !product.missing && (product.status === 'SELLING' || product.status === 'SOLD_OUT')

export interface RecentAndRelated {
  recent: Product[]
  related: Product[]
}

/**
 * 최근 본 상품을 다시 조회하고, 그 상품들의 카테고리에서 연관 추천 상품을 고른다.
 * 최근 본 상품이 없거나 카테고리가 없으면 판매 중인 최신 상품으로 채운다.
 */
export async function loadRecentAndRelated(api: Api, ids = readRecentIds()): Promise<RecentAndRelated> {
  const fetched = await Promise.allSettled(ids.slice(0, MAX_RECENT_SHOWN).map(id => api.products.get(id)))
  const recent = fetched.flatMap(result => result.status === 'fulfilled' && visible(result.value) ? [result.value] : [])
  const seen = new Set(recent.map(product => product.id))
  const categories = [...new Set(recent.flatMap(product => product.category ? [product.category] : []))].slice(0, MAX_CATEGORIES)
  const pages = await Promise.allSettled(categories.length
    ? categories.map(category => api.products.list({ status: 'SELLING', category, size: MAX_RELATED }))
    : [api.products.list({ status: 'SELLING', sort: 'LATEST', size: MAX_RELATED })])
  const related: Product[] = []
  for (const page of pages) {
    if (page.status !== 'fulfilled') continue
    for (const product of page.value.items) {
      if (seen.has(product.id) || !visible(product)) continue
      seen.add(product.id); related.push(product)
    }
  }
  if (!related.length && pages.every(page => page.status === 'rejected') && !recent.length) throw (pages[0] as PromiseRejectedResult).reason
  return { recent, related: related.slice(0, MAX_RELATED) }
}
