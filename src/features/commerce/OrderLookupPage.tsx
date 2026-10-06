import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { PagedView } from '../../components/PagedView'
import { Skeleton, StatusBadge, orderBadge } from '../../components/ui'
import { usePaged } from '../../hooks/usePaged'
import { formatPrice, formatFullDateTime } from '../../lib/format'
import styles from './OrderLookupPage.module.css'
export function OrderLookupPage() {
  const api = useApi()
  const orders = usePaged(page => api.orders.list({ page, size: 20 }), [api])
  return <PageContainer narrow><h1 className="t-h1">내 주문</h1>
    <PagedView state={orders} skeleton={<Skeleton height={200} />} emptyTitle="주문 내역이 없어요">
      {items => items.map(order => <section key={order.orderNumber} className={styles.card}>
        <StatusBadge status={orderBadge(order.status)} /><Link to={`/orders/${encodeURIComponent(order.orderNumber)}`}>{order.productName}</Link>
        <p>{order.quantity}개 · {formatPrice(order.totalPrice)}</p><p className="t-caption">{formatFullDateTime(order.orderedAt)}</p>
      </section>)}
    </PagedView>
  </PageContainer>
}
