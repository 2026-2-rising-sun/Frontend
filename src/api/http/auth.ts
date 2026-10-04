import { createSessionStore, type AuthPort, type MemberSession } from '../../domain/auth'
import { ApiError } from '../../domain/errors'
import { createHttpClient } from './client'

type TokenPair = { accessToken: string; refreshToken: string }
type Profile = { memberId: string; email: string; displayName: string; roles: string[] }

export function createHttpAuth(baseUrl: string, testAccounts = false) {
  const store = createSessionStore()
  let pair: TokenPair | null = null
  let generation = 0
  const clear = () => { generation++; pair = null; store.set(null) }
  const request = createHttpClient(baseUrl, { accessToken: () => pair?.accessToken, unauthorized: clear })
  const auth: AuthPort = {
    testAccounts,
    getSession: store.getSession,
    subscribe: store.subscribe,
    async login(username, password) {
      clear()
      const attempt = generation
      const name = username.trim()
      const email = testAccounts && (name === 'user' || name === 'seller') ? `${name}@local.test` : name
      const tokens = await request<TokenPair>('/member/auth/login', { method: 'POST', body: { email, password }, anonymous: true })
      const profile = await request<Profile>('/member/members/me', { headers: { Authorization: `Bearer ${tokens.accessToken}` }, anonymous: true })
      if (attempt !== generation) throw new ApiError('UNAUTHORIZED', '로그인 요청이 취소됐어요.')
      if (profile.roles.length !== 1 || (profile.roles[0] !== 'USER' && profile.roles[0] !== 'SELLER')) {
        throw new ApiError('FORBIDDEN', '지원하지 않는 회원 역할이에요.')
      }
      pair = tokens
      const session: MemberSession = { memberId: profile.memberId, email: profile.email,
        displayName: profile.displayName, role: profile.roles[0] }
      store.set(session)
      return session
    },
    async logout() {
      const refreshToken = pair?.refreshToken
      clear()
      if (refreshToken) await request('/member/auth/logout', { method: 'POST', body: { refreshToken }, anonymous: true })
    },
  }
  return { auth, request }
}
