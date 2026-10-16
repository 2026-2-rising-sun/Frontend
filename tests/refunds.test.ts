import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createRefunds, type RefundDto } from '../src/api/http/refunds'
import type { HttpClient } from '../src/api/http/client'
import { refundPending, remainingRefundAmount } from '../src/domain/refunds'

const refund: RefundDto = {
  id: 51, paymentGroupNumber: 'PG-1', refundAmount: 1900, cumulativeRefundAmount: 0,
  status: 'PROCESSING', requestedAt: '2026-10-16T00:00:00Z', resolvedAt: null,
  targets: [{ cartItemId: null, orderId: 301, productId: 1, productName: '상품', quantity: 2, refundAmount: 1900 }],
  recovery: { retryCount: 0, retryExhausted: false, nextActionAt: '2026-10-16T00:00:00Z' },
}

test('전체 환불은 본문 없이 Idempotency-Key로 접수하며 숫자 ID를 매핑한다', async () => {
  const calls: { path: string; options: unknown }[] = []
  const api = createRefunds((async (path: string, options?: { method?: string }) => {
    calls.push({ path, options })
    return options?.method === 'POST' ? refund : []
  }) as HttpClient)
  const result = await api.requestFull('PG/1', 'refund-key')
  assert.deepEqual(calls, [
    { path: '/commerce/v1/payment-groups/PG%2F1/refunds', options: undefined },
    { path: '/commerce/v1/payment-groups/PG%2F1/refunds', options: { method: 'POST', headers: { 'Idempotency-Key': 'refund-key' } } },
  ])
  assert.equal(result.id, '51')
  assert.equal(result.targets[0].cartItemId, null)
  assert.equal(result.targets[0].orderId, '301')
  assert.equal(result.targets[0].productId, '1')
  assert.equal(result.status, 'PROCESSING')
})

test('PROCESSING과 UNKNOWN이 있으면 새 환불을 접수하지 않는다', async () => {
  for (const status of ['PROCESSING', 'UNKNOWN'] as const) {
    const api = createRefunds((async (_path: string, options?: { method?: string }) => {
      assert.notEqual(options?.method, 'POST')
      return [{ ...refund, status }]
    }) as HttpClient)
    const result = await api.requestFull('PG-1', 'key')
    assert.equal(result.status, status)
    assert.ok(refundPending(result))
  }
})

test('접수 응답이 유실돼도 이력에서 새 요청을 복구하며 재접수하지 않는다', async () => {
  let posted = false; let posts = 0
  const api = createRefunds((async (_path: string, options?: { method?: string }) => {
    if (options?.method === 'POST') { posted = true; posts++; throw new Error('response lost') }
    return posted ? [refund] : []
  }) as HttpClient)
  const recovered = await api.requestFull('PG-1', 'same-key')
  assert.equal(recovered.id, '51')
  assert.equal(posts, 1)
  assert.equal((await api.requestFull('PG-1', 'same-key')).id, '51')
  assert.equal(posts, 1)
})

test('응답 유실 후 완료된 요청도 이력으로 복구한다', async () => {
  let posted = false
  const api = createRefunds((async (_path: string, options?: { method?: string }) => {
    if (options?.method === 'POST') { posted = true; throw new Error('response lost') }
    return posted ? [{ ...refund, status: 'SUCCESS', cumulativeRefundAmount: 1900, recovery: null }] : []
  }) as HttpClient)
  assert.equal((await api.requestFull('PG-1', 'key')).status, 'SUCCESS')
})

test('요청 미확정 시 명시적인 재시도는 같은 키를 유지하고 이전 실패를 접수 성공으로 오인하지 않는다', async () => {
  const keys: string[] = []
  const api = createRefunds((async (_path: string, options?: { method?: string; headers?: Record<string, string> }) => {
    if (options?.method === 'POST') { keys.push(options.headers!['Idempotency-Key']); throw new Error('gateway unavailable') }
    return [{ ...refund, status: 'FAILED', recovery: null }]
  }) as HttpClient)
  await assert.rejects(api.requestFull('PG-1', 'same-key'), /gateway unavailable/)
  await assert.rejects(api.requestFull('PG-1', 'same-key'), /gateway unavailable/)
  assert.deepEqual(keys, ['same-key', 'same-key'])
})

test('최신 이력을 조회하지 못하면 새 환불을 보내지 않는다', async () => {
  const api = createRefunds((async (_path: string, options?: { method?: string }) => {
    assert.notEqual(options?.method, 'POST')
    throw new Error('503')
  }) as HttpClient)
  await assert.rejects(api.requestFull('PG-1', 'key'), /503/)
})

test('서버의 기한·권한 거절은 그대로 표시할 수 있게 전파한다', async () => {
  const api = createRefunds((async (_path: string, options?: { method?: string }) => {
    if (options?.method === 'POST') throw new Error('환불 가능 기한이 지났습니다.')
    return []
  }) as HttpClient)
  await assert.rejects(api.requestFull('PG-1', 'key'), /환불 가능 기한/)
})

test('구매자 상세는 결제 묶음과 환불 ID를 함께 사용한다', async () => {
  const api = createRefunds((async (path: string) => {
    assert.equal(path, '/commerce/v1/payment-groups/PG-1/refunds/51')
    return { ...refund, targets: [{ ...refund.targets[0], cartItemId: 101 }] }
  }) as HttpClient)
  assert.equal((await api.get('PG-1', '51')).targets[0].cartItemId, '101')
})

test('확정된 누적 환불액만 차감하고 실패·처리중 요청 금액을 완료로 계산하지 않는다', () => {
  const mapped = { ...refund, id: '51', targets: [] }
  assert.equal(remainingRefundAmount(1900, []), 1900)
  assert.equal(remainingRefundAmount(1900, [mapped]), 1900)
  assert.equal(remainingRefundAmount(1900, [{ ...mapped, cumulativeRefundAmount: 500 }, { ...mapped, cumulativeRefundAmount: 900 }]), 1000)
  assert.equal(remainingRefundAmount(1900, [{ ...mapped, cumulativeRefundAmount: 2000 }]), 0)
  assert.equal(refundPending({ ...mapped, status: 'FAILED' }), false)
})
