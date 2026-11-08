import { expect, type APIRequestContext } from '@playwright/test'

// 원본 등록/판매 API의 성공과 Catalog 사본 반영은 별도 단계다.
export async function waitForCatalogProduct(request: APIRequestContext, productId: string | number, salesStatus = 'ON_SALE') {
  await expect.poll(async () => {
    const response = await request.get(`/api/catalog/v1/products/${productId}`)
    if (!response.ok()) return false
    const product = (await response.json()).data
    return String(product.productId) === String(productId) && product.salesStatus === salesStatus
  }, { timeout: 30000, message: '상품·판매 사본의 Catalog 공개 반영' }).toBe(true)
}
