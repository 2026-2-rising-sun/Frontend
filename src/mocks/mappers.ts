import type { AdminLive, AdminProduct, LiveDetail, LiveSummary, Product } from '../domain/types'
import type { StoredLive, StoredProduct } from './db'
import { db } from './db'

/** 공개 목록·상세에 노출되는 상품: 판매 중 / 품절 (판매 준비·비공개·기본정보만은 제외) */
export const isPublic = (p: StoredProduct) => p.status === 'SELLING' || p.status === 'SOLD_OUT'

/** 공개 상품(판매 설정이 끝난 상품)을 API 응답 모양으로 바꾼다. */
export const toProduct = (p: StoredProduct): Product => ({
  id: p.id,
  name: p.name,
  description: p.description,
  imageUrl: p.imageUrl,
  price: p.price ?? 0,
  stock: p.stock ?? 0,
  status: p.status === 'DRAFT' ? 'READY' : p.status,
  featuredLive: p.featuredLive ?? null,
})

export const toAdminProduct = (p: StoredProduct): AdminProduct => ({
  id: p.id,
  name: p.name,
  description: p.description,
  imageUrl: p.imageUrl,
  hasImage: p.hasImage,
  price: p.price,
  stock: p.stock,
  status: p.status,
  version: p.version,
})

export const toLiveDetail = ({ version: _v, productIds: _p, ...detail }: StoredLive): LiveDetail => detail

export const toLiveSummary = ({ description: _d, playbackUrl: _u, ...summary }: LiveDetail): LiveSummary => summary

export const toAdminLive = (live: StoredLive): AdminLive => ({
  ...toLiveDetail(live),
  version: live.version,
  products: live.productIds
    .map((id) => db.products.find((p) => p.id === id))
    .filter((p): p is StoredProduct => !!p)
    .map(toProduct),
})
