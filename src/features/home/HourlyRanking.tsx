import { useEffect, useState } from 'react'
import { useApi } from '../../app/apiContext'
import { Button, InfoTip } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { ProductCard } from '../shopping/components/ProductCard'
import { ProductGridSkeleton } from '../shopping/components/ProductGrid'
import { loadRanking, msUntilNextHour, rankingHour } from '../shopping/rankingProducts'
import styles from './HomeSections.module.css'

const SIZE = 10
const INFO = '라이브 진행 중인 상품의 구매자수와 구매 금액이 높은 기준으로 시간마다 업데이트됩니다.'

/** 정각마다 바뀌는 현재 시각. 정각이 되면 순위를 다시 불러오는 기준이 된다. */
function useHourlyNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setTimeout(() => setNow(new Date()), msUntilNextHour(now))
    return () => clearTimeout(timer)
  }, [now])
  return now
}

/** ⓘ 안내. 마우스를 올리거나 키보드로 포커스하면 열리고, 누르면 고정, X 나 Esc 로 닫는다. */
/** "OO시 기준 판매 인기". 판매 인기 상위 10개를 매 정각 다시 불러온다. */
export function HourlyRanking() {
  const api = useApi()
  const now = useHourlyNow()
  const hour = rankingHour(now)
  const ranking = useAsync(() => loadRanking(api, undefined, SIZE), [api, now])

  return <section className={styles.section} aria-labelledby="hourly-heading">
    <div className={styles.subHead}>
      <h2 id="hourly-heading" className={styles.subTitle}>오늘 {hour}시 기준 판매 인기</h2>
      <InfoTip id="hourly-info" label="판매 인기 기준 안내">{INFO}</InfoTip>
    </div>
    {!ranking.data && !ranking.error ? <ProductGridSkeleton count={SIZE} />
      : ranking.error && !ranking.data ? <div className={styles.empty}><p>판매 인기 상품을 불러오지 못했어요.</p><Button variant="secondary" size="S" onClick={ranking.reload}>순위 다시 조회</Button></div>
        : !ranking.data?.length ? <p className={styles.empty}>순위에 올릴 상품이 아직 없어요.</p>
          : <ol className={styles.ranking}>{ranking.data.map((product, index) => <li key={product.id} className={styles.item}>
            <span className={styles.rank} aria-label={`${index + 1}위`}>{index + 1}</span>
            <ProductCard product={product} variant="random" />
          </li>)}</ol>}
  </section>
}
