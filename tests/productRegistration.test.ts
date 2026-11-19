import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { normalizeProductRegistration, parseProductCreateResult, validateProductRegistration } from '../src/domain/productRegistration'

const image = new File(['image'], 'image.png', { type: 'image/png' })
const payload = { name: '상품', description: '설명', skus: [{ optionLabel: null, price: 1, initialStock: 0 }] }

test('단일 옵션명 생략과 재고 0·int32 상한을 허용한다', () => {
  assert.equal(validateProductRegistration(payload, image), null)
  assert.equal(validateProductRegistration({ ...payload, skus: [{ optionLabel: null, price: Number.MAX_SAFE_INTEGER, initialStock: 2147483647 }] }, image), null)
  assert.deepEqual(normalizeProductRegistration({ ...payload, name: ' 상품 ', skus: [{ ...payload.skus[0], optionLabel: '  ' }] }), payload)
})

test('가격과 재고의 소수·음수·NaN·안전 범위 초과를 거절한다', () => {
  for (const price of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.match(validateProductRegistration({ ...payload, skus: [{ ...payload.skus[0], price }] }, image)!, /가격/)
  }
  for (const initialStock of [-1, 0.5, NaN, Infinity, 2147483648]) {
    assert.match(validateProductRegistration({ ...payload, skus: [{ ...payload.skus[0], initialStock }] }, image)!, /재고/)
  }
})

test('다중 옵션은 공백 정규화 후 고유한 표시명이 필요하고 100개로 제한한다', () => {
  const skus = ['검정', ' 검정 '].map(optionLabel => ({ optionLabel, price: 1, initialStock: 0 }))
  assert.match(validateProductRegistration(normalizeProductRegistration({ ...payload, skus }), image)!, /같은 옵션명/)
  assert.match(validateProductRegistration({ ...payload, skus: [payload.skus[0], { ...payload.skus[0], optionLabel: '다른 옵션' }] }, image)!, /옵션명/)
  const hundred = Array.from({ length: 100 }, (_, i) => ({ optionLabel: String(i), price: 1, initialStock: 0 }))
  assert.equal(validateProductRegistration({ ...payload, skus: hundred }, image), null)
  assert.match(validateProductRegistration({ ...payload, skus: [...hundred, { ...hundred[0], optionLabel: '100' }] }, image)!, /100/)
  assert.match(validateProductRegistration({ ...payload, skus: [] }, image)!, /1~/)
})

test('상품 필수값·이미지 누락·빈 파일·형식·크기 오류를 거절한다', () => {
  assert.match(validateProductRegistration({ ...payload, name: '' }, image)!, /상품명/)
  assert.match(validateProductRegistration({ ...payload, description: '' }, image)!, /상품 설명/)
  assert.match(validateProductRegistration(payload, null)!, /대표 이미지/)
  for (const file of [new File([], 'empty.png', { type: 'image/png' }), new File(['gif'], 'image.gif', { type: 'image/gif' }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })]) {
    assert.ok(validateProductRegistration(payload, file))
  }
})

test('응답의 잘못된 상태·중복 SKU·부정확한 식별자는 성공으로 처리하지 않는다', () => {
  const sku = { skuId: 1, optionLabel: null, price: 1, available: 0, reserved: 0, status: 'SOLD_OUT' }
  const result = { productId: 1, mainImageId: 2, mainImageUrl: '/image', saleEnabled: true, skus: [sku] }
  assert.equal(parseProductCreateResult(result).skus[0].skuId, '1')
  for (const value of [null, { ...result, productId: Number.MAX_SAFE_INTEGER + 1 }, { ...result, saleEnabled: false },
    { ...result, skus: [] }, { ...result, skus: [sku, sku] }, { ...result, skus: [{ ...sku, status: 'ON_SALE' }] }]) {
    assert.throws(() => parseProductCreateResult(value), { code: 'UNKNOWN' })
  }
})
