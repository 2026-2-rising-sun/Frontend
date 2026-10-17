import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, Input } from '../../components/ui'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const { auth } = useApi()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <section className={styles.loginCard} aria-labelledby="login-title">
      <header className={styles.heading}>
        <span className={styles.brand}><span aria-hidden="true" />ShoppingLive</span>
        <h1 id="login-title" className="t-h1">로그인</h1>
        <p>로그인하고 쇼핑과 라이브를 이어가세요.</p>
      </header>
      <form className={styles.loginForm} onSubmit={submit} aria-label="로그인">
        <Input label={auth.testAccounts ? '아이디 또는 이메일' : '이메일'} autoComplete="username" maxLength={254} value={username}
          placeholder={auth.testAccounts ? '아이디 또는 이메일을 입력해 주세요' : '이메일을 입력해 주세요'}
          onChange={(e) => setUsername(e.target.value)} required disabled={busy} />
        <div className={styles.passwordField}>
          <Input id="login-password" label="비밀번호" type={showPassword ? 'text' : 'password'} autoComplete="current-password" maxLength={72} value={password}
            placeholder="비밀번호를 입력해 주세요" onChange={(e) => setPassword(e.target.value)} required disabled={busy} />
          <button className={styles.passwordToggle} type="button" aria-controls="login-password" aria-pressed={showPassword} disabled={busy} onClick={() => setShowPassword(v => !v)}>비밀번호 {showPassword ? '숨기기' : '표시'}</button>
        </div>
        {error && <Alert type="danger" title="로그인하지 못했어요">{error}</Alert>}
        <Button type="submit" size="L" disabled={busy} fullWidth>{busy ? '로그인 중…' : '로그인'}</Button>
      </form>
      <p className={styles.signup}>처음 방문하셨나요? <Link to="/signup">회원가입 →</Link></p>
      {auth.testAccounts && <details className={styles.testAccounts}>
        <summary>개발용 테스트 계정</summary>
        <p>계정 정보를 입력한 뒤 로그인 버튼을 눌러 주세요.</p>
        <div className={styles.accounts}>
          <Button variant="secondary" disabled={busy} onClick={() => { setUsername('user'); setPassword('user') }}>유저 계정 입력</Button>
          <Button variant="secondary" disabled={busy} onClick={() => { setUsername('seller'); setPassword('seller') }}>판매자 계정 입력</Button>
        </div>
      </details>}
    </section>
    <Link to="/" className={styles.browse}>로그인 없이 둘러보기 →</Link>
  </PageContainer>
}
