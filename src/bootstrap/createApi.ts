import type { ComponentType } from 'react'
import { createHttpApi } from '../api/http'
import type { Api } from '../domain/ports'

export interface Bootstrap {
  api: Api
  /** 개발·시연용 화면 도구 (mock 모드에서만 존재) */
  devTools: ComponentType | null
}

/**
 * 앱이 사용할 API 구현을 고르는 유일한 곳.
 * - VITE_USE_MOCK=true  → src/mocks (동적 import 라 production 번들에는 포함되지 않는다)
 * - 그 외               → src/api/http (실제 백엔드)
 *
 * mock 제거 방법: src/mocks 폴더를 삭제하고 아래 if 블록을 지운다.
 */
export async function bootstrap(): Promise<Bootstrap> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    const mocks = await import('../mocks')
    return { api: mocks.createMockApi(), devTools: mocks.MockControlPanel }
  }
  return { api: createHttpApi(import.meta.env.VITE_API_BASE_URL ?? '/api', import.meta.env.DEV), devTools: null }
}
