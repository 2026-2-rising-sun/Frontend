import { useEffect, useRef } from 'react'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { Skeleton } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { ProductCard } from '../shopping/components/ProductCard'
import { loadRecentAndRelated } from '../shopping/recentProducts'
import styles from './RecentRelatedDialog.module.css'

/** "나를 위한 추천 상품"의 더보기. 최근 본 상품과 연관 추천 상품을 한 창에 모아 보여 준다. */
export function RecentRelatedDialog({ onClose }: { onClose: () => void }) {
  const api = useApi()
  const dialog = useRef<HTMLDialogElement>(null)
  const picks = useAsync(() => loadRecentAndRelated(api), [api])
  // 정리 단계에서 close() 를 부르면 close 이벤트가 다시 열린 창까지 닫으므로 부르지 않는다. 화면에서 빠지면 창도 함께 사라진다.
  useEffect(() => {
    const node = dialog.current
    if (node && !node.open) node.showModal()
  }, [])

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="recent-related-title" onClose={onClose} onClick={event => { if (event.target === dialog.current) onClose() }}>
    <div className={styles.head}>
      <h2 id="recent-related-title" className={styles.title}>최근 본 상품과 연관 추천 상품</h2>
      <button type="button" className={styles.close} aria-label="닫기" onClick={onClose}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
      </button>
    </div>
    <div className={styles.body}>
      <AsyncView state={picks} skeleton={<div className={styles.grid}>{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={260} radius={8} />)}</div>}
        isEmpty={data => !data.recent.length && !data.related.length} emptyTitle="보여드릴 상품이 아직 없어요" emptyMessage="상품을 둘러보면 비슷한 상품을 추천해 드려요.">
        {data => <ul className={styles.grid}>
          {data.recent.map(product => <li key={`recent-${product.id}`} className={styles.item}>
            <span className={styles.tag}>최근 본</span>
            <ProductCard product={product} />
          </li>)}
          {data.related.map(product => <li key={`related-${product.id}`} className={styles.item}><ProductCard product={product} /></li>)}
        </ul>}
      </AsyncView>
    </div>
  </dialog>
}
