import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, ButtonLink, ResultState, Skeleton, StatusBadge, orderBadge } from '../../components/ui'
import { ApiError } from '../../domain/errors'
import type { Order } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { formatRemaining, useCountdown } from '../../hooks/useCountdown'
import { formatFullDateTime } from '../../lib/format'
import { OrderSummary } from './components/OrderSummary'
import styles from './OrderResultPage.module.css'

/** 결과가 확정되지 않은 동안(결제 확인 중) 결과를 다시 확인하는 주기 */
const POLL_INTERVAL_MS = 2000

export function OrderResultPage() {
  const { orderNumber = '' } = useParams()
  const api = useApi(); const location = useLocation()
  const paymentId = (location.state as { paymentId?: string } | null)?.paymentId
  const payment = useAsync(() => paymentId ? api.payments.get(orderNumber, paymentId) : Promise.resolve(null), [api, orderNumber, paymentId])
  const order = useAsync(() => api.orders.lookup(orderNumber), [api, orderNumber])

  const confirming = order.data?.status === 'CONFIRMING' || order.data?.status === 'UNPAID'
  const reloadOrder = order.reload; const reloadPayment = payment.reload
  const reload = () => { reloadOrder(); if (paymentId) reloadPayment() }
  useEffect(() => {
    if (!confirming) return
    const timer = setInterval(() => { reloadOrder(); if (paymentId) reloadPayment() }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [confirming, reloadOrder, reloadPayment, paymentId])

  return (
    <PageContainer narrow>
      <h1 className="t-h1">주문 결과</h1>
      {payment.error && <Alert type="warning" title="결제 시도 조회가 지연되고 있어요">주문 상태를 다시 확인하고 있어요.</Alert>}
      <AsyncView state={order} skeleton={<Skeleton height={320} radius={14} />}>
        {(o) => <OrderResult order={o} onChanged={reload} />}
      </AsyncView>
    </PageContainer>
  )
}

function OrderResult({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const api = useApi()
  const [busy, setBusy] = useState<'pay' | 'cancel' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // 결제 전 주문에 기한이 있으면 남은 시간을 보여주고, 0 이 되면 서버 결과(만료 취소)를 다시 확인한다.
  const remaining = useCountdown(order.status === 'UNPAID' ? order.expiresAt : null, onChanged)

  const run = async (kind: 'pay' | 'cancel') => {
    if (busy) return
    setBusy(kind)
    setActionError(null)
    try {
      if (kind === 'pay') await api.payments.start(order.orderNumber)
      else await api.orders.cancel(order.orderNumber)
      onChanged()
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : '요청을 처리하지 못했어요.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <StatusAlert order={order} remaining={remaining} />
      {order.status === 'CONFIRMING' && (
        <ResultState
          type="processing"
          title="결제 결과를 확인하고 있어요"
          message="화면을 닫아도 주문 조회에서 결과를 확인할 수 있어요."
          action={
            <Button variant="secondary" onClick={onChanged}>
              결과 다시 확인
            </Button>
          }
        />
      )}
      {actionError && (
        <Alert type="danger" title="처리하지 못했어요">
          {actionError}
        </Alert>
      )}

      <div className={styles.meta}>
        <StatusBadge status={orderBadge(order.status)} />
        <span className={styles.number}>주문번호 {order.orderNumber}</span>
      </div>

      <OrderSummary productName={order.productName} unitPrice={order.unitPrice} quantity={order.quantity} />

      <dl className={styles.details}>
        <div>
          <dt>주문자</dt>
          <dd>{order.ordererName}</dd>
        </div>
        <div>
          <dt>주문 일시</dt>
          <dd>{formatFullDateTime(order.orderedAt)}</dd>
        </div>
      </dl>

      <div className={styles.actions}>
        {order.status === 'UNPAID' && (
          <>
            <Button size="L" fullWidth onClick={() => run('pay')} disabled={busy !== null}>
              {busy === 'pay' ? '처리 중…' : '결제하기'}
            </Button>
            <Button size="L" variant="secondary" fullWidth onClick={() => run('cancel')} disabled={busy !== null}>
              {busy === 'cancel' ? '취소 중…' : '주문 취소'}
            </Button>
          </>
        )}
        {(order.status === 'FAILED' || order.status === 'CANCELED') && (
          <ButtonLink size="L" fullWidth to="/">
            상품 다시 찾기
          </ButtonLink>
        )}
        {order.status === 'PAID' && (
          <ButtonLink size="L" fullWidth to="/">
            쇼핑 계속하기
          </ButtonLink>
        )}
        {order.status !== 'PAID' && (
          <ButtonLink size="L" variant="secondary" fullWidth to="/">
            쇼핑 계속하기
          </ButtonLink>
        )}
      </div>
      <Link to="/orders/lookup" className={styles.lookup}>
        내 주문 목록
      </Link>
    </>
  )
}

function StatusAlert({ order, remaining }: { order: Order; remaining: number | null }) {
  switch (order.status) {
    case 'PAID':
      return (
        <Alert type="success" title="결제가 완료되었어요">
          주문 내역에서 결제 결과를 확인할 수 있어요.
        </Alert>
      )
    case 'FAILED':
      return (
        <Alert type="danger" title="결제에 실패했어요">
          재고는 복구되었습니다. 이 주문은 다시 결제할 수 없으니 상품 다시 찾기해 주세요.
        </Alert>
      )
    case 'CANCELED':
      return order.cancelReason === 'EXPIRED' ? (
        <Alert type="warning" title="결제 기한이 지나 주문이 취소되었어요">
          결제를 시작하지 않아 자동 취소되었고, 확보했던 재고는 복구되었습니다. 다시 구매하려면 새 주문을 만들어 주세요.
        </Alert>
      ) : (
        <Alert type="info" title="주문이 취소되었어요">
          확보했던 재고는 복구되었습니다.
        </Alert>
      )
    case 'CONFIRMING':
      return (
        <Alert type="info" title="재고는 유지되고 있어요">
          결과가 확정되기 전에는 새로 결제하거나 재고를 되돌리지 않습니다.
        </Alert>
      )
    default:
      return (
        <Alert type="warning" title="아직 결제가 시작되지 않았어요">
          결제하기를 누르면 결제를 요청해요. 결제 전 주문은 취소할 수 있어요.
          {order.expiresAt && remaining !== null && (
            <>
              <br />
              결제 가능 시간 <strong>{formatRemaining(remaining)}</strong> 남음 ({formatFullDateTime(order.expiresAt)}까지). 기한이 지나면 자동 취소돼요.
            </>
          )}
        </Alert>
      )
  }
}
