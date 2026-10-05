import type { ReactNode } from 'react'
import { Thumbnail } from '../../../components/ui'
import { formatPrice } from '../../../lib/format'
import styles from './OrderSummary.module.css'

interface OrderSummaryProps {
  productName: string
  unitPrice: number
  quantity: number
  imageUrl?: string | null
  /** 수량 변경 등 우측 액션 영역 */
  children?: ReactNode
}

/** Figma "Order Summary". 주문서·주문 결과에서 주문 당시 상품명·단가·수량·금액을 보여준다. */
export function OrderSummary({ productName, unitPrice, quantity, imageUrl = null, children }: OrderSummaryProps) {
  return (
    <div className={styles.root}>
      <div className={styles.product}>
        <Thumbnail src={imageUrl} alt={productName} className={styles.thumb} />
        <div className={styles.text}>
          <p className={styles.name}>{productName}</p>
          <p className={styles.detail}>
            {formatPrice(unitPrice)} · 수량 {quantity}
          </p>
        </div>
      </div>
      {children}
      <div className={styles.divider} />
      <div className={styles.total}>
        <span>총 결제 금액</span>
        <strong className="t-price-md">{formatPrice(unitPrice * quantity)}</strong>
      </div>
    </div>
  )
}
