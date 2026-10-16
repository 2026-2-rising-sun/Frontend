import type { AdminProductsPort } from '../../domain/ports'
import type { ProductBasicInput } from '../../domain/types'
import { ApiError } from '../../domain/errors'
import type { HttpClient } from './client'
import { adminProduct, page, type ProductDto, type PageDto } from './mappers'

export function createSellerProducts(request: HttpClient): AdminProductsPort {
  const uploads = new Map<string, Promise<Awaited<ReturnType<typeof body>>>>()
  const get = async (id: string) => {
    // 판매자 본인 상품 확인 후에만 조회한 판매 ID를 사용한다.
    const dto = await request<ProductDto>(`/shopping/v1/seller/products/${encodeURIComponent(id)}`)
    if (dto.salesStatus === 'NOT_REGISTERED' || dto.salesStatus === 'UNKNOWN') return adminProduct(dto)
    try {
      const sale = await request<{ productId: number; salesId: number; unitPrice: number; salesStatus: string }>('/commerce/v1/orders/checkout', { query: { productId: id, quantity: 1 } })
      if (String(sale.productId) !== id || !Number.isSafeInteger(sale.salesId) || sale.salesId <= 0) return adminProduct({ ...dto, salesStatus: 'UNKNOWN' })
      const stock = await request<{ available: number; reserved: number }>(`/commerce/v1/sales/${sale.salesId}/stock`)
      return { ...adminProduct({ ...dto, price: sale.unitPrice, available: stock.available, salesStatus: sale.salesStatus }, String(sale.salesId)), reservedStock: stock.reserved }
    } catch {
      // 판매정보 장애에도 기본정보 편집은 유지한다.
      return adminProduct({ ...dto, salesStatus: 'UNKNOWN' })
    }
  }
  const body = async ({ name, description, image }: ProductBasicInput) => {
    let mainImageId: number | undefined
    if (image) {
      const data = new FormData(); data.set('file', image)
      mainImageId = (await request<{ imageId: number }>('/shopping/v1/seller/product-images', { method: 'POST', body: data })).imageId
    }
    return { name, description, ...(mainImageId === undefined ? {} : { mainImageId }) }
  }
  const mutateSale = async (id: string, field: string, input: unknown) => {
    const product = await get(id)
    if (!product.salesId || product.status === 'UNKNOWN') throw new ApiError('INVALID_STATE', '판매정보를 확인하지 못했어요. 다시 조회한 뒤 변경해 주세요.')
    await request(`/commerce/v1/sales/${encodeURIComponent(product.salesId)}/${field}`, { method: 'PATCH', body: input })
    return get(id)
  }
  return {
    async list(params) {
      const value = await request<PageDto<ProductDto>>('/shopping/v1/seller/products', { query: { page: params?.page, size: params?.size, status: params?.status ? { ALL: undefined, DRAFT: 'NOT_REGISTERED', READY: 'READY', SELLING: 'ON_SALE', SOLD_OUT: 'SOLD_OUT', HIDDEN: 'PRIVATE', UNKNOWN: 'UNKNOWN' }[params.status] : undefined } })
      const result = page(value, p => adminProduct(p))
      return result
    }, get,
    async create(input) {
      if (!input.image) throw new ApiError('VALIDATION', '대표 이미지를 선택해 주세요.')
      if (!uploads.has(input.idempotencyKey)) uploads.set(input.idempotencyKey, body(input).catch(error => { uploads.delete(input.idempotencyKey); throw error }))
      const payload = await uploads.get(input.idempotencyKey)!
      const result = await request<{ productId: number }>('/shopping/v1/seller/products', { method: 'POST', headers: { 'X-Idempotency-Key': input.idempotencyKey }, body: payload })
      return get(String(result.productId))
    },
    async updateBasicInfo(id, input) {
      await request(`/shopping/v1/seller/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: { ...await body(input), version: input.version } })
      return get(id)
    },
    async setSaleInfo(id, input) {
      const product = await get(id)
      if (product.status !== 'DRAFT') throw new ApiError('INVALID_STATE', '최신 판매정보를 다시 확인한 뒤 판매 설정을 변경해 주세요.')
      await request('/commerce/v1/sales', { method: 'POST', body: { productId: Number(id), price: input.price, initialStock: input.stock } })
      return get(id)
    },
    changePrice: (id, price) => mutateSale(id, 'price', { price }),
    adjustStock: (id, delta) => mutateSale(id, 'stock', { delta }),
    changeSaleStatus: (id, action) => mutateSale(id, 'status', { status: action === 'HIDE' ? 'PRIVATE' : 'ON_SALE' }),
  }
}
