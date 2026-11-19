import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createProductRegistrationAttempt, registrationFingerprint, UnresolvedProductRegistrationError, type AttemptStorage } from '../src/features/seller/productRegistrationAttempt'

function memoryStorage(): AttemptStorage {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
}

const payload = { name: '상품', description: '설명', skus: [{ price: 1000, stock: 0 }] }
const image = () => new File(['image'], 'product.png', { type: 'image/png', lastModified: 1 })

test('동일 내용의 재시도는 새 파일 객체·새 세션 관리자에서도 키를 유지한다', async () => {
  const storage = memoryStorage()
  const key = await createProductRegistrationAttempt(storage, 'seller').prepare(payload, image())
  const retry = createProductRegistrationAttempt(storage, 'seller')
  assert.equal(await retry.prepare(payload, image()), key)
})

test('이름·크기·수정 시간이 같은 파일도 내용이 바뀌면 다른 요청이다', async () => {
  const changed = new File(['other'], 'product.png', { type: 'image/png', lastModified: 1 })
  assert.equal(changed.size, image().size)
  assert.notEqual(await registrationFingerprint(payload, changed), await registrationFingerprint(payload, image()))
})

test('결과 미확인 중 상품·SKU·이미지 변경은 새 키로 생성하지 않는다', async () => {
  const attempt = createProductRegistrationAttempt(memoryStorage(), 'seller')
  const key = await attempt.prepare(payload, image())
  for (const changed of [
    { ...payload, name: '변경' },
    { ...payload, skus: [{ price: 2000, stock: 0 }] },
    { ...payload, skus: [{ price: 1000, stock: 1 }] },
    { ...payload, skus: [...payload.skus, { price: 3000, stock: 1 }] },
  ]) await assert.rejects(attempt.prepare(changed, image()), UnresolvedProductRegistrationError)
  await assert.rejects(attempt.prepare(payload, new File(['other'], 'product.png', { type: 'image/png' })), UnresolvedProductRegistrationError)
  assert.equal(await attempt.prepare(payload, image()), key)
})

test('동시 준비는 하나의 키를 반환한다', async () => {
  const attempt = createProductRegistrationAttempt(memoryStorage(), 'seller')
  const keys = await Promise.all(Array.from({ length: 10 }, () => attempt.prepare(payload, image())))
  assert.equal(new Set(keys).size, 1)
})

test('등록 완료 후 새 등록은 새 키를 사용하고 늦은 완료는 새 기록을 지우지 않는다', async () => {
  const attempt = createProductRegistrationAttempt(memoryStorage(), 'seller')
  const first = await attempt.prepare(payload, image())
  attempt.finish(first)
  const next = await attempt.prepare(payload, image())
  assert.notEqual(next, first)
  attempt.finish(first)
  assert.equal(await attempt.prepare(payload, image()), next)
})

test('판매자별로 복구 기록을 격리한다', async () => {
  const storage = memoryStorage()
  const first = await createProductRegistrationAttempt(storage, 'seller-a').prepare(payload, image())
  const second = await createProductRegistrationAttempt(storage, 'seller-b').prepare(payload, image())
  assert.notEqual(first, second)
})

test('저장소 쓰기 실패 시 전송할 키를 반환하지 않는다', async () => {
  const storage = memoryStorage()
  storage.setItem = () => { throw new Error('storage blocked') }
  await assert.rejects(createProductRegistrationAttempt(storage, 'seller').prepare(payload, image()), /storage blocked/)
})

test('손상된 복구 기록은 덮어쓰지 않는다', async () => {
  const storage = memoryStorage()
  storage.setItem('seller-product-registration:seller', '{broken')
  await assert.rejects(createProductRegistrationAttempt(storage, 'seller').prepare(payload, image()), /등록 기록/)
  assert.equal(storage.getItem('seller-product-registration:seller'), '{broken')
})

test('완료 결과와 입력을 보관해 화면 재진입 시 생성 요청 없이 복원한다', async () => {
  const storage = memoryStorage()
  const attempt = createProductRegistrationAttempt(storage, 'seller')
  const key = await attempt.prepare(payload, image())
  const result = { productId: '42', skus: [{ skuId: '81' }] }
  attempt.complete(key, result)
  const restored = createProductRegistrationAttempt(storage, 'seller').snapshot()
  assert.deepEqual(restored?.payload, payload)
  assert.deepEqual(restored?.result, result)
  assert.equal(restored?.filename, 'product.png')
  assert.throws(() => attempt.complete('different', result), /요청 키/)
})
