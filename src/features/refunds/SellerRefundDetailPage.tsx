import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { Alert, Button, Skeleton } from '../../components/ui'
import { refundPending } from '../../domain/refunds'
import { useAsync } from '../../hooks/useAsync'
import { RefundDetails } from './RefundDetails'
import styles from './refunds.module.css'

export function SellerRefundDetailPage() {
  const { refundId = '' } = useParams()
  return <SellerRefundDetail key={refundId} refundId={refundId} />
}

function SellerRefundDetail({ refundId }: { refundId: string }) {
  const api = useApi()
  const refund = useAsync(() => api.refunds.getSeller(refundId), [api, refundId])
  const pending = refund.data ? refundPending(refund.data) : false
  const reload = refund.reload
  useEffect(() => {
    if (!pending || refund.loading) return
    const timer = setTimeout(reload, 3000)
    return () => clearTimeout(timer)
  }, [pending, refund.loading, reload])
  return <section className={styles.section}>
    <Link to="/seller/refunds">← 환불 목록</Link><h1 className="t-h1">환불 상세</h1>
    {refund.error && refund.data && <Alert type="warning" title="최신 환불 상태를 확인하지 못했어요" />}
    <Button variant="secondary" onClick={reload} disabled={refund.loading}>상태 새로고침</Button>
    <AsyncView state={refund} skeleton={<Skeleton height={240} />}>{(value) => <RefundDetails refund={value} />}</AsyncView>
  </section>
}
