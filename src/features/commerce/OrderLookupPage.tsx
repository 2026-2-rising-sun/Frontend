import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, Input } from '../../components/ui'
import { ApiError } from '../../domain/errors'
import { saveOrderAccess } from './orderAccess'
import styles from './OrderLookupPage.module.css'

/** 주문 조회. 주문번호 + 조회 비밀번호가 모두 맞아야 주문 내용을 볼 수 있다. */
export function OrderLookupPage() {
  const api = useApi()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [orderNumber, setOrderNumber] = useState(params.get('orderNumber') ?? '')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [networkError, setNetworkError] = useState<string | undefined>()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setFieldError(undefined)
    setNetworkError(undefined)
    if (!orderNumber.trim() || !password) {
      setFieldError('주문번호와 조회 비밀번호를 모두 입력해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      const order = await api.orders.lookup(orderNumber.trim(), password)
      saveOrderAccess(order.orderNumber, password)
      navigate(`/orders/${order.orderNumber}`)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') setFieldError('주문 정보와 일치하지 않아요.')
      else setNetworkError(err instanceof ApiError ? err.message : '주문을 조회하지 못했어요.')
      setSubmitting(false)
    }
  }

  return (
    <PageContainer narrow>
      <form className={styles.card} onSubmit={submit} noValidate>
        <h1 className="t-h2">주문 조회</h1>
        <Alert type="info" title="주문번호와 비밀번호가 필요해요">
          주문할 때 정한 조회 비밀번호를 입력하세요. 분실 복구는 제공하지 않습니다.
        </Alert>
        {networkError && (
          <Alert type="danger" title="조회하지 못했어요">
            {networkError}
          </Alert>
        )}
        <Input
          label="주문번호"
          placeholder="LC-260919-0001"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          helper="주문 완료 화면에서 확인할 수 있어요."
        />
        <Input
          label="조회 비밀번호"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError}
          autoComplete="current-password"
        />
        <Button type="submit" size="L" fullWidth disabled={submitting}>
          {submitting ? '조회 중…' : '주문 조회'}
        </Button>
      </form>
    </PageContainer>
  )
}
