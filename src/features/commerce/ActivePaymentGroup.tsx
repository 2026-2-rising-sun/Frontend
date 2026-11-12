import { useApi } from '../../app/apiContext'
import { Alert, Button, ButtonLink } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
export function ActivePaymentGroup() {
  const api = useApi()
  const active = useAsync(() => api.paymentGroups.active(), [api])
  if (active.error) return <Alert type="warning" title="진행 중인 결제를 확인하지 못했어요"><Button variant="secondary" onClick={active.reload}>다시 확인</Button></Alert>
  if (!active.data) return null
  return <Alert type="info" title="진행 중인 결제가 있어요">장바구니는 계속 수정할 수 있어요. 새 주문을 만들기 전에 진행 중인 결제를 완료하거나 취소해 주세요.<ButtonLink to={`/payment-groups/${encodeURIComponent(active.data.groupNumber)}`}>진행 중인 결제 확인</ButtonLink></Alert>
}
