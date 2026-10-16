import { test } from 'node:test'
import assert from 'node:assert/strict'
import { live } from '../src/api/http/mappers'
import { createHttpApi } from '../src/api/http'
Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
test('기존 방송 응답은 기본값을 유지하고 공개 메타정보를 매핑한다', () => {
  const original = { id: 1, title: '방송', status: 'PREPARING', scheduledAt: '2026-10-17T00:00:00Z', playbackUrl: null }
  assert.equal(live(original).thumbnailUrl, null)
  const value = live({ ...original, hostName: '진행자', description: '소개', thumbnailUrl: '/api/live/v1/broadcast-thumbnails/abc', thumbnailId: 'abc' })
  assert.equal(value.hostName, '진행자'); assert.equal(value.description, '소개'); assert.equal(value.thumbnailId, 'abc')
})
test('썸네일은 별도 업로드하고 방송 저장에는 서버 ID만 보내며 재시도에 업로드를 재사용한다', async () => {
  const calls: { url: string; body: unknown }[] = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: options?.body })
    let data: unknown = { id: 1, title: '방송', status: 'PREPARING', scheduledAt: '2026-10-17T00:00:00Z', playbackUrl: null }
    if (String(url).endsWith('/broadcast-thumbnails')) data = { thumbnailId: 'image-id' }
    else if (String(url).endsWith('/products')) data = []
    return new Response(JSON.stringify({ success: true, data }))
  }
  const api = createHttpApi('/api'); const thumbnail = new File(['png'], 'thumbnail.png', { type: 'image/png' })
  const input = { title: '방송', scheduledAt: '2026-10-17T00:00:00Z', channelArn: 'arn', playbackUrl: 'https://test/live.m3u8', hostName: '공개 진행자', description: '소개', thumbnail, idempotencyKey: 'same-key' }
  await api.admin.lives.create(input); await api.admin.lives.create(input)
  assert.equal(calls.filter(call => call.url.endsWith('/broadcast-thumbnails')).length, 1)
  const body = JSON.parse(String(calls.find(call => call.url.endsWith('/seller/broadcasts'))!.body))
  assert.equal(body.thumbnailId, 'image-id'); assert.equal(body.hostName, '공개 진행자'); assert.equal('thumbnail' in body, false)
})
