import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createNotifications } from '../src/api/http/notifications'
import type { HttpClient } from '../src/api/http/client'
import { notificationTarget, type Notification } from '../src/domain/notifications'
test('알림 페이지 커서는 그대로 전달하고 새 이벤트 유형과 숫자 ID를 보존한다', async () => {
  const calls: unknown[] = []
  const api = createNotifications((async (path: string, options: unknown) => { calls.push({ path, options }); return { items: [{ id: 42, eventType: 'FutureEvent', linkType: null }], nextCursor: 'opaque/cursor+', hasNext: true } }) as HttpClient)
  const page = await api.list('opaque/cursor+')
  assert.equal(page.items[0].id, '42'); assert.equal(page.items[0].eventType, 'FutureEvent')
  assert.deepEqual(calls[0], { path: '/notification/v1/notifications', options: { query: { cursor: 'opaque/cursor+', size: 20 } } })
})
test('알림 링크는 알려진 대상과 유효한 양수 ID만 내부 경로로 연결한다', () => {
  const item = { linkType: 'PRODUCT', linkValue: '42' } as Notification
  assert.equal(notificationTarget(item), '/products/42')
  assert.equal(notificationTarget({ ...item, linkType: 'BROADCAST' }), '/lives/42')
  assert.equal(notificationTarget({ ...item, linkValue: '//external' }), null)
  assert.equal(notificationTarget({ ...item, linkType: null }), null)
})

test('알림 개수와 읽음 처리는 회원 본인의 API를 사용한다', async () => {
  const calls: { path: string; options: unknown }[] = []
  const api = createNotifications((async (path: string, options: unknown) => { calls.push({ path, options }); return { unreadCount: 3 } }) as HttpClient)
  assert.equal(await api.unreadCount(), 3)
  await api.read('42')
  assert.deepEqual(calls[1], { path: '/notification/v1/notifications/42/read', options: { method: 'POST', responseType: 'empty' } })
})

test('알림 신청은 201 빈 본문으로 처리하고 신청·해제·읽음 계약을 지킨다', async () => {
  const calls: { path: string; options: unknown }[] = []
  const api = createNotifications((async (path: string, options: unknown) => { calls.push({ path, options }) }) as HttpClient)
  await api.registerBroadcast('42'); await api.unregisterBroadcast('42'); await api.registerRestock('8'); await api.unregisterRestock('8'); await api.read('9')
  assert.deepEqual(calls.map(call => call.path), ['/notification/v1/broadcast-alerts', '/notification/v1/broadcast-alerts/42', '/notification/v1/restock-alerts', '/notification/v1/restock-alerts/8', '/notification/v1/notifications/9/read'])
  assert.deepEqual(calls[0].options, { method: 'POST', body: { broadcastId: 42 }, responseType: 'empty' })
})
