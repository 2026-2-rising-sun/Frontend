import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { BellIcon, CheckIcon, DownloadIcon } from '../../components/icons'
import { couponDropState, type CouponDrop } from '../../domain/couponDrops'
import { useAsync } from '../../hooks/useAsync'
import { useSession } from '../auth/useSession'
import { countdown, kstTime, type CouponDrops } from './useCouponDrops'
import styles from './DailyCouponDrops.module.css'

const count = (n: number) => n.toLocaleString('ko-KR')

/** 버튼에 내세울 쿠폰. 받을 수 있는 쿠폰, 곧 열리는 쿠폰, 마감된 쿠폰 순서로 고른다. */
function pickDrop(drops: CouponDrop[], now: number) {
  const by = (state: string) => drops.filter(drop => couponDropState(drop, now) === state).toSorted((a, b) => a.opensAt.localeCompare(b.opensAt))
  return by('OPEN')[0] ?? by('UPCOMING')[0] ?? drops[0]
}

/**
 * 선착순 쿠폰 받기 버튼과 알림 받기 버튼. 검은 버튼 하나에 쿠폰 금액과 남은 시간을 보여 준다.
 * 진행 중이면 받기 마감까지, 오픈 전이면 오픈까지 남은 시간이다.
 */
export function CouponDropPanel({ drops }: { drops: CouponDrops }) {
  const session = useSession()
  const drop = drops.items.length ? pickDrop(drops.items, drops.now) : null
  return <div className={styles.panel}>
    {drop && <DropButton key={`${session?.memberId ?? 'guest'}:${drop.couponId}`} drop={drop} now={drops.now} member={!!session} onChanged={drops.reload} />}
    {session ? <DropAlert key={session.memberId} hour={drops.hour} />
      : <Link className={styles.alert} to="/login" state={{ from: '/' }}><BellIcon size={18} /> 로그인하고 알림 받기</Link>}
  </div>
}

function DropButton({ drop, now, member, onChanged }: { drop: CouponDrop; now: number; member: boolean; onChanged: () => void }) {
  const api = useApi()
  // 첫 페이지만 본다. 못 찾으면 받기를 눌렀을 때 서버가 "이미 받은 쿠폰"으로 알려 준다.
  const mine = useAsync(async () => member ? (await api.coupons.mine(0)).some(coupon => coupon.couponId === drop.couponId) : false, [api, member, drop.couponId])
  const [received, setReceived] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const lock = useRef(false)
  const state = couponDropState(drop, now)
  const owned = received || mine.data === true
  const amount = `선착순 ${count(drop.fixedDiscount)}원 할인 쿠폰`

  async function claim() {
    if (lock.current) return
    lock.current = true; setBusy(true); setMessage(null)
    try {
      await api.coupons.claim(drop.couponId)
      setReceived(true)
      setMessage({ type: 'success', text: '쿠폰을 받았어요. 내 쿠폰에서 확인하세요.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '쿠폰을 받지 못했어요.' })
    } finally { lock.current = false; setBusy(false); onChanged() }
  }

  const label = <><span className={styles.amount}>{amount}</span>
    {state === 'OPEN' && <span className={styles.timer} role="timer" aria-label={`받기 마감까지 ${countdown(Date.parse(drop.endsAt) - now)}`}>{countdown(Date.parse(drop.endsAt) - now)}</span>}
    {state === 'UPCOMING' && <span className={styles.timer} role="timer" aria-label={`오픈까지 ${countdown(Date.parse(drop.opensAt) - now)}`}>{countdown(Date.parse(drop.opensAt) - now)}</span>}
  </>
  return <>
    {owned ? <button type="button" className={[styles.coupon, styles.done].join(' ')} disabled><span className={styles.amount}>{amount}</span><span className={styles.icon}>받음 <CheckIcon size={18} /></span></button>
      : state === 'UPCOMING' ? <button type="button" className={[styles.coupon, styles.waiting].join(' ')} disabled>{label}<span className={styles.icon}>{kstTime(drop.opensAt)} 오픈</span></button>
      : state !== 'OPEN' ? <button type="button" className={[styles.coupon, styles.done].join(' ')} disabled><span className={styles.amount}>{amount}</span><span className={styles.icon}>마감</span></button>
      : member ? <button type="button" className={styles.coupon} disabled={busy} onClick={() => void claim()}>{label}<span className={styles.icon}>{busy ? '받는 중…' : <DownloadIcon size={20} />}</span></button>
      : <Link className={styles.coupon} to="/login" state={{ from: '/' }} aria-label={`로그인하고 ${amount} 받기`}>{label}<span className={styles.icon}><DownloadIcon size={20} /></span></Link>}
    <p className={styles.detail}>
      {state === 'OPEN' ? <><strong>{count(drop.remaining)}장</strong> 남음 / {count(drop.issuanceLimit)}장, {drop.condition}</>
        : state === 'UPCOMING' ? <>{count(drop.issuanceLimit)}장 한정, {drop.condition}</>
        : <>오늘 쿠폰이 모두 나갔어요. 내일 {kstTime(drop.opensAt)}에 다시 열려요.</>}
    </p>
    {message && <p className={message.type === 'success' ? styles.success : styles.error} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</p>}
  </>
}

/** 매일 오픈 알림 신청. 쿠폰 하나가 아니라 "매일 이 시각"에 대한 알림이다. */
function DropAlert({ hour }: { hour: number | null }) {
  const api = useApi()
  const state = useAsync(() => api.couponDrops.alertState(), [api])
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const current = subscribed ?? state.data
  if (current === undefined) return null

  async function toggle() {
    const next = !current
    setPending(true); setError('')
    try { await api.couponDrops.setAlert(next); setSubscribed(next) }
    catch (e) { setError(e instanceof Error ? e.message : '알림 설정에 실패했어요.') }
    finally { setPending(false) }
  }
  return <>
    <button type="button" className={[styles.alert, current ? styles.alertOn : ''].join(' ')} aria-pressed={current} disabled={pending} onClick={() => void toggle()}>
      <BellIcon size={18} /> {current ? `${hour ?? ''}${hour === null ? '' : '시 '}알림 신청됨` : '알림 받기'}
    </button>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </>
}
