import { ApiError } from './errors'

export type MemberRole = 'USER' | 'SELLER'
export interface MemberSession {
  memberId: string
  email: string
  displayName: string
  role: MemberRole
}
export interface AuthPort {
  /** 개발 환경에서만 간편 계정 입력을 제공한다. */
  readonly testAccounts: boolean
  login(username: string, password: string): Promise<MemberSession>
  logout(): Promise<void>
  getSession(): MemberSession | null
  subscribe(listener: () => void): () => void
}

/** 토큰은 구현 내부 메모리에만 보관한다. 화면은 회원 정보만 구독한다. */
export function createSessionStore() {
  let session: MemberSession | null = null
  const listeners = new Set<() => void>()
  return {
    getSession: () => session,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(value: MemberSession | null) {
      session = value
      for (const listener of listeners) listener()
    },
  }
}

export function requireSeller(session: MemberSession | null) {
  if (!session) throw new ApiError('UNAUTHORIZED', '로그인이 필요해요.')
  if (session.role !== 'SELLER') throw new ApiError('FORBIDDEN', '판매자 계정으로 로그인해 주세요.')
}
