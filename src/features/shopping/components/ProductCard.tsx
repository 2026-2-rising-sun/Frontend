import { Link } from 'react-router-dom'
import { StatusBadge, Thumbnail, productBadge } from '../../../components/ui'
import type { Product } from '../../../domain/types'
import { formatPrice } from '../../../lib/format'
import { ProductCouponHint } from '../../coupons/ProductCouponHint'
import { displayPrice } from '../liveDeal'
import { DELIVERY_LABEL, dealRemaining, discountRate, unitPriceLabel } from '../productCardInfo'
import { reviewCount, satisfiedPercent } from '../satisfaction'
import styles from './ProductCard.module.css'

/**
 * 상품 카드 종류. 화면마다 보여 줄 정보가 달라 필요한 데이터도 다르다.
 * - standard(기본형): 브랜드, 원가와 판매가, 만족도와 리뷰 수, 주문중, 무료배송. 카테고리(가전, 뷰티, 패션), 검색, 랭킹.
 * - deal(특가형): 할인율과 남은 할인 시간을 앞세운다. 세일, 홈 "요즘 주목 받는 상품".
 * - compact(간결형): 이름 한 줄, 가격, 빠른 배송만. 홈 "나를 위한 추천 상품".
 * - value(가성비형): 묶음 수, 단위가격, 무료배송과 무료반품, 빠른 배송. 카테고리(식품, 생활).
 */
export type ProductCardVariant = 'standard' | 'deal' | 'compact' | 'value'

interface ProductCardProps {
  product: Product
  variant?: ProductCardVariant
  /** 특가형에서 함께 보일 쿠폰 할인 금액(원) */
  couponDiscount?: number
}

/** 값이 없는 정보는 그리지 않는다. 품절은 조회 가능, 구매 불가로 표시한다. */
export function ProductCard({ product, variant = 'standard', couponDiscount }: ProductCardProps) {
  const soldOut = product.status === 'SOLD_OUT'
  return (
    <Link to={`/products/${product.id}`} data-variant={variant} className={[styles.card, VARIANT_CLASS[variant], soldOut && styles.soldOut].filter(Boolean).join(' ')}>
      <Thumbnail src={product.imageUrl} alt={product.name} ratio="1 / 1" className={styles.thumb}>
        {variant === 'value' && product.packCount && <span className={styles.pack}>{product.packCount}개</span>}
        {soldOut && <span className={styles.dim}>품절</span>}
      </Thumbnail>
      <div className={styles.info}>
        {variant === 'deal' ? <DealInfo product={product} couponDiscount={couponDiscount} />
          : variant === 'compact' ? <CompactInfo product={product} />
            : variant === 'value' ? <ValueInfo product={product} />
              : <StandardInfo product={product} />}
        {product.status !== 'SELLING' && <StatusBadge status={productBadge(product.status)} />}
        {variant === 'standard' && <ProductCouponHint productId={product.id} />}
      </div>
    </Link>
  )
}

const VARIANT_CLASS: Record<ProductCardVariant, string | undefined> = { standard: undefined, deal: styles.dealCard, compact: styles.compact, value: undefined }
const count = (n: number) => n.toLocaleString('ko-KR')

function StandardInfo({ product }: { product: Product }) {
  const shown = displayPrice(product)
  return <>
    {product.brand && <p className={styles.brand}>{product.brand}</p>}
    <p className={styles.name}>{product.name}</p>
    <div className={styles.prices}>
      {shown.before !== null && <del className={styles.original} aria-label={`할인 전 ${formatPrice(shown.before)}`}>{formatPrice(shown.before)}</del>}
      <p className={styles.price}>{shown.deal && <span className={styles.deal}>베리특가</span>}{formatPrice(shown.price)}</p>
    </div>
    <Rating product={product} />
    {(product.orderingCount != null || product.freeShipping) && <p className={styles.tags}>
      {product.orderingCount != null && <span className={[styles.tag, styles.live].join(' ')}>주문중 {count(product.orderingCount)}</span>}
      {shown.deal && product.viewingCount != null && <span className={[styles.tag, styles.live].join(' ')}>구경중 {count(product.viewingCount)}</span>}
      {product.freeShipping && <span className={styles.tag}>무료배송</span>}
    </p>}
  </>
}

/** 특가형: "베리특가 3시간 남음" 또는 "지금 40% 할인 중"을 맨 위에, 할인율과 가격을 크게 보인다. */
function DealInfo({ product, couponDiscount }: { product: Product; couponDiscount?: number }) {
  const shown = displayPrice(product)
  const rate = discountRate(shown.before, shown.price)
  const left = shown.deal && dealRemaining(shown.deal)
  const headline = shown.deal ? `베리특가${left ? ` ${left}` : ''}` : rate ? `지금 ${rate}% 할인 중` : null
  return <>
    {headline && <p className={styles.headline}><span className={styles.badge} aria-hidden="true">%</span><span>{headline}</span></p>}
    <p className={styles.name}>{product.name}</p>
    <div className={styles.prices}>
      {shown.before !== null && <del className={styles.original} aria-label={`할인 전 ${formatPrice(shown.before)}`}>{formatPrice(shown.before)}</del>}
      <p className={styles.price}>{rate && <span className={styles.rate}>{rate}%</span>}{formatPrice(shown.price)}</p>
    </div>
    <Rating product={product} short />
    {!!couponDiscount && <p className={styles.tags}><span className={[styles.tag, styles.coupon].join(' ')}>쿠폰 {formatPrice(couponDiscount)} 할인</span></p>}
  </>
}

/** 간결형: 이름 한 줄, 가격, 빠른 배송. 좁은 칸에서 여러 개를 훑어볼 때 쓴다. */
function CompactInfo({ product }: { product: Product }) {
  const shown = displayPrice(product)
  return <>
    <p className={[styles.name, styles.oneLine].join(' ')}>{product.name}</p>
    <p className={styles.priceLine}>
      <span className={styles.price}>{formatPrice(shown.price)}</span>
      {product.delivery && <span className={styles.delivery}>{DELIVERY_LABEL[product.delivery]}</span>}
    </p>
  </>
}

/** 가성비형: 단위가격과 배송, 반품 혜택을 보여 준다. 식품, 생활용품처럼 양과 묶음을 비교하는 상품에 쓴다. */
function ValueInfo({ product }: { product: Product }) {
  const shown = displayPrice(product)
  const unit = unitPriceLabel(product.netContent, shown.price)
  return <>
    <p className={styles.name}>{product.name}</p>
    <div className={styles.prices}>
      <p className={styles.price}>{shown.deal && <span className={styles.deal}>베리특가</span>}{formatPrice(shown.price)}</p>
      {unit && <p className={styles.unit}>{unit}</p>}
    </div>
    {(product.delivery || product.freeShipping || product.freeReturn) && <p className={styles.tags}>
      {product.delivery && <span className={styles.delivery}>{DELIVERY_LABEL[product.delivery]}</span>}
      {product.freeShipping && <span className={[styles.tag, styles.benefit].join(' ')}>무료배송</span>}
      {product.freeReturn && <span className={styles.tag}>무료반품</span>}
    </p>}
    <Rating product={product} />
  </>
}

/** ★ 93% 만족 | 리뷰 823. short 면 ★ 93% (823). 리뷰가 없으면 그리지 않는다. */
function Rating({ product, short = false }: { product: Product; short?: boolean }) {
  const satisfied = satisfiedPercent(product.satisfaction)
  if (satisfied === null) return null
  const reviews = count(reviewCount(product.satisfaction))
  return <p className={styles.rating}>
    <svg viewBox="0 0 24 24" className={styles.star} aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" /></svg>
    {short ? <span aria-label={`${satisfied}% 만족, 리뷰 ${reviews}`}>{satisfied}% <span className={styles.count}>({reviews})</span></span>
      : <><span>{satisfied}% 만족</span><span className={styles.reviews}>리뷰 {reviews}</span></>}
  </p>
}
