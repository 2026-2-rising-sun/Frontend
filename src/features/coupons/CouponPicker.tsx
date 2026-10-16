import { useState } from 'react'
import { useApi } from '../../app/apiContext'
import { useAsync } from '../../hooks/useAsync'
import { Alert, Button, Select } from '../../components/ui'
import { formatPrice } from '../../lib/format'
import styles from './coupons.module.css'
export function CouponPicker({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const api = useApi(); const [page, setPage] = useState(0)
  const coupons = useAsync(() => api.coupons.mine(page), [api, page])
  const usable = coupons.data?.filter(c => c.status === 'AVAILABLE') ?? []
  return <section className={styles.stack}><h2 className="t-h4">쿠폰 적용</h2>
    <Select aria-label="사용할 보유 쿠폰" value={value} onChange={onChange} disabled={disabled || coupons.loading}
      options={[{ value: '', label: '쿠폰 사용 안 함' }, ...usable.map(c => ({ value: c.couponId, label: `${c.name} · ${formatPrice(c.fixedDiscount)} 할인` })), ...(value && !usable.some(c => c.couponId === value) ? [{ value, label: '선택한 쿠폰' }] : [])]} />
    <p className={styles.muted}>적용 가능 여부와 최종 할인액은 서버에서 확인해요.</p>
    {coupons.error && <Alert type="warning" title="보유 쿠폰을 불러오지 못했어요"><Button onClick={coupons.reload}>다시 조회</Button></Alert>}
    <div className={styles.actions}><Button size="S" variant="secondary" disabled={disabled || coupons.loading || page === 0} onClick={() => setPage(p => p - 1)}>이전 쿠폰</Button><span>{page + 1} 페이지</span><Button size="S" variant="secondary" disabled={disabled || coupons.loading || !coupons.data || coupons.data.length < 20} onClick={() => setPage(p => p + 1)}>다음 쿠폰</Button></div>
  </section>
}
