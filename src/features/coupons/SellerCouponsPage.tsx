import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { Alert, Button, ButtonLink, Checkbox, Input, ResultState, Skeleton } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import type { CouponSettings, SellerCoupon } from '../../domain/coupons'
import { formatFullDateTime, formatPrice, fromKstInputValue, toKstInputValue } from '../../lib/format'
import styles from './coupons.module.css'
export function SellerCouponsPage() {
  const api = useApi(); const [page, setPage] = useState(0)
  const data = useAsync(() => api.admin.coupons.list(page), [api, page])
  return <div className={styles.stack}><h1 className="t-h1">쿠폰 관리</h1><p>보유 상품의 정액 할인 쿠폰을 만들고 발급 시작 전까지 수정할 수 있어요.</p><ButtonLink to="/admin/coupons/new">쿠폰 만들기</ButtonLink><AsyncView state={data} skeleton={<Skeleton height={180} />}>{result => <>{!result.items.length ? <ResultState type="empty" title="등록한 쿠폰이 없어요" /> : <div className={styles.grid}>{result.items.map(c => <article key={c.id} className={styles.card}><h2 className="t-h4">{c.name}</h2><strong>{formatPrice(c.fixedDiscount)} 할인</strong><p>{c.issuedCount.toLocaleString()} / {c.issuanceLimit.toLocaleString()}장 발급</p><p className={styles.muted}>발급 {formatFullDateTime(c.startsAt)} ~ {formatFullDateTime(c.endsAt)}</p><p className={styles.muted}>사용 기한 {formatFullDateTime(c.expiresAt)}</p><ButtonLink variant="secondary" to={`/admin/coupons/${encodeURIComponent(c.id)}`}>설정 보기</ButtonLink></article>)}</div>}<div className={styles.actions}><Button variant="secondary" disabled={!page || data.loading} onClick={() => setPage(p => p - 1)}>이전</Button><span>{page + 1} 페이지</span><Button variant="secondary" disabled={data.loading || (page + 1) * result.size >= result.totalElements} onClick={() => setPage(p => p + 1)}>다음</Button></div></>}</AsyncView></div>
}
export function SellerCouponEditPage() {
  const { id } = useParams(); const api = useApi()
  const data = useAsync(() => id ? api.admin.coupons.get(id) : Promise.resolve(null), [api, id])
  return <div className={styles.stack}><ButtonLink to="/admin/coupons" variant="secondary">쿠폰 목록</ButtonLink><h1 className="t-h1">{id ? '쿠폰 설정' : '쿠폰 만들기'}</h1><AsyncView state={data} skeleton={<Skeleton height={300} />}>{coupon => <SellerCouponForm key={`${coupon?.id ?? 'new'}:${coupon?.version ?? 0}`} coupon={coupon} refresh={data.reload} />}</AsyncView></div>
}
function SellerCouponForm({ coupon, refresh }: { coupon: SellerCoupon | null; refresh: () => void }) {
  const api = useApi(); const navigate = useNavigate(); const [locked] = useState(() => !!coupon && Date.parse(coupon.startsAt) <= Date.now())
  const [name, setName] = useState(coupon?.name ?? ''); const [discount, setDiscount] = useState(String(coupon?.fixedDiscount ?? '')); const [limit, setLimit] = useState(String(coupon?.issuanceLimit ?? ''))
  const [start, setStart] = useState(coupon ? toKstInputValue(coupon.startsAt) : ''); const [end, setEnd] = useState(coupon ? toKstInputValue(coupon.endsAt) : ''); const [expiry, setExpiry] = useState(coupon ? toKstInputValue(coupon.expiresAt) : '')
  const [selected, setSelected] = useState<number[]>(coupon?.productIds ?? []); const [page, setPage] = useState(0)
  const products = useAsync(() => api.admin.products.list({ page, size: 20 }), [api, page])
  const [busy, setBusy] = useState(false); const inFlight = useRef(false); const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); if (inFlight.current || locked) return; setError('')
    const fixedDiscount = Number(discount); const issuanceLimit = Number(limit)
    if (!name.trim() || !Number.isSafeInteger(fixedDiscount) || fixedDiscount < 1 || !Number.isSafeInteger(issuanceLimit) || issuanceLimit < 1 || issuanceLimit > 10000 || !selected.length || !start || !end || !expiry) { setError('쿠폰명·양의 정수 할인액·1~10,000장 수량·기간·대상 상품을 확인해 주세요.'); return }
    const time = (value: string, original?: string) => original && toKstInputValue(original) === value ? original : fromKstInputValue(value)
    const startsAt = time(start, coupon?.startsAt); const endsAt = time(end, coupon?.endsAt); const expiresAt = time(expiry, coupon?.expiresAt)
    if (Date.parse(endsAt) <= Date.parse(startsAt) || Date.parse(endsAt) - Date.parse(startsAt) > 720 * 3600000 || Date.parse(expiresAt) < Date.parse(endsAt)) { setError('발급 기간은 시작 후 최대 720시간이며 사용 기한은 발급 종료 이후여야 해요.'); return }
    const settings: CouponSettings = { name: name.trim(), fixedDiscount, issuanceLimit, startsAt, endsAt, expiresAt, productIds: selected }
    inFlight.current = true; setBusy(true)
    try { const result = coupon ? await api.admin.coupons.update(coupon.id, coupon.version, settings) : await api.admin.coupons.create(settings); if (coupon) refresh(); else navigate(`/admin/coupons/${encodeURIComponent(result.id)}`, { replace: true }) } catch (e) { setError(e instanceof Error ? e.message : '쿠폰을 저장하지 못했어요. 목록에서 저장 여부를 확인해 주세요.') } finally { inFlight.current = false; setBusy(false) }
  }
  return <form className={styles.stack} onSubmit={submit}>{locked && <Alert type="info" title="발급이 시작된 쿠폰이에요">시작 이후에는 설정을 변경할 수 없어요.</Alert>}{error && <Alert type="danger" title="쿠폰 설정을 확인해 주세요">{error}<Button onClick={refresh} variant="secondary">서버 설정 다시 조회</Button><p>생성 결과를 받지 못했다면 목록에서 등록 여부를 먼저 확인해 주세요.</p></Alert>}
    <fieldset disabled={locked || busy} className={styles.card}><legend>쿠폰 정보</legend><Input label="쿠폰명" value={name} onChange={e => setName(e.target.value)} required maxLength={100} /><Input label="정액 할인 금액 (원)" type="number" min={1} step={1} value={discount} onChange={e => setDiscount(e.target.value)} required /><Input label="발급 수량 (장)" type="number" min={1} max={10000} step={1} value={limit} onChange={e => setLimit(e.target.value)} required /><Input label="발급 시작 (한국 시간)" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required /><Input label="발급 종료 (한국 시간)" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} required /><Input label="쿠폰 사용 기한 (한국 시간)" type="datetime-local" value={expiry} onChange={e => setExpiry(e.target.value)} required /></fieldset>
    <section className={styles.card}><h2 className="t-h4">대상 상품 {selected.length}개</h2><p className={styles.muted}>선택은 다른 페이지로 이동해도 유지돼요. 선택한 상품 수를 확인한 뒤 저장해 주세요.</p>{products.error && <Alert type="warning" title="상품 목록을 확인하지 못했어요"><Button onClick={products.reload}>다시 조회</Button></Alert>}{products.data?.items.map(p => <Checkbox key={p.id} label={p.name} checked={selected.includes(Number(p.id))} disabled={locked || busy || products.loading} onChange={e => setSelected(ids => e.target.checked ? [...ids, Number(p.id)] : ids.filter(id => id !== Number(p.id)))} />)}{!products.loading && !products.data?.items.length && <p>등록한 상품이 없어요. 상품 관리에서 먼저 등록해 주세요.</p>}<div className={styles.actions}><Button variant="secondary" disabled={products.loading || !page} onClick={() => setPage(p => p - 1)}>이전 상품</Button><span>{page + 1} 페이지</span><Button variant="secondary" disabled={products.loading || !products.data?.hasNext} onClick={() => setPage(p => p + 1)}>다음 상품</Button></div></section>
    <Button type="submit" disabled={locked || busy}>{busy ? '저장 중…' : '쿠폰 저장'}</Button>
  </form>
}
