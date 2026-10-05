import type { AdminProductsPort } from '../../domain/ports'
import type { ProductBasicInput } from '../../domain/types'
import { ApiError } from '../../domain/errors'
import type { HttpClient } from './client'
import { adminProduct, page, type ProductDto, type PageDto } from './mappers'

export function createSellerProducts(request: HttpClient, memberId: () => string | undefined = () => undefined): AdminProductsPort {
  // IDs are learned only from successful sale creation, scoped to the signed-in member.
  const knownSales = () => {
    try { return JSON.parse(sessionStorage.getItem('shoppinglive:sales:' + memberId()) ?? '{}') as Record<string, string> } catch { return {} }
  }
  const uploads = new Map<string, Promise<Awaited<ReturnType<typeof body>>>>()
  const get = async (id: string) => {
    const dto = await request<ProductDto>(`/shopping/v1/admin/products/${encodeURIComponent(id)}`)
    const sale = knownSales()[id] ?? null
    if (sale) dto.available = (await request<{ available: number }>(`/commerce/v1/sales/${encodeURIComponent(sale)}/stock`)).available
    return adminProduct(dto, sale)
  }
  const saleId = (id: string) => {
    const value = knownSales()[id]
    if (!value) throw new ApiError('INVALID_STATE', '기존 상품의 판매정보 조회 API가 필요해요. 현재 브라우저에서 등록한 판매 설정만 변경할 수 있어요.')
    return encodeURIComponent(value)
  }
  const body = async ({ name, description, image }: ProductBasicInput) => {
    let mainImageId: number | undefined
    if (image) {
      const data = new FormData(); data.set('file', image)
      mainImageId = (await request<{ imageId: number }>('/shopping/v1/admin/product-images', { method: 'POST', body: data })).imageId
    }
    return { name, description, ...(mainImageId === undefined ? {} : { mainImageId }) }
  }
  const mutateSale = async (id: string, field: string, input: unknown) => {
    await request(`/commerce/v1/sales/${saleId(id)}/${field}`, { method: 'PATCH', body: input })
    return get(id)
  }
  return {
    async list(params) {
      const value = await request<PageDto<ProductDto>>('/shopping/v1/admin/products', { query: { page: params?.page, size: params?.size } })
      const result = page(value, p => adminProduct(p, knownSales()[String(p.productId)] ?? null))
      if (params?.status && params.status !== 'ALL') result.items = result.items.filter(p => p.status === params.status)
      return result
    }, get,
    async create(input) {
      if (!input.image) throw new ApiError('VALIDATION', '대표 이미지를 선택해 주세요.')
      if (!uploads.has(input.idempotencyKey)) uploads.set(input.idempotencyKey, body(input).catch(error => { uploads.delete(input.idempotencyKey); throw error }))
      const payload = await uploads.get(input.idempotencyKey)!
      const result = await request<{ productId: number }>('/shopping/v1/admin/products', { method: 'POST', headers: { 'X-Idempotency-Key': input.idempotencyKey }, body: payload })
      return get(String(result.productId))
    },
    async updateBasicInfo(id, input) {
      await request(`/shopping/v1/admin/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: { ...await body(input), version: input.version } })
      return get(id)
    },
    async setSaleInfo(id, input) {
      const result = await request<{ id: number }>('/commerce/v1/sales', { method: 'POST', body: { productId: Number(id), price: input.price, initialStock: input.stock } })
      try { sessionStorage.setItem('shoppinglive:sales:' + memberId(), JSON.stringify({ ...knownSales(), [id]: String(result.id) })) } catch { throw new ApiError('INVALID_STATE', '판매 설정은 저장됐지만 브라우저에 판매정보 ID를 보관하지 못했어요. 다시 조회해 주세요.') }
      return get(id)
    },
    changePrice: (id, price) => mutateSale(id, 'price', { price }),
    adjustStock: (id, delta) => mutateSale(id, 'stock', { delta }),
    changeSaleStatus: (id, action) => mutateSale(id, 'status', { status: action === 'HIDE' ? 'PRIVATE' : 'ON_SALE' }),
  }
}
