import { useState } from 'react'
import { useApi } from '../../app/apiContext'
import { Button, Skeleton } from '../../components/ui'
import type { Product } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { ProductCard } from '../shopping/components/ProductCard'
import { loadRanking } from '../shopping/rankingProducts'
import { ProductPicksDialog } from './ProductPicksDialog'
import styles from './HomePicks.module.css'

const PER_PAGE = 4
const MAX_PAGES = 3
const visible = (product: Product) => !product.missing && (product.status === 'SELLING' || product.status === 'SOLD_OUT')

/**
 * 홈의 "요즘 주목 받는 상품". 상품 카드를 한 번에 4개씩 보여 준다.
 * 인기 API가 생기기 전까지 진행, 예정 방송의 소개 상품으로 채운다.
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
  const [dialog, setDialog] = useState(false)
  const [page, setPage] = useState(0)
  const products = trending.data ?? []
  const pages = Math.max(1, Math.ceil(products.length / PER_PAGE))
  const current = Math.min(page, pages - 1)
  const shown = products.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE)

  return <section className={styles.column} aria-labelledby="trending-heading">
    <div className={styles.head}>
      <h2 id="trending-heading" className={styles.title}>요즘 주목 받는 상품</h2>
      <button type="button" className={styles.more} aria-haspopup="dialog" onClick={() => setDialog(true)}>더보기 <span aria-hidden="true">›</span></button>
    </div>
    {!trending.data && !trending.error ? <div className={styles.cards}>{Array.from({ length: PER_PAGE }, (_, i) => <Skeleton key={i} height={280} radius={8} />)}</div>
      : trending.error && !trending.data ? <div className={styles.empty}><p>상품을 불러오지 못했어요.</p><Button variant="secondary" size="S" onClick={trending.reload}>상품 다시 조회</Button></div>
        : !products.length ? <p className={styles.empty}>방송에서 소개 중인 상품이 아직 없어요.</p>
          : <>
            <div className={styles.cards}>{shown.map(product => <ProductCard key={product.id} product={product} variant="random" />)}</div>
            {pages > 1 && <button type="button" className={styles.next} onClick={() => setPage((current + 1) % pages)}>
              다른 상품 보기 <span className={styles.count}><strong>{current + 1}</strong> | {pages}</span>
            </button>}
          </>}
    {dialog && <ProductPicksDialog title="요즘 주목 받는 상품" onClose={() => setDialog(false)}
      emptyTitle="순위에 올릴 상품이 아직 없어요" emptyMessage="판매 상품이 등록되면 이곳에 보여드려요."
      load={async () => (await loadRanking(api)).map((product, index) => ({ product, tag: String(index + 1), strong: index < 3 }))} />}
  </section>
}
