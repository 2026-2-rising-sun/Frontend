import { useEffect } from 'react'
import { useApi } from '../../app/apiContext'
import { useAsync } from '../../hooks/useAsync'
import { Alert, Button, Select } from '../../components/ui'
import { formatPrice } from '../../lib/format'
import styles from './coupons.module.css'
import { applicableCoupons } from './applicableCoupons'
export function CouponPicker({ value, onChange, disabled, canApply }: { value: string; onChange: (id: string) => void; disabled?: boolean; canApply: (couponId: string) => Promise<boolean> }) {
  const api = useApi()
  const coupons = useAsync(async () => ({ canApply, items: await applicableCoupons(api.coupons.mine, canApply) }), [api, canApply])
  const current = coupons.data?.canApply === canApply && !coupons.loading && !coupons.error
  const usable = current ? coupons.data!.items : []
  useEffect(() => {
    if (current && value && !coupons.data!.items.some(c => c.couponId === value)) onChange('')
  }, [current, coupons.data, value, onChange])
  return <section className={styles.stack}><h2 className="t-h4">쿠폰 적용</h2>
    <Select aria-label="사용할 보유 쿠폰" value={usable.some(c => c.couponId === value) ? value : ''} onChange={onChange} disabled={disabled || !current}
      options={[{ value: '', label: '쿠폰 사용 안 함' }, ...usable.map(c => ({ value: c.couponId, label: `${c.name} · ${formatPrice(c.fixedDiscount)} 할인` }))]} />
    <p className={styles.muted}>{!current && !coupons.error ? '적용 가능한 쿠폰을 확인하고 있어요.' : current && !usable.length ? '이 주문에 적용 가능한 보유 쿠폰이 없어요.' : '이 주문에 적용 가능한 보유 쿠폰만 표시해요. 최종 할인액은 주문 시 다시 확인해요.'}</p>
    {coupons.error && <Alert type="warning" title="적용 가능한 쿠폰을 확인하지 못했어요"><Button onClick={coupons.reload}>다시 조회</Button></Alert>}
  </section>
}
