import { test } from 'node:test'
import assert from 'node:assert/strict'
import { live } from '../src/api/http/mappers'
const base = { id: 42, title: '방송', status: 'LIVE', scheduledAt: '2026-10-17T00:00:00Z', playbackUrl: null }
test('공개 방송 영상 신호 상태를 유지하고 누락된 값은 null로 처리한다', () => {
  for (const videoStatus of ['READY', 'NOT_READY', 'UNAVAILABLE', null] as const) assert.equal(live({ ...base, videoStatus }).videoStatus, videoStatus)
  assert.equal(live(base).videoStatus, null)
  assert.equal(live({ ...base, status: 'ENDED', videoStatus: 'READY' }).videoStatus, null)
})
