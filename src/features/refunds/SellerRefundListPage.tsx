import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { Alert, Button, Skeleton } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { RefundDetails } from './RefundDetails'
import styles from './refunds.module.css'

const PAGE_SIZE = 20
export function SellerRefundListPage() {
  const [page, setPage] = useState(0)
  return <SellerRefundPage key={page} page={page} onPage={setPage} />
}

function SellerRefundPage({ page, onPage }: { page: number; onPage: (page: number) => void }) {
  const api = useApi()
  const refunds = useAsync(() => api.refunds.listSeller({ page, size: PAGE_SIZE }), [api, page])
  return <section className={styles.section}>
    <div className={styles.heading}><h1 className="t-h1">환불 관리</h1><Button variant="secondary" onClick={refunds.reload} disabled={refunds.loading}>새로고침</Button></div>
    <p>내 상품에 대한 환불 내역입니다. 다른 판매자의 상품과 금액은 포함되지 않아요.</p>
    {refunds.error && refunds.data && <Alert type="warning" title="최신 내역을 확인하지 못했어요"><Button onClick={refunds.reload}>다시 조회</Button></Alert>}
    <AsyncView state={refunds} skeleton={<Skeleton height={240} />} isEmpty={(items) => items.length === 0} emptyTitle="환불 내역이 없어요" emptyMessage="구매자가 환불을 요청하면 이곳에서 확인할 수 있어요.">
      {(items) => <div className={styles.section}>{items.map((refund) => <div key={refund.id}><RefundDetails refund={refund} /><Link to={`/admin/refunds/${encodeURIComponent(refund.id)}`}>환불 상세 보기</Link></div>)}</div>}
    </AsyncView>
    <nav className={styles.actions} aria-label="환불 목록 페이지">
      <Button variant="secondary" disabled={page === 0 || refunds.loading} onClick={() => onPage(page - 1)}>이전</Button>
      <span>{page + 1}페이지</span>
      <Button variant="secondary" disabled={refunds.loading || !!refunds.error || (refunds.data?.length ?? 0) < PAGE_SIZE} onClick={() => onPage(page + 1)}>다음</Button>
    </nav>
  </section>
}
