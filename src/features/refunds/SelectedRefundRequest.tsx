import { useRef, useState } from 'react'
import { useApi } from '../../app/apiContext'
import { Alert, Button, Checkbox, Skeleton } from '../../components/ui'
import { AsyncView } from '../../components/AsyncView'
import type { Refund, RefundableTarget } from '../../domain/refunds'
import { refundPending } from '../../domain/refunds'
import { useAsync, type AsyncState } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import { useSession } from '../auth/useSession'
import { requestIdentity } from '../commerce/checkoutRecovery'
import styles from './refunds.module.css'

const unavailable: Record<NonNullable<RefundableTarget['unavailableReason']>, string> = {
  PAYMENT_NOT_COMPLETED: '결제가 완료된 주문만 환불할 수 있어요.',
  REFUND_WINDOW_EXPIRED: '환불 접수 가능 기간이 지났어요.',
  ALREADY_REQUESTED: '이미 환불을 요청했거나 완료한 상품이에요.',
  CART_ITEM_UNAVAILABLE: '이 주문은 선택 환불을 지원하지 않아요. 전체 환불 가능 여부를 확인해 주세요.',
  CART_ITEM_AMBIGUOUS: '주문 연결을 확인할 수 없어 선택 환불할 수 없어요.',
}
export function SelectedRefundRequest({ groupNumber, history, onUpdated }: {
  groupNumber: string; history: AsyncState<Refund[]>; onUpdated: () => void
}) {
  const api = useApi()
  const session = useSession()
  const targets = useAsync(() => api.refunds.targets(groupNumber), [api, groupNumber, history.updatedAt])
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const inFlight = useRef(false)
  const selection = (targets.data ?? []).filter(target => target.refundable && target.cartItemId !== null && selected.includes(target.cartItemId))
  const amount = selection.reduce((sum, target) => sum + target.refundAmount, 0)
  const ready = !!history.data && !history.loading && !history.error && !history.data.some(refundPending) && !!targets.data && !targets.loading && !targets.error && !busy
  const reload = () => { targets.reload(); history.reload() }
  async function submit() {
    if (!ready || !selection.length || !session || inFlight.current) return
    inFlight.current = true; setBusy(true); setFailure(''); setMessage('')
    const cartItemIds = selection.map(target => target.cartItemId!).sort()
    const previousFailures = history.data!.filter(refund => refund.status === 'FAILED').map(refund => refund.id).sort()
    const identity = requestIdentity(session.memberId, `selected-refund:${groupNumber}`, { cartItemIds, previousFailures })
    try {
      await api.refunds.requestSelected(groupNumber, cartItemIds, identity.key)
      setMessage('선택 상품 환불이 접수됐어요. 결과는 환불 내역에서 확인해 주세요.')
      setSelected([]); setConfirming(false)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : '환불 요청 결과를 확인하지 못했어요.')
    } finally {
      reload(); onUpdated(); inFlight.current = false; setBusy(false)
    }
  }
  return <div className={styles.card}>
    <div className={styles.heading}><h3 className="t-h3">상품 선택 환불</h3><Button variant="secondary" size="S" disabled={busy || targets.loading || history.loading} onClick={reload}>환불 대상 새로고침</Button></div>
    <p>선택한 상품의 전체 수량을 환불합니다. 일부 수량은 선택할 수 없어요.</p>
    {history.data?.some(refundPending) && <Alert type="info" title="진행 중인 환불 결과를 확인하고 있어요">처리가 끝나면 남은 상품을 요청할 수 있어요.</Alert>}
    {targets.error && <Alert type="warning" title="환불 대상을 확인하지 못했어요">다시 조회한 뒤 선택해 주세요.</Alert>}
    {message && <Alert type="info" title={message} />}
    {failure && <Alert type="warning" title="환불 요청 결과를 확인해 주세요">{failure} 환불 내역을 먼저 확인해 주세요. 같은 상품을 다시 요청하면 동일한 요청 키를 사용합니다.</Alert>}
    <AsyncView state={targets} skeleton={<Skeleton height={120} />}>
      {items => <ul className={styles.targets}>{items.map(target => <li key={target.orderId}>
        <div><Checkbox label={`${target.productName} · ${target.quantity}개`} checked={selection.some(item => item.orderId === target.orderId)} disabled={!ready || !target.refundable || target.cartItemId === null} onChange={event => { setConfirming(false); const id = target.cartItemId!; setSelected(old => event.target.checked ? [...old.filter(value => value !== id), id] : old.filter(value => value !== id)) }} />
          {!target.refundable && <p className={styles.meta}>{target.unavailableReason ? unavailable[target.unavailableReason] : '환불할 수 없는 상품이에요.'}</p>}</div><strong>{formatPrice(target.refundAmount)}</strong>
      </li>)}</ul>}
    </AsyncView>
    <p>선택 상품 환불 예상 금액 <strong>{formatPrice(amount)}</strong></p>
    {!confirming ? <Button variant="secondary" disabled={!ready || !selection.length} onClick={() => setConfirming(true)}>선택 상품 환불 요청</Button> : <div role="region" aria-label="선택 상품 환불 확인">
      <p>선택한 {selection.length}개 상품의 전체 수량을 환불할까요? 확정된 환불은 되돌릴 수 없어요. 최종 가능 여부와 금액은 서버에서 확인합니다.</p>
      <div className={styles.actions}><Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>선택으로 돌아가기</Button><Button variant="danger" disabled={!ready || !selection.length} onClick={() => { void submit() }}>{busy ? '접수 확인 중…' : '확인하고 선택 상품 환불 요청'}</Button></div>
    </div>}
  </div>
}
