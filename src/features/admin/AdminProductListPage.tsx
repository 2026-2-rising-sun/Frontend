import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PagedView } from '../../components/PagedView'
import { ButtonLink, Chip, Skeleton, StatusBadge, Thumbnail, adminProductBadge } from '../../components/ui'
import type { AdminProductStatusFilter } from '../../domain/types'
import { usePaged } from '../../hooks/usePaged'
import { formatPrice } from '../../lib/format'
import styles from './admin.module.css'

const PAGE_SIZE = 20

const FILTERS: { value: AdminProductStatusFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'DRAFT', label: '기본정보만' },
  { value: 'READY', label: '판매 준비' },
  { value: 'SELLING', label: '판매 중' },
  { value: 'SOLD_OUT', label: '품절' },
  { value: 'HIDDEN', label: '비공개' },
]

/**
 * 상품 관리 목록. 공개 목록과 달리 기본정보만 있는 상품·판매 준비·비공개 상품도 모두 찾을 수 있다.
 * 판매정보 조회 실패는 품절과 다르게 화면 오류로 보여준다.
 */
export function AdminProductListPage() {
  const api = useApi()
  const [status, setStatus] = useState<AdminProductStatusFilter>('ALL')
  const products = usePaged((page) => api.admin.products.list({ status, page, size: PAGE_SIZE }), [api, status])

  return (
    <>
      <div className={styles.pageHead}>
        <div className={styles.pageTitle}>
          <h1 className="t-h1">상품 관리</h1>
          <ButtonLink to="/admin/products/new" size="M" style={{ marginLeft: 'auto' }}>
            상품 등록
          </ButtonLink>
        </div>
        <div className={styles.chips} role="group" aria-label="판매 상태">
          {FILTERS.map((f) => (
            <Chip key={f.value} selected={status === f.value} onClick={() => setStatus(f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <PagedView
        state={products}
        skeleton={<Skeleton height={64} radius={14} />}
        emptyTitle="해당하는 상품이 없어요"
        emptyMessage="상품 등록으로 새 상품을 만들 수 있어요."
      >
        {(items) => (
          <div className={styles.list}>
            {items.map((p) => (
              <div key={p.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <Thumbnail src={p.imageUrl} alt={p.name} className={styles.rowThumb} />
                  <div className={styles.rowText}>
                    <Link to={`/admin/products/${p.id}`} className={styles.rowName}>
                      {p.name}
                    </Link>
                    <span className={styles.rowMeta}>{p.hasImage ? `ID ${p.id}` : `ID ${p.id} · 대표 이미지 없음`}</span>
                  </div>
                </div>
                <span className={`${styles.rowCell} ${styles.colPrice}`}>{p.price === null ? '—' : formatPrice(p.price)}</span>
                <span className={`${styles.rowCell} ${styles.colStock}`}>{p.stock === null ? '—' : `재고 ${p.stock}`}</span>
                <span className={styles.colStatus}>
                  <StatusBadge status={adminProductBadge(p.status)} />
                </span>
                <div className={styles.rowActions}>
                  <ButtonLink to={`/admin/products/${p.id}`} size="S" variant="secondary">
                    수정
                  </ButtonLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </PagedView>
    </>
  )
}
