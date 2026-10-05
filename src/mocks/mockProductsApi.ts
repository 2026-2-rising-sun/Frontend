import { ApiError } from '../domain/errors'
import type { ProductsPort } from '../domain/ports'
import { db } from './db'
import { isPublic, toProduct } from './mappers'
import { paginate } from './paginate'
import { simulateNetwork } from './simulate'

export const mockProductsApi: ProductsPort = {
  async list(params = {}) {
    await simulateNetwork('read')
    const { status = 'ALL', sort = 'LATEST', query, page, size } = params
    let items = db.products.filter(isPublic).map(toProduct)
    if (status === 'SELLING') items = items.filter((p) => p.status === 'SELLING')
    if (status === 'SOLD_OUT') items = items.filter((p) => p.status === 'SOLD_OUT')
    if (query?.trim()) items = items.filter((p) => p.name.includes(query.trim()))
    if (sort === 'PRICE_ASC') items = [...items].sort((a, b) => a.price - b.price)
    if (sort === 'PRICE_DESC') items = [...items].sort((a, b) => b.price - a.price)
    return structuredClone(paginate(items, page, size))
  },

  async get(productId) {
    await simulateNetwork('read')
    const product = db.products.find((p) => p.id === productId)
    // 기본정보만·판매 준비·비공개 상품은 공개 상세를 제공하지 않는다.
    if (!product || !isPublic(product)) throw new ApiError('NOT_FOUND', '상품을 찾을 수 없어요.')
    return structuredClone(toProduct(product))
  },
}
