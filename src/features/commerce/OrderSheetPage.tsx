import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, ButtonLink } from '../../components/ui'
import { formatRemaining, useCountdown } from '../../hooks/useCountdown'
import { formatPrice } from '../../lib/format'
import { needsSheetRefresh, sheetMessage, type SheetView } from '../../domain/orderSheets'
import { useSession } from '../auth/useSession'
import { PaymentAuthenticationContext } from './PaymentAuthenticationContext'
import { requestIdentity } from './checkoutRecovery'
import { rememberSheet, savedApproval, saveApproval } from './sheetRecovery'
import { OrderSummary } from './components/OrderSummary'
export function OrderSheetPage() {
  const { orderNumber = '' } = useParams(); const session = useSession()
  return <SheetScope key={`${session?.memberId}:${orderNumber}`} number={orderNumber} />
}
function SheetScope({ number }: { number: string }) {
  const api = useApi(); const session = useSession(); const authentication = useContext(PaymentAuthenticationContext)
  const [view, setView] = useState<SheetView | null>(null); const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false); const [round, setRound] = useState(0); const [paused, setPaused] = useState(false)
  const inFlight = useRef(false); const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const reload = useCallback(() => { setPaused(false); setRound(n => n + 1) }, [])
  useEffect(() => {
    let disposed = false; let timer: ReturnType<typeof setTimeout> | undefined; let attempts = 0
    async function load() {
      try {
        const next = await api.orderSheets.get(number)
        if (disposed) return
        setView(next); setLoadError('')
        if (session) {
          rememberSheet(session.memberId, number)
          if (!['PENDING', 'PROCESSING'].includes(next.payment.orderStatus)) {
            const saved = savedApproval(session.memberId, number)
            if (saved) requestIdentity(session.memberId, `sheet-approval:${number}`, saved).clear()
            saveApproval(session.memberId, number, null)
          }
        }
        if (!needsSheetRefresh(next.payment)) return
      } catch (cause) {
        if (disposed) return
        setLoadError(cause instanceof Error ? cause.message : '최신 상태를 확인하지 못했어요.')
      }
      if (++attempts < 30) timer = setTimeout(() => { void load() }, 2000)
      else setPaused(true)
    }
    void load()
    return () => { disposed = true; if (timer) clearTimeout(timer) }
  }, [api, number, session, round])
  const remaining = useCountdown(view?.payment.orderStatus === 'PENDING' ? view.payment.expiresAt : view?.payment.orderStatus === 'PROCESSING' ? view.payment.processingExpiresAt : null, reload)
  async function run(action: 'authenticate' | 'retry' | 'prepare' | 'cancel') {
    if (inFlight.current || !session || !view) return
    inFlight.current = true; setBusy(true); setError('')
    try {
      if (action === 'cancel') {
        await api.orderSheets.cancel(number)
        const saved = savedApproval(session.memberId, number)
        if (saved) requestIdentity(session.memberId, `sheet-approval:${number}`, saved).clear()
        saveApproval(session.memberId, number, null); return
      }
      if (action === 'prepare') { await api.orderSheets.prepare(number); return }
      let result = savedApproval(session.memberId, number)
      if (action === 'authenticate') {
        if (!authentication) throw new Error('결제 인증 설정이 준비되지 않았어요. 주문 기한 안에 다시 확인해 주세요.')
        const ready = await api.orderSheets.checkout(number)
        if (ready.orderStatus !== 'PENDING' || !ready.pgOrderId || ready.amount !== view.order.payableAmount) throw new Error('최신 결제 준비 상태를 다시 확인해 주세요.')
        result = await authentication.authenticate({ orderNumber: number, pgOrderId: ready.pgOrderId, amount: ready.amount })
        if (!result) { setError('결제 인증을 취소했어요. 아직 승인 요청은 보내지 않았어요.'); return }
        if (result.pgOrderId !== ready.pgOrderId || result.amount !== ready.amount || !result.paymentKey) throw new Error('인증 결과와 주문 금액이 일치하지 않아요.')
        saveApproval(session.memberId, number, result)
      }
      if (!result) throw new Error('저장된 인증 결과가 없어요. 주문 상태를 확인해 주세요.')
      if (!mounted.current) return
      const latest = await api.orderSheets.get(number)
      if (!mounted.current) return
      if (latest.payment.orderStatus !== 'PENDING') return
      if (latest.payment.pgOrderId !== result.pgOrderId || latest.payment.amount !== result.amount) throw new Error('저장된 인증의 결제창이 변경되었어요. 주문 상태를 확인해 주세요.')
      const identity = requestIdentity(session.memberId, `sheet-approval:${number}`, result)
      await api.orderSheets.approve(number, result, identity.key)
      // 200/202/UNKNOWN은 화면 성공 판정이 아니다. 아래 조회가 주문·환불의 확정 상태를 보여 준다.
    } catch (cause) { setError(cause instanceof Error ? cause.message : '요청 결과가 확정되지 않았어요. 같은 주문을 다시 조회해 주세요.') }
    finally { inFlight.current = false; setBusy(false); reload() }
  }
  const payment = view?.payment; const saved = session ? savedApproval(session.memberId, number) : null
  const pendingApproval = saved?.pgOrderId === payment?.pgOrderId && saved?.amount === payment?.amount ? saved : null
  return <PageContainer narrow><h1 className="t-h1">주문 결제</h1>
    {(error || loadError) && <Alert type="warning" title="요청 결과를 확인해 주세요">{error || loadError}</Alert>}
    {!view && !error && <p>주문을 조회하고 있어요.</p>}
    {payment && view && <>
      <Alert type={payment.orderStatus === 'PAID' ? 'success' : 'info'} title={sheetMessage(payment)}>
        {payment.refundStatus === 'REQUESTED' ? '종료된 주문은 복원하지 않으며 실제 환불 결과를 기다립니다.' : payment.orderStatus === 'PROCESSING' || payment.paymentStatus === 'UNKNOWN' ? '결과가 확정되기 전에는 새 주문이나 새 결제를 만들지 않습니다.' : payment.orderStatus === 'PENDING' ? '결제 준비와 인증만으로 승인 완료가 되지 않습니다.' : payment.orderStatus === 'PAID' ? '서버가 주문의 결제 완료를 확인했어요.' : '서버가 확인한 주문과 환불 상태를 표시합니다.'}
        {remaining !== null && <p>{payment.orderStatus === 'PENDING' ? '인증 가능 시간' : '승인 처리 기한'} {formatRemaining(remaining)}</p>}
        {remaining === 0 && <p>서버에서 종료와 늦은 승인 결과를 확인하고 있어요.</p>}
      </Alert>
      <p>주문 {number}</p>{authentication?.label && <Alert type="warning" title={authentication.label}>테스트 인증 응답으로만 결제 전달 흐름을 확인합니다.</Alert>}<p>상품 금액 {formatPrice(view.order.totalAmount)} · 쿠폰 할인 {formatPrice(view.order.discountAmount)}</p><strong className="t-price-lg">결제 금액 {formatPrice(view.order.payableAmount)}</strong>
      {view.order.items.map(item => <OrderSummary key={item.orderItemId} productName={item.productName} unitPrice={item.unitPrice} quantity={item.quantity} imageUrl={item.mainImageUrl} discountAmount={item.discountAmount} payableAmount={item.payableAmount} />)}
      {payment.orderStatus === 'PENDING' && <>
        {!authentication && <Alert type="warning" title="결제 인증 연결 준비 중">현재 결제창 연결 설정을 확인할 수 없어 인증을 시작할 수 없어요.</Alert>}
        {['PREPARING', 'PREPARATION_FAILED'].includes(payment.paymentStatus) && <Button onClick={() => { void run('prepare') }} disabled={busy || remaining === 0}>결제 준비 다시 확인</Button>}
        {pendingApproval ? <Button onClick={() => { void run('retry') }} disabled={busy || remaining === 0}>같은 인증 결과로 승인 다시 확인</Button> : <Button onClick={() => { void run('authenticate') }} disabled={busy || remaining === 0 || !authentication || !payment.pgOrderId}>결제 인증하기</Button>}
        <Button variant="secondary" onClick={() => { void run('cancel') }} disabled={busy}>주문 취소</Button>
      </>}
    </>}
    {paused && <p>자동 조회를 잠시 멈췄어요. 같은 주문에서 다시 확인해 주세요.</p>}
    <Button variant="secondary" disabled={busy} onClick={reload}>주문 상태 다시 확인</Button>
    <ButtonLink to="/cart">장바구니</ButtonLink><ButtonLink to="/orders/lookup">기존 주문 목록</ButtonLink>
  </PageContainer>
}
