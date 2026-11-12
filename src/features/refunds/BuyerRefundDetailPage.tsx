import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, Skeleton } from '../../components/ui'
import { refundPending } from '../../domain/refunds'
import { useAsync } from '../../hooks/useAsync'
import { useSession } from '../auth/useSession'
import { RefundDetails } from './RefundDetails'
import styles from './refunds.module.css'

export function BuyerRefundDetailPage() {
  const { groupNumber = '', refundId = '' } = useParams()
  const session = useSession()
  return <BuyerRefundDetail key={`${session?.memberId}:${groupNumber}:${refundId}`} groupNumber={groupNumber} refundId={refundId} />
}

function BuyerRefundDetail({ groupNumber, refundId }: { groupNumber: string; refundId: string }) {
  const api = useApi()
  const refund = useAsync(() => api.refunds.get(groupNumber, refundId), [api, groupNumber, refundId])
  const pending = refund.data ? refundPending(refund.data) : false
  const reload = refund.reload
  useEffect(() => {
    if (!pending || refund.loading) return
    const timer = setTimeout(reload, 3000)
    return () => clearTimeout(timer)
  }, [pending, refund.loading, reload])
  return <PageContainer narrow><section className={styles.section}>
    <Link to={`/payment-groups/${encodeURIComponent(groupNumber)}`}>← 결제·환불 내역</Link>
    <h1 className="t-h1">환불 상세</h1>
    <p className={styles.meta}>결제 묶음 {groupNumber} · 환불 번호 {refundId}</p>
    {refund.error && refund.data && <Alert type="warning" title="최신 환불 상태를 확인하지 못했어요">마지막으로 확인한 결과입니다. 다시 조회해 주세요.</Alert>}
    <Button variant="secondary" onClick={reload} disabled={refund.loading}>상태 새로고침</Button>
    <AsyncView state={refund} skeleton={<Skeleton height={240} />}>{value => <RefundDetails refund={value} />}</AsyncView>
  </section></PageContainer>
}
