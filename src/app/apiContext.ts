import { createContext, useContext } from 'react'
import type { Api } from '../domain/ports'

/** 화면이 API 를 얻는 유일한 통로. 실제/mock 구현을 알지 못하고 Api 인터페이스만 본다. */
export const ApiContext = createContext<Api | null>(null)

export function useApi(): Api {
  const api = useContext(ApiContext)
  if (!api) throw new Error('useApi 는 ApiContext.Provider 안에서만 사용할 수 있어요.')
  return api
}
