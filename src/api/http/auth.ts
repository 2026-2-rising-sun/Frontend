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
  const raw = createHttpClient(baseUrl, { accessToken: () => pair?.accessToken, unauthorized: (token) => { if (pair?.accessToken === token) clear() } })
  let refreshing: Promise<void> | null = null
  const refresh = () => {
    if (!refreshing && pair) {
      const current = pair; const attempt = generation
      refreshing = raw<TokenPair>('/member/v1/auth/refresh', { method: 'POST', body: { refreshToken: current.refreshToken }, anonymous: true })
        .then(tokens => { if (attempt !== generation) throw new ApiError('UNAUTHORIZED', '세션이 변경됐어요.'); pair = tokens })
        .catch(error => { if (attempt === generation) clear(); throw error })
        .finally(() => { refreshing = null })
    }
    return refreshing
  }
  const request: typeof raw = async (path, options) => {
    if (pair && !options?.anonymous) {
      let exp: number | undefined
      try { exp = JSON.parse(atob(pair.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp } catch { /* server verifies tokens */ }
      if (exp && exp * 1000 < Date.now() + 60000) await refresh()
    }
    return raw(path, options)
  }
  const auth: AuthPort = {
    testAccounts,
    getSession: store.getSession,
    subscribe: store.subscribe,
    async login(username, password) {
      clear()
      const attempt = generation
      const name = username.trim()
      const email = testAccounts && (name === 'user' || name === 'seller') ? `${name}@local.test` : name
      const tokens = await request<TokenPair>('/member/v1/auth/login', { method: 'POST', body: { email, password }, anonymous: true })
      const profile = await request<Profile>('/member/v1/members/me', { headers: { Authorization: `Bearer ${tokens.accessToken}` }, anonymous: true })
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
    async signup(email, password, displayName) {
      await raw('/member/v1/auth/signup', { method: 'POST', body: { email, password, displayName }, anonymous: true })
    },
    async updateName(displayName) {
      const attempt = generation
      const profile = await request<Profile>('/member/v1/members/me', { method: 'PATCH', body: { displayName } })
      if (attempt !== generation || !store.getSession()) return
      store.set({ ...store.getSession()!, displayName: profile.displayName })
    },
    async withdraw(password) {
      await request('/member/v1/members/me', { method: 'DELETE', body: { password } }); clear()
    },
    async revokeSessions() {
      const member = store.getSession()
      if (!member) throw new ApiError('UNAUTHORIZED', '로그인이 필요해요.')
      await request(`/member/v1/admin/members/${encodeURIComponent(member.memberId)}/sessions/revoke`, { method: 'POST' }); clear()
    },
    async logout() {
      const refreshToken = pair?.refreshToken
      clear()
      if (refreshToken) await request('/member/v1/auth/logout', { method: 'POST', body: { refreshToken }, anonymous: true })
    },
  }
  return { auth, request }
}
