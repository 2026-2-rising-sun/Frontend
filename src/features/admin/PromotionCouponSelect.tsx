import { useState } from 'react'
import { useApi } from '../../app/apiContext'
import { Alert, Button, Select } from '../../components/ui'
import type { SellerCoupon } from '../../domain/coupons'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import styles from '../live/promotions.module.css'

export function PromotionCouponSelect({ selected, onSelect, disabled }: { selected: SellerCoupon | null; onSelect: (coupon: SellerCoupon | null) => void; disabled: boolean }) {
  const [page, setPage] = useState(0)
  return <CouponOptions key={page} page={page} selected={selected} onSelect={onSelect} disabled={disabled} onPage={setPage} />
}
function CouponOptions({ page, selected, onSelect, disabled, onPage }: {
  page: number; selected: SellerCoupon | null; onSelect: (coupon: SellerCoupon | null) => void; disabled: boolean; onPage: (page: number) => void
}) {
  const api = useApi()
  const coupons = useAsync(() => api.admin.coupons.list(page), [api, page])
  const items = coupons.data?.items ?? []
  const options = items.map(coupon => ({ value: String(coupon.id), label: `${coupon.name} · ${formatPrice(coupon.fixedDiscount)} 할인` }))
  if (selected && !items.some(coupon => String(coupon.id) === String(selected.id))) options.unshift({ value: String(selected.id), label: `${selected.name} (선택됨)` })
  return <div className={styles.list}>
    <Select aria-label="이벤트 쿠폰" value={selected ? String(selected.id) : ''} options={[{ value: '', label: '연결할 쿠폰을 선택해 주세요' }, ...options]} disabled={disabled || coupons.loading || !!coupons.error} onChange={id => onSelect(items.find(coupon => String(coupon.id) === id) ?? null)} />
    {coupons.loading && <p role="status">쿠폰을 불러오고 있어요.</p>}
    {coupons.error && <Alert type="warning" title="쿠폰을 불러오지 못했어요"><Button type="button" variant="secondary" onClick={coupons.reload}>다시 조회</Button></Alert>}
    {!coupons.loading && !coupons.error && !items.length && <p>이 페이지에 등록된 쿠폰이 없어요. 쿠폰 관리에서 먼저 준비해 주세요.</p>}
    <div className={styles.row}><Button type="button" size="S" variant="secondary" disabled={disabled || coupons.loading || !page} onClick={() => onPage(page - 1)}>이전 쿠폰</Button><span>{page + 1} 페이지</span><Button type="button" size="S" variant="secondary" disabled={disabled || coupons.loading || !!coupons.error || !coupons.data || (page + 1) * coupons.data.size >= coupons.data.totalElements} onClick={() => onPage(page + 1)}>다음 쿠폰</Button></div>
    <p className={styles.meta}>발급 기간·수량·대상 상품은 기존 쿠폰 정책을 따릅니다. 방송 이벤트를 종료해도 쿠폰 정책은 바뀌지 않아요.</p>
  </div>
}
