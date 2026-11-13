import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ADS_PER_PAGE, HOME_ADS } from './homeAds'
import { PageNumbers } from './PageNumbers'
import styles from './ExclusiveAds.module.css'

/** "오직 베리온에서만" 광고 배너. 3개씩 보이고 페이지 번호를 눌러 다음 3개로 넘긴다. */
export function ExclusiveAds() {
  const [page, setPage] = useState(0)
  const pages = Math.ceil(HOME_ADS.length / ADS_PER_PAGE)
  const shown = HOME_ADS.slice(page * ADS_PER_PAGE, page * ADS_PER_PAGE + ADS_PER_PAGE)
  return <section className={styles.section} aria-labelledby="ads-heading">
    <div className={styles.head}>
      <h2 id="ads-heading" className={styles.title}>오직 베리온에서만</h2>
      <div className={styles.pager}><PageNumbers label="광고 페이지" count={pages} current={page} onChange={setPage} /></div>
    </div>
    <ul className={styles.ads}>
      {shown.map(ad => <li key={ad.key}>
        <Link to={ad.to} className={[styles.ad, styles[ad.tone]].join(' ')}>
          <span className={styles.text}>
            <strong className={styles.adTitle}>{ad.title.map(line => <span key={line}>{line}</span>)}</strong>
            <span className={styles.description}>{ad.description}</span>
          </span>
          <span className={styles.art} aria-hidden="true">{ad.art.map(emoji => <span key={emoji}>{emoji}</span>)}</span>
        </Link>
      </li>)}
    </ul>
  </section>
}
