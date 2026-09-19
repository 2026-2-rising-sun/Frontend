import { ApiError } from '../domain/errors'
import type { LivesPort } from '../domain/ports'
import type { LiveDetail, LiveSummary } from '../domain/types'
import { db } from './db'
import { simulateNetwork } from './simulate'

const toSummary = ({ description: _d, playbackUrl: _p, ...summary }: LiveDetail): LiveSummary => summary

/** 진행 중(최근 시작 순) → 예정(가까운 순) → 종료(최근 종료 순) */
const order = (a: LiveDetail, b: LiveDetail) => {
  const rank = { LIVE: 0, READY: 1, ENDED: 2 } as const
  if (a.status !== b.status) return rank[a.status] - rank[b.status]
  if (a.status === 'LIVE') return +new Date(b.startedAt ?? 0) - +new Date(a.startedAt ?? 0)
  if (a.status === 'READY') return +new Date(a.scheduledAt) - +new Date(b.scheduledAt)
  return +new Date(b.endedAt ?? 0) - +new Date(a.endedAt ?? 0)
}

export const mockLivesApi: LivesPort = {
  async list(status) {
    await simulateNetwork('read')
    return db.lives
      .filter((l) => !status || l.status === status)
      .sort(order)
      .map(toSummary)
  },

  async get(liveId) {
    await simulateNetwork('read')
    const live = db.lives.find((l) => l.id === liveId)
    if (!live) throw new ApiError('NOT_FOUND', '방송을 찾을 수 없어요.')
    return structuredClone(live)
  },

  async listProducts(liveId) {
    await simulateNetwork('read')
    const ids = db.liveProductIds[liveId]
    if (!ids) throw new ApiError('NOT_FOUND', '방송을 찾을 수 없어요.')
    return structuredClone(
      ids
        .map((id) => db.products.find((p) => p.id === id))
        // 비공개·판매 준비 상품은 공개 방송 상품 영역에서 제외한다.
        .filter((p): p is NonNullable<typeof p> => !!p && (p.status === 'SELLING' || p.status === 'SOLD_OUT')),
    )
  },
}
