import { ApiError } from '../domain/errors'
import { getMockSettings } from './control'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 네트워크 지연을 흉내 낸다. 읽기 요청이면 failReads 설정에 따라 실패시킨다. */
export async function simulateNetwork(kind: 'read' | 'write' = 'read') {
  const { latencyMs, failReads } = getMockSettings()
  await sleep(latencyMs)
  if (kind === 'read' && failReads) {
    throw new ApiError('NETWORK', '서버에 연결하지 못했어요. (mock: 조회 실패 시뮬레이션)')
  }
}
