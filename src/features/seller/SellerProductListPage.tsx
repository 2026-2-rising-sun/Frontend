import { useSearchParams, Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PagedView } from '../../components/PagedView'
import { Button, ButtonLink, Chip, Input, ResultState, Skeleton, StatusBadge, Thumbnail, sellerProductBadge } from '../../components/ui'
import type { SellerProductStatus, SellerProductStatusFilter } from '../../domain/types'
import { usePaged } from '../../hooks/usePaged'
import { formatPrice } from '../../lib/format'
import styles from './seller.module.css'

const FILTERS: { value: SellerProductStatusFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'DRAFT', label: '기본정보만' },
  { value: 'READY', label: '판매 준비' },
  { value: 'SELLING', label: '판매 중' },
  { value: 'SOLD_OUT', label: '품절' },
  { value: 'HIDDEN', label: '비공개' },
  { value: 'UNKNOWN', label: '확인 필요' },
]

const NEXT_ACTION: Record<SellerProductStatus, { label: string; hint: string }> = {
  DRAFT: { label: '판매 설정', hint: '가격과 최초 재고를 설정해 주세요.' },
  READY: { label: '판매 준비 확인', hint: '이미지와 재고를 확인하고 판매를 시작하세요.' },
  SELLING: { label: '상품 관리', hint: '가격·재고·공개 여부를 관리할 수 있어요.' },
  SOLD_OUT: { label: '재고 관리', hint: '재고를 추가하면 다시 판매할 수 있어요.' },
  HIDDEN: { label: '공개 설정', hint: '현재 공개 목록에서 제외된 상품이에요.' },
  UNKNOWN: { label: '판매정보 확인', hint: '판매정보를 다시 확인해 주세요.' },
}

export function SellerProductListPage() {
  const api = useApi()
  const [params, setParams] = useSearchParams()
  const status = FILTERS.find(f => f.value === params.get('status'))?.value ?? 'ALL'
  const query = params.get('q') ?? ''
  // 서버의 상품 상태 필터는 페이지 내부에서 적용된다. 전체 페이지를 순서대로 누적한 뒤
  // 화면에서 필터링하여 상태를 바꿔도 이미 불러온 상품을 잃지 않는다.
  const products = usePaged((page) => api.seller.products.list({ page, size: 20 }), [api])
  const update = (key: string, value: string) => setParams(prev => {
    const next = new URLSearchParams(prev)
    if (!value || value === 'ALL') next.delete(key)
    else next.set(key, value)
    return next
  }, { replace: true })
  const filtered = products.items.filter(p => (status === 'ALL' || p.status === status) &&
    `${p.name} ${p.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const summary = [
    { value: 'ALL', label: '불러온 상품', count: products.items.length },
    { value: 'SELLING', label: '판매 중', count: products.items.filter(p => p.status === 'SELLING').length },
    { value: 'SOLD_OUT', label: '품절', count: products.items.filter(p => p.status === 'SOLD_OUT').length },
    { value: 'READY', label: '판매 준비', count: products.items.filter(p => p.status === 'READY').length },
  ]

  return <>
    <header className={styles.pageHead}>
      <p className={styles.eyebrow}>SELLER CENTER</p>
      <div className={styles.pageTitle}>
        <div><h1 className="t-h1">상품 관리</h1><p className={styles.pageDescription}>판매 상태를 확인하고, 필요한 작업을 이어가세요.</p></div>
        <ButtonLink to="/seller/products/new" className={styles.primaryAction}>+ 상품 등록</ButtonLink>
      </div>
    </header>

    <section aria-label="불러온 상품 상태 요약">
      <div className={styles.summaryGrid}>
        {summary.map(item => <button key={item.value} type="button" className={[styles.summaryCard, status === item.value && styles.summarySelected].filter(Boolean).join(' ')} aria-pressed={status === item.value} onClick={() => update('status', item.value)}>
          <span>{item.label}</span><strong>{products.loading || products.error ? '—' : item.count.toLocaleString()}<small>개</small></strong>
          <span className={styles.summaryLink}>목록 보기 →</span>
        </button>)}
      </div>
      <p className={styles.scopeNote}>상태 요약과 검색은 불러온 상품 기준이에요. 더 보기로 다음 상품을 확인할 수 있어요.</p>
    </section>

    <section className={styles.listSection} aria-label="상품 목록">
      <div className={styles.listToolbar}>
        <Input type="search" label="상품 검색" placeholder="상품명 또는 ID로 검색" value={query} onChange={e => update('q', e.target.value)} className={styles.listSearch} />
        <Button variant="secondary" onClick={products.reload} disabled={products.loading || products.loadingMore}>새로고침</Button>
      </div>
      <div className={styles.chips} role="group" aria-label="판매 상태">
        {FILTERS.map(f => <Chip key={f.value} selected={status === f.value} onClick={() => update('status', f.value)}>{f.label}</Chip>)}
      </div>
      <p className={styles.resultCount} role="status">{products.loading ? '상품을 불러오고 있어요…' : products.error ? '상품을 불러오지 못했어요.' : `불러온 ${products.items.length}개 중 ${filtered.length}개 표시`}</p>
      <PagedView state={products} skeleton={<Skeleton height={220} radius={14} />} emptyTitle="등록한 상품이 없어요" emptyMessage="첫 상품을 등록하고 판매를 준비해 보세요.">
        {() => filtered.length === 0 ? <ResultState type="empty" title="조건에 맞는 상품이 없어요" message={products.hasNext ? '아직 불러오지 않은 상품이 있어요. 아래 더 보기로 확인해 주세요.' : '검색어나 판매 상태를 변경해 보세요.'} action={<Button variant="secondary" onClick={() => setParams({}, { replace: true })}>검색·필터 초기화</Button>} /> : <div className={styles.productList}>
          {filtered.map(p => <article key={p.id} className={styles.productCard}>
            <div className={styles.productIdentity}>
              <Thumbnail src={p.imageUrl} alt="" className={styles.productThumb} />
              <div className={styles.rowText}>
                <span className={styles.rowMeta}>상품 ID {p.id}</span>
                <Link to={`/seller/products/${p.id}`} className={styles.productName}>{p.name}</Link>
                {!p.hasImage && <span className={styles.attention}>대표 이미지를 등록해 주세요</span>}
              </div>
              <StatusBadge status={sellerProductBadge(p.status)} className={styles.productBadge} />
            </div>
            <dl className={styles.productMetrics}>
              <div><dt>판매 가격</dt><dd>{p.price === null ? '설정 전' : formatPrice(p.price)}</dd></div>
              <div><dt>판매 가능 재고</dt><dd>{p.stock === null ? '확인 필요' : `${p.stock.toLocaleString()}개`}</dd></div>
            </dl>
            <div className={styles.productFooter}>
              <p>{NEXT_ACTION[p.status].hint}</p>
              <ButtonLink to={`/seller/products/${p.id}`} size="S" variant={p.status === 'SELLING' ? 'secondary' : 'tonal'} aria-label={`${p.name} ${NEXT_ACTION[p.status].label}`}>{NEXT_ACTION[p.status].label} →</ButtonLink>
            </div>
          </article>)}
        </div>}
      </PagedView>
      {!products.loading && !products.error && !products.items.length && !products.hasNext && <ButtonLink to="/seller/products/new" className={styles.emptyAction}>첫 상품 등록</ButtonLink>}
    </section>
  </>
}
