import type { AdminProductsPort } from '../../domain/ports'
import type { AdminProduct, AdminProductStatus, ProductBasicInput } from '../../domain/types'
import { ApiError } from '../../domain/errors'
import type { HttpClient } from './client'

type ProductDto = {
  productId: number; name: string; description?: string; mainImageId?: number; mainImageUrl: string;
  version?: number; salesStatus: string; price: number | null; available: number | null
}
const states: Record<string, AdminProductStatus> = { NOT_REGISTERED: 'DRAFT', READY: 'READY', ON_SALE: 'SELLING', SOLD_OUT: 'SOLD_OUT', PRIVATE: 'HIDDEN' }
const mapProduct = (p: ProductDto): AdminProduct => {
  if (p.salesStatus === 'UNKNOWN') throw new ApiError('NETWORK', '판매 정보를 조회하지 못했어요. 잠시 후 다시 시도해 주세요.')
  const status = states[p.salesStatus]
  if (!status) throw new ApiError('UNKNOWN', '지원하지 않는 판매 상태예요.')
  return { id: String(p.productId), name: p.name, description: p.description ?? '', imageUrl: p.mainImageUrl,
    hasImage: !!p.mainImageUrl, version: p.version ?? 0, status, price: p.price, stock: p.available }
}

/** 로그인 검증에 사용하는 목록·상세·기본정보 등록/수정은 현재 Shopping 계약으로 연결한다. */
export function createSellerProducts(request: HttpClient): Pick<AdminProductsPort, 'list' | 'get' | 'create' | 'updateBasicInfo'> {
  const get = async (id: string) => mapProduct(await request<ProductDto>(`/shopping/admin/products/${encodeURIComponent(id)}`))
  const upload = async (image: File) => {
    const body = new FormData(); body.set('file', image)
    return (await request<{ imageId: number }>('/shopping/admin/product-images', { method: 'POST', body })).imageId
  }
  const body = async ({ name, description, image }: ProductBasicInput) => ({ name, description, ...(image ? { mainImageId: await upload(image) } : {}) })
  return {
    async list(params) {
      const value = await request<{ items: ProductDto[]; page: number; size: number; totalElements: number; totalPages: number }>('/shopping/admin/products', {
        query: { page: params?.page, size: params?.size }
      })
      return { items: value.items.map(mapProduct), page: value.page, size: value.size,
        totalCount: value.totalElements, hasNext: value.page + 1 < value.totalPages }
    },
    get,
    async create(input) {
      if (!input.image) throw new ApiError('VALIDATION', '대표 이미지를 선택해 주세요.')
      const product = await request<{ productId: number }>('/shopping/admin/products', { method: 'POST', body: await body(input) })
      return get(String(product.productId))
    },
    async updateBasicInfo(id, input) {
      await request(`/shopping/admin/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: { ...await body(input), version: input.version } })
      return get(id)
    },
  }
}
