import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, ButtonLink, Input } from '../../components/ui'
import { useSession } from './useSession'
import styles from './LoginPage.module.css'
export function AccountPage() {
  const session = useSession(); const { auth } = useApi(); const navigate = useNavigate()
  const [name, setName] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('')
  if (!session) return <Navigate to="/login" replace state={{ from: '/account' }} />
  async function action(fn: () => Promise<void>, message: string) {
    if (busy) return; setBusy(true); setNotice('')
    try { await fn(); setNotice(message) } catch (e) { setNotice(e instanceof Error ? e.message : '처리하지 못했어요.') } finally { setBusy(false) }
  }
  return <PageContainer narrow><section className={styles.form}>
    <h1>내 계정</h1><p>{session.displayName}</p><p>{session.email}</p><p>{session.role === 'SELLER' ? '판매자 계정' : '유저 계정'}</p>
    {notice && <Alert type="info" title={notice} />}
    <form className={styles.form} onSubmit={(e: FormEvent) => { e.preventDefault(); if (name.trim()) void action(() => auth.updateName(name.trim()), '이름을 변경했어요.') }}>
      <Input label="변경할 이름" value={name} onChange={e => setName(e.target.value)} maxLength={80} required disabled={busy} /><Button type="submit" disabled={busy}>이름 저장</Button>
    </form>
    <ButtonLink to="/orders/lookup">내 주문</ButtonLink><ButtonLink to="/cart" variant="secondary">장바구니</ButtonLink>
    <Button variant="secondary" disabled={busy} onClick={() => action(async () => { await auth.logout(); navigate('/login') }, '')}>로그아웃</Button>
    {session.role === 'SELLER' && <><ButtonLink to="/admin/products">판매자 콘솔</ButtonLink><Button variant="secondary" disabled={busy} onClick={() => action(async () => { await auth.revokeSessions(); navigate('/login') }, '')}>내 모든 세션 종료</Button></>}
    <Button variant="secondary" disabled={busy} onClick={() => setConfirm(v => !v)}>회원 탈퇴</Button>
    {confirm && <form className={styles.form} onSubmit={e => { e.preventDefault(); void action(async () => { await auth.withdraw(password); navigate('/') }, '') }}>
      <Alert type="warning" title="탈퇴 후에는 주문·계정에 다시 접근할 수 없어요">계속하려면 비밀번호를 입력하고 탈퇴를 확정하세요.</Alert>
      <Input label="현재 비밀번호" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} />
      <Button type="submit" variant="danger" disabled={busy}>탈퇴 확정</Button>
    </form>}
  </section></PageContainer>
}
