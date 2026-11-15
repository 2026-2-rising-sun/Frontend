import { Link } from 'react-router-dom'
import { ChevronRightIcon } from '../../components/icons'
import { brandSearchPath, type BrandBannerAd } from './brandBanners'
import styles from './BrandBanner.module.css'

/** 섹션 사이 브랜드 띠 배너. 왼쪽에 그림, 오른쪽에 문구와 해시태그, 누르면 브랜드 상품 검색으로 간다. */
export function BrandBanner({ ad }: { ad: BrandBannerAd }) {
  return <aside className={styles.banner} aria-label="브랜드 광고">
    <Link to={brandSearchPath(ad.brand)} className={[styles.link, styles[ad.tone]].join(' ')}>
      <span className={styles.art} aria-hidden="true">{ad.art.map(emoji => <span key={emoji}>{emoji}</span>)}</span>
      <span className={styles.text}>
        <span className={styles.title}>{ad.lead} <strong>{ad.brand}</strong></span>
        <span className={styles.tags}>{ad.tags.map(tag => <span key={tag}>#{tag}</span>)}</span>
      </span>
      <ChevronRightIcon size={28} className={styles.arrow} aria-hidden="true" />
    </Link>
  </aside>
}
