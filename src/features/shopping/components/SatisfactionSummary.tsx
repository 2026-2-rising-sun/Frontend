import { InfoTip } from '../../../components/ui'
import type { Satisfaction } from '../../../domain/types'
import { SATISFACTION_LEVELS, levelPercent, reviewCount, satisfiedPercent } from '../satisfaction'
import { Stars } from './Stars'
import styles from './SatisfactionSummary.module.css'

/** 상품 상세의 "상품 만족도". 만족 비율 한 줄과 4단계별 막대를 보여 준다. 가장 많이 고른 단계를 강조한다. */
export function SatisfactionSummary({ satisfaction }: { satisfaction: Satisfaction }) {
  const total = reviewCount(satisfaction)
  const satisfied = satisfiedPercent(satisfaction)
  const top = Math.max(...SATISFACTION_LEVELS.map(level => satisfaction[level.key]))
  return <section id="satisfaction" className={styles.section} aria-labelledby="satisfaction-heading">
    <div className={styles.head}>
      <h2 id="satisfaction-heading" className={styles.title}>상품 만족도</h2>
      <InfoTip id="satisfaction-info" label="상품 만족도 기준 안내">리뷰에서 "매우 만족해요" 또는 "만족해요"를 고른 구매자의 비율이에요.</InfoTip>
    </div>
    <div className={styles.box}>
      <p className={styles.summary}>{satisfied === null ? '아직 등록된 리뷰가 없어요.' : <><em>{satisfied}%</em>의 구매자가 만족했어요.</>}</p>
      {total > 0 && <dl className={styles.levels}>
        {SATISFACTION_LEVELS.map(level => {
          const percent = levelPercent(satisfaction, level.key)
          const strong = satisfaction[level.key] === top
          return <div key={level.key} className={[styles.level, strong && styles.strong].filter(Boolean).join(' ')}>
            <dt>{level.label}</dt>
            <dd className={styles.stars}><Stars filled={level.stars} tone={strong ? 'brand' : 'muted'} /></dd>
            <dd className={styles.bar}><span style={{ width: `${percent}%` }} /></dd>
            <dd className={styles.percent}>{percent}%</dd>
          </div>
        })}
      </dl>}
    </div>
  </section>
}
