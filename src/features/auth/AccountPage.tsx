import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, ButtonLink, Input } from '../../components/ui'
import { useSession } from './useSession'
import styles from './AccountPage.module.css'

const SHORTCUTS = [
  { to: '/orders/lookup', title: '내 주문', description: '주문 내역과 결제 상태 확인' },
  { to: '/cart', title: '장바구니', description: '담아 둔 상품 모아보기' },
  { to: '/coupons', title: '쿠폰함', description: '사용 가능한 할인 쿠폰 확인' },
  { to: '/notifications/subscriptions', title: '내 알림 신청', description: '방송 시작·재입고 알림 관리' },
  { to: '/notifications', title: '알림함', description: '새로운 소식과 알림 확인' },
]

export function AccountPage() {
  const session = useSession()
  const { auth } = useApi()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'danger'; message: string } | null>(null)
  if (!session) return <Navigate to="/login" replace state={{ from: '/account' }} />
  async function action(fn: () => Promise<void>, message: string) {
    if (busy) return
    setBusy(true); setNotice(null)
    try {
      await fn()
      if (message) setNotice({ type: 'success', message })
    } catch (e) {
      setNotice({ type: 'danger', message: e instanceof Error ? e.message : '처리하지 못했어요.' })
    } finally { setBusy(false) }
  }
  return <PageContainer className={styles.container}>
    <header className={styles.heading}><h1 className="t-h1">내 계정</h1><p>내 정보와 쇼핑 내역을 한곳에서 관리하세요.</p></header>
    <section className={styles.profile} aria-label="내 프로필">
      <span className={styles.avatar} aria-hidden="true">{Array.from(session.displayName)[0] ?? '나'}</span>
      <div className={styles.profileText}><span className={styles.role}>{session.role === 'SELLER' ? '판매자 계정' : '유저 계정'}</span><h2 className="t-h3"><span>{session.displayName}</span>님</h2><p>{session.email}</p></div>
      <Button variant="secondary" size="S" disabled={busy} onClick={() => { setName(session.displayName); setEditingName(true); setNotice(null) }}>이름 변경</Button>
    </section>
    {notice && <Alert type={notice.type} title={notice.message} />}
    {editingName && <section className={styles.card} aria-labelledby="name-title">
      <h2 id="name-title" className="t-h4">이름 변경</h2>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); if (name.trim() && name.trim() !== session.displayName) void action(async () => { await auth.updateName(name.trim()); setEditingName(false) }, '이름을 변경했어요.') }}>
        <Input label="변경할 이름" value={name} onChange={e => setName(e.target.value)} maxLength={80} required disabled={busy} />
        <div className={styles.actions}><Button type="submit" disabled={busy || !name.trim() || name.trim() === session.displayName}>{busy ? '저장 중…' : '이름 저장'}</Button><Button variant="secondary" disabled={busy} onClick={() => setEditingName(false)}>취소</Button></div>
      </form>
    </section>}
    {session.role === 'SELLER' && <section className={styles.seller} aria-labelledby="seller-title">
      <div><h2 id="seller-title" className="t-h4">판매자 센터</h2><p>상품·방송·쿠폰·환불을 관리하세요.</p></div><ButtonLink to="/seller/products">판매자 콘솔 →</ButtonLink>
    </section>}
    <section className={styles.section} aria-labelledby="shopping-title">
      <h2 id="shopping-title" className="t-h4">나의 쇼핑</h2>
      <div className={styles.shortcuts}>{SHORTCUTS.map(item => <Link key={item.to} to={item.to} className={styles.shortcut}><div><h3>{item.title}</h3><p>{item.description}</p></div><span aria-hidden="true">→</span></Link>)}</div>
    </section>
    <section className={styles.card} aria-labelledby="settings-title">
      <h2 id="settings-title" className="t-h4">계정 설정</h2>
      <div className={styles.settingRow}><div><h3>로그아웃</h3><p>현재 기기의 로그인을 종료해요.</p></div><Button variant="secondary" disabled={busy} onClick={() => action(async () => { await auth.logout(); navigate('/login') }, '')}>로그아웃</Button></div>
      {session.role === 'SELLER' && <div className={styles.settingRow}><div><h3>모든 기기에서 로그아웃</h3><p>다른 기기에 로그인된 세션도 종료해요.</p></div><Button variant="secondary" disabled={busy} onClick={() => action(async () => { await auth.revokeSessions(); navigate('/login') }, '')}>내 모든 세션 종료</Button></div>}
      <div className={styles.withdraw}>
        <button type="button" className={styles.withdrawToggle} aria-expanded={confirm} aria-controls="withdraw-form" disabled={busy} onClick={() => { setConfirm(v => !v); setPassword(''); setNotice(null) }}>회원 탈퇴 <span aria-hidden="true">{confirm ? '−' : '+'}</span></button>
        {confirm && <form id="withdraw-form" className={styles.form} onSubmit={e => { e.preventDefault(); void action(async () => { await auth.withdraw(password); navigate('/') }, '') }}>
          <Alert type="warning" title="탈퇴 후에는 주문·계정에 다시 접근할 수 없어요">계속하려면 비밀번호를 입력하고 탈퇴를 확정하세요.</Alert>
          <Input label="현재 비밀번호" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} />
          <div className={styles.actions}><Button type="submit" variant="danger" disabled={busy || !password}>{busy ? '처리 중…' : '탈퇴 확정'}</Button><Button variant="secondary" disabled={busy} onClick={() => { setConfirm(false); setPassword('') }}>취소</Button></div>
        </form>}
      </div>
    </section>
  </PageContainer>
}
