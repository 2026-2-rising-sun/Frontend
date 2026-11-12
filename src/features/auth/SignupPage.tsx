import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, Input } from '../../components/ui'
import styles from './LoginPage.module.css'
export function SignupPage() {
  const { auth } = useApi(); const navigate = useNavigate()
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try { await auth.signup(email.trim(), password, name.trim()); navigate('/login', { replace: true }) }
    catch (e) { setError(e instanceof Error ? e.message : '가입하지 못했어요.') }
    finally { setBusy(false) }
  }
  return <PageContainer narrow><form className={styles.form} onSubmit={submit}><h1>회원가입</h1>
    <Input label="이메일" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required disabled={busy} />
    <Input label="비밀번호" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} helper="8자 이상" />
    <Input label="이름" value={name} onChange={e => setName(e.target.value)} maxLength={80} required disabled={busy} />
    {error && <Alert type="danger" title={error} />}<Button type="submit" disabled={busy}>가입하기</Button>
  </form></PageContainer>
}
