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
  restore(): Promise<void>
  login(username: string, password: string): Promise<MemberSession>
  logout(): Promise<void>
  signup(email: string, password: string, displayName: string): Promise<void>
  updateName(displayName: string): Promise<void>
  withdraw(password: string): Promise<void>
  revokeSessions(): Promise<void>
  getSession(): MemberSession | null
  subscribe(listener: () => void): () => void
}

/** 화면은 서버에서 확인된 회원 정보만 구독한다. 토큰 보관은 HTTP 인증 구현이 담당한다. */
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
