import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { Button, ButtonLink, Input } from '../../components/ui'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const { auth } = useApi()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const session = await auth.login(username, password)
      const destination = location.state?.from
      const safe = typeof destination === 'string' && destination.startsWith('/') && !destination.startsWith('//')
      navigate(safe ? destination : session.role === 'SELLER' ? '/admin/products' : '/account', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '로그인하지 못했어요.')
    } finally { setBusy(false) }
  }
  return <PageContainer narrow>
    <form className={styles.form} onSubmit={submit}>
      <h1>로그인</h1>
      <Input label={auth.testAccounts ? '아이디 또는 이메일' : '이메일'} autoComplete="username" maxLength={254} value={username}
        onChange={(e) => setUsername(e.target.value)} required disabled={busy} />
      <Input label="비밀번호" type="password" autoComplete="current-password" maxLength={72} value={password}
        onChange={(e) => setPassword(e.target.value)} required disabled={busy} />
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy} fullWidth>{busy ? '로그인 중…' : '로그인'}</Button>
      <ButtonLink to="/signup" variant="secondary">회원가입</ButtonLink>
      {auth.testAccounts && <div className={styles.accounts}>
        <p>테스트 계정: user / user · seller / seller</p>
        <Button variant="secondary" disabled={busy} onClick={() => { setUsername('user'); setPassword('user') }}>유저 계정 입력</Button>
        <Button variant="secondary" disabled={busy} onClick={() => { setUsername('seller'); setPassword('seller') }}>판매자 계정 입력</Button>
      </div>}
    </form>
  </PageContainer>
}
