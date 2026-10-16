import { useRef, useState } from 'react'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { AsyncView } from '../../components/AsyncView'
import { Alert, Button, ResultState, Skeleton } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice, formatFullDateTime } from '../../lib/format'
import { couponStatusLabel } from '../../domain/coupons'
import styles from './coupons.module.css'
export function CouponsPage() {
  const api = useApi(); const [tab, setTab] = useState<'mine' | 'available'>('mine'); const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(''); const lock = useRef(false); const [message, setMessage] = useState(''); const [error, setError] = useState('')
  const data = useAsync(async () => tab === 'mine' ? (await api.coupons.mine(page)).map(c => ({ ...c, label: couponStatusLabel[c.status] })) : (await api.coupons.available(page)).map(c => ({ ...c, label: `남은 수량 ${c.remaining}장` })), [api, tab, page])
  async function claim(id: string) { if (lock.current) return; lock.current = true; setBusy(id); setError(''); setMessage(''); try { await api.coupons.claim(id); setMessage('쿠폰을 받았어요. 내 쿠폰에서 확인하세요.'); data.reload() } catch (e) { setError(e instanceof Error ? e.message : '쿠폰을 받지 못했어요.') } finally { lock.current = false; setBusy('') } }
  return <PageContainer><div className={styles.stack}><h1 className="t-h1">쿠폰함</h1><div className={styles.actions}>{(['mine', 'available'] as const).map(t => <Button key={t} variant={tab === t ? 'primary' : 'secondary'} aria-pressed={tab === t} onClick={() => { setTab(t); setPage(0) }}>{t === 'mine' ? '내 쿠폰' : '받을 수 있는 쿠폰'}</Button>)}</div>
    {message && <p role="status">{message}</p>}{error && <Alert type="danger" title="쿠폰을 확인해 주세요">{error}</Alert>}
    {data.error && data.data && <Alert type="warning" title="최신 쿠폰을 확인하지 못했어요"><Button onClick={data.reload}>다시 조회</Button></Alert>}
    <AsyncView state={data} skeleton={<Skeleton height={160} />}>{items => items.length ? <div className={styles.grid}>{items.map(c => <article className={styles.card} key={c.id}><h2 className="t-h4">{c.name}</h2><strong>{formatPrice(c.fixedDiscount)} 할인</strong><span>{c.label}</span><p className={styles.muted}>사용 기한 {formatFullDateTime(c.expiresAt)}</p>{'endsAt' in c && <p className={styles.muted}>받기 종료 {formatFullDateTime(c.endsAt)}</p>}{'endsAt' in c && <Button disabled={!!busy || data.loading} onClick={() => claim(c.id)}>{busy === c.id ? '받는 중…' : '쿠폰 받기'}</Button>}</article>)}</div> : <ResultState type="empty" title={tab === 'mine' ? '보유한 쿠폰이 없어요' : '지금 받을 수 있는 쿠폰이 없어요'} />}</AsyncView>
    <div className={styles.actions}><Button variant="secondary" disabled={!page || data.loading} onClick={() => setPage(p => p - 1)}>이전</Button><span>{page + 1} 페이지</span><Button variant="secondary" disabled={data.loading || !data.data || data.data.length < 20} onClick={() => setPage(p => p + 1)}>다음</Button></div>
  </div></PageContainer>
}
