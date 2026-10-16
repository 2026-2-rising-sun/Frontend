import { Alert } from '../../components/ui'
import { refundPending, REFUND_STATUS_LABEL, type RefundSummary } from '../../domain/refunds'
import { formatFullDateTime, formatPrice } from '../../lib/format'
import styles from './refunds.module.css'

export function RefundDetails({ refund }: { refund: RefundSummary }) {
  return <article className={styles.card} aria-label={`환불 ${refund.id}`}>
    <div className={styles.heading}><h3 className="t-h3">{REFUND_STATUS_LABEL[refund.status]}</h3><strong>{formatPrice(refund.refundAmount)}</strong></div>
    <p className={styles.meta}>접수 {formatFullDateTime(refund.requestedAt)}{refund.resolvedAt && ` · 처리 ${formatFullDateTime(refund.resolvedAt)}`}</p>
    {refund.status === 'PROCESSING' && <Alert type="info" title="환불 요청이 접수됐어요">완료되면 환불 상태가 바뀝니다. 처리 중에는 새 환불을 요청할 수 없어요.</Alert>}
    {refund.status === 'UNKNOWN' && <Alert type="warning" title="환불 결과를 확인하고 있어요">환불 실패가 아닙니다. 중복 요청하지 않고 기존 요청의 결과를 확인해 주세요.</Alert>}
    {refund.status === 'FAILED' && <Alert type="warning" title="환불이 완료되지 않았어요">아래 대상과 상태를 확인해 주세요. 다시 요청하면 서버에서 환불 가능 여부를 확인합니다.</Alert>}
    {refundPending(refund) && refund.recovery && <div className={styles.meta}>
      <p>추가 재시도 {refund.recovery.retryCount}회</p>
      {refund.recovery.retryExhausted
        ? <p>자동 재시도 이후에도 기존 요청의 결과를 확인 중이에요. 확정된 결과가 나올 때까지 새 요청을 만들지 않습니다.</p>
        : <p>다음 처리 대상 시각 {formatFullDateTime(refund.recovery.nextActionAt)}. 처리 상황에 따라 늦어질 수 있으며 환불 완료 시각이 아닙니다.</p>}
    </div>}
    <ul className={styles.targets}>{refund.targets.map((target) => <li key={target.orderId}><span>{target.productName} · {target.quantity}개</span><strong>{formatPrice(target.refundAmount)}</strong></li>)}</ul>
    <p className={styles.meta}>확정된 누적 환불액 {formatPrice(refund.cumulativeRefundAmount)}</p>
  </article>
}
