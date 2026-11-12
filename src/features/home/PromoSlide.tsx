import { ButtonLink } from '../../components/ui'
import type { Promo } from './promos'
import styles from './PromoSlide.module.css'

/** 기획전 배너 한 장. 내용은 promos.ts 에서 정한다. */
export function PromoSlide({ promo }: { promo: Promo }) {
  return <section className={[styles.promo, styles[promo.tone]].join(' ')} aria-label={`기획전: ${promo.title.join(' ')}`}>
    <div className={styles.text}>
      <p className={styles.eyebrow}>{promo.eyebrow}</p>
      <span className={styles.rule} aria-hidden="true" />
      <h2 className={styles.title}>{promo.title.map(line => <span key={line}>{line}</span>)}</h2>
      <p className={styles.description}>{promo.description}</p>
      <ButtonLink to={promo.to} variant="secondary" className={styles.cta}>{promo.cta} →</ButtonLink>
    </div>
    <div className={styles.art} aria-hidden="true"><span /><span /><span /></div>
  </section>
}

