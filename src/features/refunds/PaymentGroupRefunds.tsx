import { useEffect, useRef, useState } from 'react'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { Alert, Button, ResultState, Skeleton } from '../../components/ui'
import { refundPending, remainingRefundAmount } from '../../domain/refunds'
import type { PaymentGroup } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import { useSession } from '../auth/useSession'
import { requestIdentity } from '../commerce/checkoutRecovery'
import { RefundDetails } from './RefundDetails'
import styles from './refunds.module.css'

export function PaymentGroupRefunds({ group, onUpdated }: { group: PaymentGroup; onUpdated: () => void }) {
  const api = useApi()
  const session = useSession()
  const history = useAsync(() => api.refunds.list(group.groupNumber), [api, group.groupNumber])
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const inFlight = useRef(false)
  const pending = history.data?.some(refundPending) ?? false
  const reload = history.reload
  useEffect(() => {
    if (!pending || history.loading) return
    const timer = setTimeout(() => { reload(); onUpdated() }, 3000)
    return () => clearTimeout(timer)
  }, [pending, history.loading, reload, onUpdated])
  const amount = remainingRefundAmount(group.payableAmount, history.data ?? [])
  const fullyRefunded = history.data?.some((refund) => refund.status === 'SUCCESS' && refund.cumulativeRefundAmount >= group.payableAmount) ?? false
  const hasSuccessfulRefund = history.data?.some(refund => refund.status === 'SUCCESS') ?? false
  const canRequest = !hasSuccessfulRefund && !fullyRefunded && group.status === 'PAID' && !!history.data && !history.loading && !history.error && !pending
  async function requestRefund() {
    if (!canRequest || !session || inFlight.current) return
    inFlight.current = true
    setBusy(true); setFailure(''); setMessage('')
    const previousFailures = history.data!.filter((refund) => refund.status === 'FAILED').map((refund) => refund.id).sort()
    const identity = requestIdentity(session.memberId, `full-refund:${group.groupNumber}`, { previousFailures })
    try {
      const result = await api.refunds.requestFull(group.groupNumber, identity.key)
      setMessage(result.status === 'SUCCESS' ? '전체 환불이 완료됐어요.' : result.status === 'FAILED' ? '환불이 완료되지 않았어요. 환불 내역을 확인해 주세요.' : '환불 요청이 접수됐어요. 완료 여부는 환불 내역에서 확인해 주세요.')
      setConfirming(false)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : '환불 요청 결과를 확인하지 못했어요.')
    } finally {
      history.reload(); onUpdated(); inFlight.current = false; setBusy(false)
    }
  }
  return <section className={styles.section} aria-labelledby="refund-heading">
    <div className={styles.heading}><h2 id="refund-heading" className="t-h2">환불</h2><Button variant="secondary" size="S" onClick={reload} disabled={history.loading || busy}>환불 내역 새로고침</Button></div>
    <p>결제 완료 후 168시간이 지나기 전에 전체 환불을 요청해 주세요. 환불 가능 여부와 최종 금액은 서버에서 확인합니다.</p>
    {message && <Alert type="info" title={message} />}
    {failure && <Alert type="warning" title="요청 결과를 확인해 주세요">{failure} 내역을 먼저 확인해 주세요. 다시 요청하면 동일한 요청 키로 확인합니다.</Alert>}
    {history.error && history.data && <Alert type="warning" title="최신 환불 내역을 확인하지 못했어요">다시 조회한 뒤 환불을 요청해 주세요.</Alert>}
    <AsyncView state={history} skeleton={<Skeleton height={150} />}>
      {(refunds) => refunds.length ? <div className={styles.section}>{refunds.map((refund) => <RefundDetails key={refund.id} refund={refund} />)}</div> : <ResultState type="empty" title="환불 내역이 없어요" />}
    </AsyncView>
    {hasSuccessfulRefund && !fullyRefunded && <Alert type="info" title="일부 상품의 환불 이력이 있어요">현재 화면에서는 남은 상품을 선택해 환불할 수 없어요. 환불 내역을 확인해 주세요.</Alert>}
    {canRequest && !confirming && <Button variant="secondary" onClick={() => setConfirming(true)}>전체 환불 요청</Button>}
    {confirming && <div className={styles.card} role="region" aria-label="전체 환불 확인">
      <h3 className="t-h3">이 결제의 상품 전체를 환불할까요?</h3>
      <p>환불 예상 금액 <strong>{formatPrice(amount)}</strong></p>
      <p>대상 상품의 전체 수량을 환불하며, 일부 수량을 선택할 수 없어요. 확정된 환불은 되돌릴 수 없어요.</p>
      <div className={styles.actions}><Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>돌아가기</Button><Button variant="danger" disabled={!canRequest || busy} onClick={() => { void requestRefund() }}>{busy ? '접수 확인 중…' : '확인하고 전체 환불 요청'}</Button></div>
    </div>}
  </section>
}
