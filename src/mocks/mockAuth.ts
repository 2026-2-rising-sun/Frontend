import { createSessionStore, type AuthPort, type MemberSession } from '../domain/auth'
import { ApiError } from '../domain/errors'

export function createMockAuth(): AuthPort {
  const store = createSessionStore()
  return {
    testAccounts: true,
    getSession: store.getSession,
    subscribe: store.subscribe,
    async login(username, password) {
      store.set(null)
      const name = username.trim().replace(/@local\.test$/, '')
      if ((name !== 'user' && name !== 'seller') || password !== name) {
        throw new ApiError('UNAUTHORIZED', '아이디 또는 비밀번호를 확인해 주세요.')
      }
      const session: MemberSession = { memberId: `mock-${name}`, email: `${name}@local.test`,
        displayName: name === 'seller' ? '테스트 판매자' : '테스트 유저', role: name === 'seller' ? 'SELLER' : 'USER' }
      store.set(session)
      return session
    },
    async logout() { store.set(null) },
  }
}
