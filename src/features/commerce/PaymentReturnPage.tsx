import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, ButtonLink } from '../../components/ui'
import { useSession } from '../auth/useSession'
import { approveAuthenticatedPayment } from './sheetApproval'
import { readWidgetReturn } from './widgetReturn'
export function PaymentReturnPage() {
  const { orderNumber = '' } = useParams(); const session = useSession()
  return <ReturnScope key={`${session?.memberId}:${orderNumber}`} number={orderNumber} />
}
function ReturnScope({ number }: { number: string }) {
  const api = useApi(); const session = useSession(); const navigate = useNavigate()
  const [result] = useState(() => session ? readWidgetReturn(session.memberId, number) : null)
  const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!session || result?.outcome !== 'success') return
    let disposed = false
    void approveAuthenticatedPayment(api.orderSheets, session.memberId, number, result.payment)
      .then(() => { if (!disposed) navigate(`/order-sheets/${encodeURIComponent(number)}`, { replace: true }) })
      .catch(cause => { if (!disposed) setError(cause instanceof Error ? cause.message : '같은 주문의 결과를 다시 확인해 주세요.') })
    return () => { disposed = true }
  }, [api, session, number, result, navigate, attempt])
  return <PageContainer narrow><h1 className="t-h1">결제 인증 결과 확인</h1>
    {error ? <Alert type="warning" title="승인 결과를 확인하지 못했어요">{error}<Button onClick={() => { setError(''); setAttempt(n => n + 1) }}>같은 인증 결과로 다시 확인</Button></Alert> : result?.outcome === 'success' ? <p>서버에서 주문 상태와 인증 결과를 확인하고 있어요. 결제 성공은 아직 확정되지 않았어요.</p> : <Alert type="warning" title="결제 인증을 확인해 주세요">{result?.message ?? '저장된 인증 결과가 없어요. 주문 상태를 확인해 주세요.'}</Alert>}
    <ButtonLink to={`/order-sheets/${encodeURIComponent(number)}`}>주문 상태 확인</ButtonLink>
  </PageContainer>
}
