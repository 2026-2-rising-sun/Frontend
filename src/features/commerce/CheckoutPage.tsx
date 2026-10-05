import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, Checkbox, Input, QuantityStepper, ResultState, Skeleton, type AlertType } from '../../components/ui'
import { ApiError } from '../../domain/errors'
import type { Product } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import { OrderSummary } from './components/OrderSummary'
import { saveOrderAccess } from './orderAccess'
import styles from './CheckoutPage.module.css'

interface FormAlert {
  type: AlertType
  title: string
  message: string
}

const validate = (v: { name: string; phone: string; password: string }) => ({
  name: v.name.trim() ? '' : '주문자 이름을 입력해 주세요.',
  // 연락처 형식 검사는 본인인증이 아니다. 숫자 10~11자리(01x)인지만 확인한다.
  phone: /^01\d{8,9}$/.test(v.phone.replace(/-/g, '')) ? '' : '연락처를 010-0000-0000 형식으로 입력해 주세요.',
  password: v.password.length >= 4 ? '' : '조회 비밀번호를 4자리 이상 입력해 주세요.',
})

/** 주문서. 일반 구매와 방송 경유 구매가 같은 화면·같은 규칙을 쓴다. */
export function CheckoutPage() {
  const [params] = useSearchParams()
  const api = useApi()
  const productId = params.get('productId') ?? ''
  const initialQuantity = Math.max(1, Number.parseInt(params.get('quantity') ?? '1', 10) || 1)
  const product = useAsync(() => api.products.get(productId), [api, productId])

  return (
    <PageContainer>
      <h1 className="t-h1">주문서</h1>
      {!productId ? (
        <ResultState type="error" title="주문할 상품이 없어요" message="상품 상세에서 바로 구매를 눌러 주세요." />
      ) : (
        <AsyncView
          state={product}
          skeleton={<Skeleton height={320} radius={14} />}
        >
          {(p) => <CheckoutForm key={p.id} product={p} initialQuantity={initialQuantity} reloadProduct={product.reload} />}
        </AsyncView>
      )}
    </PageContainer>
  )
}

function CheckoutForm({ product, initialQuantity, reloadProduct }: { product: Product; initialQuantity: number; reloadProduct: () => void }) {
  const api = useApi()
  const navigate = useNavigate()
  const buyable = product.status === 'SELLING' && product.stock > 0

  const [quantity, setQuantity] = useState(Math.min(initialQuantity, Math.max(product.stock, 1)))
  // 사용자가 화면에서 확인한 단가. 서버 가격이 바뀌면 새 금액을 다시 확인받기 전까지 결제하지 않는다.
  const [confirmedPrice, setConfirmedPrice] = useState(product.price)
  const [values, setValues] = useState({ name: '', phone: '', password: '' })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [agreed, setAgreed] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState<FormAlert | null>(null)

  const errors = validate(values)
  const showError = (key: keyof typeof errors) => (attempted || touched[key] ? errors[key] : '')
  const bind = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => setValues((prev) => ({ ...prev, [key]: e.target.value })),
    onBlur: () => setTouched((prev) => ({ ...prev, [key]: true })),
    error: showError(key) || undefined,
  })

  const handleCreateError = (err: unknown) => {
    if (!(err instanceof ApiError)) {
      setAlert({ type: 'danger', title: '주문을 만들지 못했어요', message: '알 수 없는 오류가 발생했어요. 다시 시도해 주세요.' })
      return
    }
    switch (err.code) {
      case 'PRICE_CHANGED': {
        const next = Number(err.details?.currentUnitPrice)
        setAlert({
          type: 'warning',
          title: '가격이 변경되었어요',
          message: `${formatPrice(confirmedPrice)} → ${formatPrice(next)}. 새 금액을 확인한 뒤 다시 결제해 주세요.`,
        })
        setConfirmedPrice(next)
        reloadProduct()
        break
      }
      case 'OUT_OF_STOCK':
        setAlert({ type: 'danger', title: '재고가 부족해요', message: '수량을 줄이거나 다른 상품을 선택해 주세요.' })
        reloadProduct()
        break
      case 'NOT_ON_SALE':
      case 'NOT_FOUND':
        setAlert({ type: 'danger', title: '구매할 수 없는 상품이에요', message: '판매가 중단되었거나 비공개로 바뀌었을 수 있어요.' })
        break
      case 'NETWORK':
        setAlert({ type: 'danger', title: '주문을 만들지 못했어요', message: `${err.message} 다시 시도해 주세요.` })
        break
      default:
        setAlert({ type: 'danger', title: '주문을 만들지 못했어요', message: err.message })
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    if (submitting) return // 중복 클릭으로 주문이 두 번 만들어지지 않도록
    if (Object.values(errors).some(Boolean) || !agreed || !buyable) return

    setSubmitting(true)
    setAlert(null)
    let orderNumber: string
    try {
      const order = await api.orders.create({
        productId: product.id,
        quantity,
        expectedUnitPrice: confirmedPrice,
        ordererName: values.name.trim(),
        ordererPhone: values.phone.trim(),
        lookupPassword: values.password,
      })
      orderNumber = order.orderNumber
    } catch (err) {
      handleCreateError(err)
      setSubmitting(false)
      return
    }

    saveOrderAccess(orderNumber, values.password)
    try {
      await api.payments.start(orderNumber, values.password)
    } catch {
      // 주문은 이미 만들어졌다. 결제 시작 실패는 결과 화면(결제 전 상태)에서 다시 시도할 수 있다.
    }
    navigate(`/orders/${orderNumber}`, { replace: true })
  }

  const total = confirmedPrice * quantity

  return (
    <form className={styles.layout} onSubmit={submit} noValidate>
      <div className={styles.main}>
        {!buyable && (
          <Alert type="danger" title="지금은 구매할 수 없는 상품이에요">
            품절이거나 판매가 중단되었어요.
          </Alert>
        )}
        {alert && (
          <Alert type={alert.type} title={alert.title}>
            {alert.message}
          </Alert>
        )}

        <section className={styles.card} aria-labelledby="order-product">
          <h2 id="order-product" className="t-h4">
            주문 상품
          </h2>
          <OrderSummary productName={product.name} unitPrice={confirmedPrice} quantity={quantity} imageUrl={product.imageUrl}>
            <div className={styles.qty}>
              <span className="t-label-md">수량</span>
              <QuantityStepper value={quantity} onChange={setQuantity} max={product.stock} disabled={!buyable || submitting} />
            </div>
          </OrderSummary>
        </section>

        <section className={styles.card} aria-labelledby="order-orderer">
          <h2 id="order-orderer" className="t-h4">
            주문자 정보
          </h2>
          <Input label="주문자 이름" placeholder="홍길동" autoComplete="name" helper="주문 조회에 사용됩니다." {...bind('name')} />
          <Input label="연락처" placeholder="010-0000-0000" inputMode="tel" autoComplete="tel" helper="숫자만 입력해도 돼요." {...bind('phone')} />
          <Input
            label="주문 조회 비밀번호"
            type="password"
            placeholder="4자리 이상"
            autoComplete="new-password"
            helper="주문 조회·결제·취소에 사용됩니다. 분실하면 복구할 수 없어요."
            {...bind('password')}
          />
        </section>
      </div>

      <aside className={styles.side}>
        <section className={styles.card} aria-labelledby="order-pay">
          <h2 id="order-pay" className="t-h4">
            결제 금액
          </h2>
          <dl className={styles.rows}>
            <div>
              <dt>상품 금액</dt>
              <dd>{formatPrice(confirmedPrice)}</dd>
            </div>
            <div>
              <dt>수량</dt>
              <dd>{quantity}개</dd>
            </div>
          </dl>
          <div className={styles.total}>
            <span>총 결제 금액</span>
            <strong className="t-price-lg">{formatPrice(total)}</strong>
          </div>
          <div>
            <Checkbox label="주문 내용을 확인했으며 결제에 동의합니다" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            {attempted && !agreed && <p className={styles.agreeError}>결제 동의가 필요해요.</p>}
          </div>
          <Button type="submit" size="L" fullWidth disabled={!buyable || submitting}>
            {submitting ? '처리 중…' : `${formatPrice(total)} 결제하기`}
          </Button>
          <p className="t-caption" style={{ color: 'var(--text-tertiary)' }}>
            실제 결제 없이 시스템 내부 Mock 결제로 진행됩니다.
          </p>
        </section>
      </aside>
    </form>
  )
}
