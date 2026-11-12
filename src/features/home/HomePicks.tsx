import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { Button, Skeleton } from '../../components/ui'
import type { Product } from '../../domain/types'
import { useAsync, type AsyncState } from '../../hooks/useAsync'
import { ProductCard } from '../shopping/components/ProductCard'
import { RecentRelatedDialog } from './RecentRelatedDialog'
import styles from './HomePicks.module.css'

const PER_PAGE = 2
const MAX_PAGES = 5
const visible = (product: Product) => !product.missing && (product.status === 'SELLING' || product.status === 'SOLD_OUT')

/**
 * 홈의 "요즘 주목 받는 상품"과 "나를 위한 추천 상품" 두 칸.
 * 인기·추천 API가 생기기 전까지 주목 상품은 진행·예정 방송의 소개 상품, 추천 상품은 판매 중인 최신 상품으로 채운다.
 */
export function HomePicks() {
  const api = useApi()
  const trending = useAsync(async () => {
    const pages = await Promise.allSettled([api.lives.list({ status: 'LIVE', size: 5 }), api.lives.list({ status: 'READY', size: 5 })])
    if (pages.every(page => page.status === 'rejected')) throw (pages[0] as PromiseRejectedResult).reason
    const lives = pages.flatMap(page => page.status === 'fulfilled' ? page.value.items : [])
    const groups = await Promise.allSettled(lives.map(live => api.lives.listProducts(live.id)))
    const products = groups.flatMap(group => group.status === 'fulfilled' ? group.value.filter(visible) : [])
    return [...new Map(products.map(product => [product.id, product])).values()].slice(0, PER_PAGE * MAX_PAGES)
  }, [api])
  const recommended = useAsync(async () => (await api.products.list({ status: 'SELLING', sort: 'LATEST', size: PER_PAGE * MAX_PAGES })).items, [api])

  const [showRecent, setShowRecent] = useState(false)

  return <div className={styles.picks}>
    <PickColumn id="trending" title="요즘 주목 받는 상품" more={<Link to="/ranking" className={styles.more}>더보기 <span aria-hidden="true">›</span></Link>} state={trending} emptyMessage="방송에서 소개 중인 상품이 아직 없어요." />
    <PickColumn id="recommended" title="나를 위한 추천 상품" more={<button type="button" className={styles.more} aria-haspopup="dialog" onClick={() => setShowRecent(true)}>더보기 <span aria-hidden="true">›</span></button>} state={recommended} emptyMessage="추천할 상품이 아직 없어요." />
    {showRecent && <RecentRelatedDialog onClose={() => setShowRecent(false)} />}
  </div>
}

interface PickColumnProps {
  id: string
  title: string
  /** 제목 오른쪽 "더보기" (링크 또는 버튼) */
  more: ReactNode
  state: AsyncState<Product[]>
  emptyMessage: string
}

function PickColumn({ id, title, more, state, emptyMessage }: PickColumnProps) {
  const [page, setPage] = useState(0)
  const products = state.data ?? []
  const pages = Math.max(1, Math.ceil(products.length / PER_PAGE))
  const current = Math.min(page, pages - 1)
  const shown = products.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE)

  return <section className={styles.column} aria-labelledby={`${id}-heading`}>
    <div className={styles.head}>
      <h2 id={`${id}-heading`} className={styles.title}>{title}</h2>
      {more}
    </div>
    {!state.data && !state.error ? <div className={styles.cards}>{Array.from({ length: PER_PAGE }, (_, i) => <Skeleton key={i} height={280} radius={8} />)}</div>
      : state.error && !state.data ? <div className={styles.empty}><p>상품을 불러오지 못했어요.</p><Button variant="secondary" size="S" onClick={state.reload}>상품 다시 조회</Button></div>
        : !products.length ? <p className={styles.empty}>{emptyMessage}</p>
          : <>
            <div className={styles.cards}>{shown.map(product => <ProductCard key={product.id} product={product} />)}</div>
            {pages > 1 && <button type="button" className={styles.next} onClick={() => setPage((current + 1) % pages)}>
              다른 상품 추천해드릴게요 <span className={styles.count}><strong>{current + 1}</strong> | {pages}</span>
            </button>}
          </>}
  </section>
}
