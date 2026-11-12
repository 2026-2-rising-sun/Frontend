import { useEffect, useRef } from 'react'
import { AsyncView } from '../../components/AsyncView'
import { Skeleton } from '../../components/ui'
import type { Product } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { ProductCard } from '../shopping/components/ProductCard'
import styles from './ProductPicksDialog.module.css'

export interface PickItem {
  product: Product
  /** 카드 왼쪽 위 표시. 예: "최근 본", "1" */
  tag?: string
  /** 표시를 강조색으로 칠할지 (상위 순위 등) */
  strong?: boolean
}

interface ProductPicksDialogProps {
  title: string
  load: () => Promise<PickItem[]>
  emptyTitle: string
  emptyMessage: string
  onClose: () => void
}

/** 홈 추천 칸의 "더보기" 창. 상품 카드를 4열(모바일 2열)로 보여 주고 X, Esc, 바깥 클릭으로 닫는다. */
export function ProductPicksDialog({ title, load, emptyTitle, emptyMessage, onClose }: ProductPicksDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  // 창을 연 동안 한 번만 불러온다. load 는 부모가 렌더링마다 새로 만들 수 있어 의존성에 넣지 않는다.
  const loadRef = useRef(load)
  const items = useAsync(() => loadRef.current(), [])
  // 정리 단계에서 close() 를 부르면 close 이벤트가 다시 열린 창까지 닫으므로 부르지 않는다. 화면에서 빠지면 창도 함께 사라진다.
  useEffect(() => {
    const node = dialog.current
    if (node && !node.open) node.showModal()
  }, [])

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="product-picks-title" onClose={onClose} onClick={event => { if (event.target === dialog.current) onClose() }}>
    <div className={styles.head}>
      <h2 id="product-picks-title" className={styles.title}>{title}</h2>
      <button type="button" className={styles.close} aria-label="닫기" onClick={onClose}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
      </button>
    </div>
    <div className={styles.body}>
      <AsyncView state={items} skeleton={<div className={styles.grid}>{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={260} radius={8} />)}</div>}
        isEmpty={data => !data.length} emptyTitle={emptyTitle} emptyMessage={emptyMessage}>
        {data => <ul className={styles.grid}>
          {data.map(({ product, tag, strong }, index) => <li key={`${index}-${product.id}`} className={styles.item}>
            {tag && <span className={[styles.tag, strong && styles.strong].filter(Boolean).join(' ')}>{tag}</span>}
            <ProductCard product={product} />
          </li>)}
        </ul>}
      </AsyncView>
    </div>
  </dialog>
}
