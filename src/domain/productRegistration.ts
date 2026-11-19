import { ApiError } from './errors'
import { PRODUCT_DESCRIPTION_MAX, PRODUCT_NAME_MAX, validateImageFile } from './constraints'

export const INITIAL_SKU_MAX = 100
export const INITIAL_STOCK_MAX = 2147483647
export const OPTION_LABEL_MAX = 255

export interface InitialSkuInput {
  optionLabel: string | null
  price: number
  initialStock: number
}
export interface ProductRegistrationPayload {
  name: string
  description: string
  skus: InitialSkuInput[]
}
export interface ProductCreateInput extends ProductRegistrationPayload {
  image: File
  idempotencyKey: string
}
export interface ProductCreateResult {
  productId: string
  mainImageId: string
  mainImageUrl: string
  saleEnabled: true
  skus: {
    skuId: string
    optionLabel: string | null
    price: number
    available: number
    reserved: number
    status: 'ON_SALE' | 'SOLD_OUT'
  }[]
}

/** HTTP 요청과 재시도 지문에 같은 정규화 입력을 사용한다. */
export function normalizeProductRegistration(input: ProductRegistrationPayload): ProductRegistrationPayload {
  return {
    name: input.name.trim(), description: input.description.trim(),
    skus: input.skus.map(sku => ({ optionLabel: sku.optionLabel?.trim() || null, price: sku.price, initialStock: sku.initialStock })),
  }
}

export function restoreProductRegistration(value: unknown): ProductRegistrationPayload {
  if (typeof value !== 'object' || value === null) throw new Error('등록 입력 기록을 읽지 못했어요.')
  const v = value as Record<string, unknown>
  if (typeof v.name !== 'string' || typeof v.description !== 'string' || !Array.isArray(v.skus)
    || !v.skus.length || v.skus.length > INITIAL_SKU_MAX) throw new Error('등록 입력 기록을 읽지 못했어요.')
  const skus = v.skus.map((sku: unknown) => {
    if (typeof sku !== 'object' || sku === null) throw new Error('판매 옵션 기록을 읽지 못했어요.')
    const s = sku as Record<string, unknown>
    if (!(s.optionLabel === null || typeof s.optionLabel === 'string') || typeof s.price !== 'number' || typeof s.initialStock !== 'number') throw new Error('판매 옵션 기록을 읽지 못했어요.')
    return { optionLabel: s.optionLabel as string | null, price: s.price, initialStock: s.initialStock }
  })
  return { name: v.name, description: v.description, skus }
}

export function validateProductRegistration(input: ProductRegistrationPayload, image: File | null): string | null {
  if (!input.name || input.name.length > PRODUCT_NAME_MAX) return `상품명은 1~${PRODUCT_NAME_MAX}자로 입력해 주세요.`
  if (!input.description || input.description.length > PRODUCT_DESCRIPTION_MAX) return `상품 설명은 1~${PRODUCT_DESCRIPTION_MAX}자로 입력해 주세요.`
  if (!image) return '대표 이미지를 선택해 주세요.'
  const imageError = validateImageFile(image)
  if (imageError) return imageError
  if (!input.skus.length || input.skus.length > INITIAL_SKU_MAX) return `판매 옵션은 1~${INITIAL_SKU_MAX}개가 필요해요.`
  const labels = new Set<string | null>()
  for (const [index, sku] of input.skus.entries()) {
    const prefix = `판매 옵션 ${index + 1}: `
    if ((sku.optionLabel?.length ?? 0) > OPTION_LABEL_MAX || (input.skus.length > 1 && !sku.optionLabel)) return prefix + `옵션명은 1~${OPTION_LABEL_MAX}자로 입력해 주세요.`
    if (labels.has(sku.optionLabel)) return prefix + '같은 옵션명이 있어요.'
    labels.add(sku.optionLabel)
    if (!Number.isSafeInteger(sku.price) || sku.price <= 0) return prefix + '가격은 1원 이상의 안전한 정수로 입력해 주세요.'
    if (!Number.isSafeInteger(sku.initialStock) || sku.initialStock < 0 || sku.initialStock > INITIAL_STOCK_MAX) return prefix + `초기 재고는 0~${INITIAL_STOCK_MAX}의 정수로 입력해 주세요.`
  }
  return null
}

/** 생성 응답과 저장된 결과를 검증한다. 잘못된 응답도 새 키 생성 근거가 아니다. */
export function parseProductCreateResult(value: unknown): ProductCreateResult {
  const fail = () => { throw new ApiError('UNKNOWN', '등록 응답을 확인하지 못했어요. 같은 내용과 키로 재시도해 주세요.') }
  const record = (v: unknown): Record<string, unknown> => typeof v === 'object' && v !== null ? v as Record<string, unknown> : fail()
  const id = (v: unknown): string => {
    if (typeof v === 'string' && /^[1-9]\d*$/.test(v)) return v
    if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0) return String(v)
    return fail()
  }
  const data = record(value)
  if (data.saleEnabled !== true || typeof data.mainImageUrl !== 'string' || !Array.isArray(data.skus) || !data.skus.length || data.skus.length > INITIAL_SKU_MAX) return fail()
  const skus = data.skus.map(value => {
    const sku = record(value)
    if (!(sku.optionLabel === null || typeof sku.optionLabel === 'string') || !Number.isSafeInteger(sku.price) || Number(sku.price) <= 0
      || !Number.isInteger(sku.available) || Number(sku.available) < 0 || Number(sku.available) > INITIAL_STOCK_MAX
      || sku.reserved !== 0 || (sku.status !== 'ON_SALE' && sku.status !== 'SOLD_OUT')
      || (sku.available === 0 ? sku.status !== 'SOLD_OUT' : sku.status !== 'ON_SALE')) return fail()
    return { skuId: id(sku.skuId), optionLabel: sku.optionLabel as string | null, price: sku.price as number, available: sku.available as number, reserved: 0, status: sku.status as 'ON_SALE' | 'SOLD_OUT' }
  })
  if (new Set(skus.map(sku => sku.skuId)).size !== skus.length) return fail()
  return { productId: id(data.productId), mainImageId: id(data.mainImageId), mainImageUrl: data.mainImageUrl, saleEnabled: true, skus }
}
