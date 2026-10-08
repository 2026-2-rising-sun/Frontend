import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, ButtonLink, Skeleton, StatusBadge, orderBadge } from '../../components/ui'
import type { PaymentGroup } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { formatRemaining, useCountdown } from '../../hooks/useCountdown'
import { useSession } from '../auth/useSession'
import { formatPrice } from '../../lib/format'
import { OrderSummary } from './components/OrderSummary'
import { requestIdentity } from './checkoutRecovery'
import styles from './OrderResultPage.module.css'
export function PaymentGroupPage() {
  const { groupNumber = '' } = useParams(); const session = useSession()
  return <PaymentGroupScope key={`${session?.memberId}:${groupNumber}`} groupNumber={groupNumber} />
}
function PaymentGroupScope({ groupNumber }: { groupNumber: string }) {
  const api = useApi()
  const group = useAsync(() => api.paymentGroups.get(groupNumber), [api, groupNumber])
  const reload = group.reload
  const pending = group.data?.status === 'PENDING_PAYMENT' || group.data?.status === 'PAYMENT_CONFIRMING'
  useEffect(() => { if (!pending) return; const timer = setInterval(reload, 2000); return () => clearInterval(timer) }, [pending, reload])
  return <PageContainer narrow><h1 className="t-h1">통합 결제</h1>
    {group.error && group.data && <Alert type="warning" title="최신 결제 결과를 확인하지 못했어요">{group.error.message}<Button onClick={reload}>결과 다시 확인</Button></Alert>}
    <AsyncView state={group} skeleton={<Skeleton height={320} />}>{value => <GroupResult key={value.groupNumber} group={value} reload={reload} />}</AsyncView>
  </PageContainer>
}
function GroupResult({ group, reload }: { group: PaymentGroup; reload: () => void }) {
  const api = useApi(); const session = useSession()
  const [busy, setBusy] = useState(false); const [failure, setFailure] = useState<{ status: PaymentGroup['status']; message: string } | null>(null); const inFlight = useRef(false)
  const paymentKey = useRef<string | null>(null)
  const error = failure?.status === group.status ? failure.message : ''
  const remaining = useCountdown(group.status === 'PENDING_PAYMENT' ? group.expiresAt : null, reload)
  const paying = group.status === 'PAYMENT_CONFIRMING'
  async function run(action: 'pay' | 'cancel') {
    if (inFlight.current || !session) return
    inFlight.current = true; setBusy(true); setFailure(null)
    try {
      if (action === 'cancel') await api.paymentGroups.cancel(group.groupNumber)
      else {
        paymentKey.current ??= requestIdentity(session.memberId, `payment:${group.groupNumber}`, {}).key
        await api.paymentGroups.start(group.groupNumber, paymentKey.current)
      }
    } catch (cause) { setFailure({ status: group.status, message: cause instanceof Error ? cause.message : '결제 결과를 확인해 주세요.' }) }
    finally { reload(); inFlight.current = false; setBusy(false) }
  }
  const title = { PENDING_PAYMENT: '결제를 진행해 주세요', PAYMENT_CONFIRMING: '결제 결과를 확인하고 있어요', PAID: '통합 결제가 완료되었어요', FAILED: '결제에 실패했어요', CANCELLED: '주문이 취소되었어요', EXPIRED: '결제 기한이 지났어요' }[group.status]
  return <><Alert type={group.status === 'PAID' ? 'success' : group.status === 'FAILED' ? 'danger' : 'info'} title={title}>
    {paying ? '결과가 확정되기 전에는 새 결제를 만들지 않습니다. 화면을 다시 열어도 결과를 확인할 수 있어요.' : group.status === 'PENDING_PAYMENT' ? '상품별 주문을 하나의 결제로 처리합니다.' : group.status !== 'PAID' ? '확보한 재고는 복구됩니다. 다시 구매하려면 장바구니에서 새 주문을 만들어 주세요.' : '상품별 주문 내역을 아래에서 확인해 주세요.'}
    {remaining !== null && <p>결제 가능 시간 {formatRemaining(remaining)}</p>}
  </Alert>{error && <Alert type="warning" title="요청 결과를 다시 확인해 주세요">{error}<Button onClick={reload}>결과 다시 확인</Button></Alert>}
    <p className={styles.groupNumber}>결제 묶음 {group.groupNumber}</p><strong className="t-price-lg">총 {formatPrice(group.totalAmount)}</strong>
    {group.orders.map(order => <section key={order.orderNumber}><div className={styles.meta}><StatusBadge status={orderBadge(order.status)} /><Link to={`/orders/${encodeURIComponent(order.orderNumber)}`}>주문 {order.orderNumber}</Link></div><OrderSummary productName={order.productName} unitPrice={order.unitPrice} quantity={order.quantity} /></section>)}
    <div className={styles.actions}>{group.status === 'PENDING_PAYMENT' && <><Button fullWidth size="L" onClick={() => { void run('pay') }} disabled={busy || remaining === 0}>{busy ? '처리 중…' : '통합 결제하기'}</Button><Button fullWidth variant="secondary" onClick={() => { void run('cancel') }} disabled={busy}>전체 주문 취소</Button></>}
      {paying && <Button variant="secondary" onClick={reload}>결과 다시 확인</Button>}<ButtonLink variant="secondary" to="/cart">장바구니</ButtonLink><ButtonLink to="/orders/lookup">내 주문 목록</ButtonLink>
    </div></>
}
