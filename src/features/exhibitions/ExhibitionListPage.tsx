import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { ResultState, Skeleton, Thumbnail } from '../../components/ui'
import { exhibitionState, type ExhibitionSummary } from '../../domain/exhibitions'
import { PRODUCT_CATEGORIES, type Product } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import { displayPrice } from '../shopping/liveDeal'
import tones from './tones.module.css'
import styles from './ExhibitionListPage.module.css'

const FILTERS = [{ value: '', label: '전체' }, ...PRODUCT_CATEGORIES.map(category => ({ value: category.value.toLowerCase(), label: category.label }))]

/**
 * 기획전 목록(/exhibitions). 위쪽 머리 띠와 분류 칸, 아래 "지금 진행 중인 행사예요" 카드 목록이다.
 * 카드는 큰 기획전 배너와 대표 상품 두 개다. 배너를 누르면 기획전 화면으로 간다.
 * 고른 분류는 주소(?category=beauty)에 남겨 새로 고침하거나 공유해도 그대로 보인다.
 */
export function ExhibitionListPage() {
  const api = useApi()
  const exhibitions = useAsync(() => api.exhibitions.list(), [api])
  const [params, setParams] = useSearchParams()
  const selected = FILTERS.find(filter => filter.value === params.get('category'))?.value ?? ''
  const [now] = useState(Date.now)

  return <div className={styles.page}>
    <header className={styles.band}>
      <div className={styles.bandInner}>
        <h1 className={styles.title}>기획전</h1>
        <p className={styles.lead}>꼭 갖고 싶은 그 상품들! 다양한 혜택까지!</p>
      </div>
    </header>
    <PageContainer className={styles.body}>
      <div className={styles.filters} role="group" aria-label="기획전 분류">
        {FILTERS.map(filter => <button key={filter.value} type="button" className={styles.filter} aria-pressed={filter.value === selected}
          onClick={() => setParams(filter.value ? { category: filter.value } : {}, { replace: true })}>{filter.label}</button>)}
      </div>
      <section className={styles.list} aria-labelledby="exhibitions-heading">
        <h2 id="exhibitions-heading" className={styles.heading}>지금 진행 중인 행사예요</h2>
        <AsyncView state={exhibitions} skeleton={<ul className={styles.cards}>{[0, 1].map(i => <li key={i}><Skeleton height={560} radius={4} /></li>)}</ul>}>
          {data => {
            const shown = data.filter(item => exhibitionState(item, now) === 'ACTIVE' && (!selected || item.category?.toLowerCase() === selected))
            return shown.length ? <ul className={styles.cards}>{shown.map(item => <li key={item.id}><ExhibitionCard exhibition={item} /></li>)}</ul>
              : <ResultState type="empty" title="진행 중인 기획전이 없어요" message={selected ? '다른 분류를 골라 보세요.' : '새 기획전을 준비하고 있어요.'} />
          }}
        </AsyncView>
      </section>
    </PageContainer>
  </div>
}

function ExhibitionCard({ exhibition }: { exhibition: ExhibitionSummary }) {
  const products = exhibition.previewProducts.slice(0, 2)
  return <article className={styles.card} aria-label={exhibition.title}>
    <Link to={`/exhibitions/${encodeURIComponent(exhibition.id)}`} className={[styles.banner, tones[exhibition.tone]].join(' ')}>
      <span className={styles.art} aria-hidden="true">{exhibition.art.join('')}</span>
      <strong className={styles.headline}>{exhibition.headline.map(line => <span key={line}>{line}</span>)}</strong>
      <span className={styles.description}>{exhibition.description}</span>
    </Link>
    {products.length > 0 && <ul className={styles.products}>
      {products.map(product => <li key={product.id}><ProductTile product={product} /></li>)}
    </ul>}
  </article>
}

function ProductTile({ product }: { product: Product }) {
  const shown = displayPrice(product)
  return <Link to={`/products/${product.id}`} className={styles.product}>
    <Thumbnail src={product.imageUrl} alt={product.name} className={styles.thumb} />
    {product.brand && <span className={styles.brand}>{product.brand}</span>}
    <span className={styles.name}>{product.name}</span>
    <span className={styles.price}>
      {shown.before !== null && <del aria-label={`할인 전 ${formatPrice(shown.before)}`}>{formatPrice(shown.before)}</del>}
      <strong>{formatPrice(shown.price)}</strong>
    </span>
  </Link>
}
