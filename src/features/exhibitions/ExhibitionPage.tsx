import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { ButtonLink, ResultState, Skeleton, Tabs } from '../../components/ui'
import { exhibitionState, type Exhibition } from '../../domain/exhibitions'
import { useAsync } from '../../hooks/useAsync'
import { toKstInputValue } from '../../lib/format'
import { ProductGrid, ProductGridSkeleton } from '../shopping/components/ProductGrid'
import tones from './tones.module.css'
import styles from './ExhibitionPage.module.css'

const ALL = 'all'
/** "11/15" (한국 날짜) */
const kstDate = (iso: string) => { const [, month, day] = toKstInputValue(iso).slice(0, 10).split('-').map(Number); return `${month}/${day}` }

/** 테마 기획전 화면. 큰 배너 아래에 묶음 탭과 상품 카드를 보여 준다. */
export function ExhibitionPage() {
  const { exhibitionId = '' } = useParams()
  const api = useApi()
  const exhibition = useAsync(() => api.exhibitions.get(exhibitionId), [api, exhibitionId])
  return <PageContainer className={styles.page}>
    <AsyncView state={exhibition} skeleton={<><Skeleton height={220} radius={14} /><ProductGridSkeleton /></>}>
      {data => <ExhibitionView key={data.id} exhibition={data} />}
    </AsyncView>
  </PageContainer>
}

function ExhibitionView({ exhibition }: { exhibition: Exhibition }) {
  const [now] = useState(Date.now)
  const [tab, setTab] = useState(ALL)
  const state = exhibitionState(exhibition, now)
  const sections = exhibition.sections.filter(section => section.products.length)
  const shown = tab === ALL ? sections : sections.filter((_, index) => String(index) === tab)

  return <>
    <header className={[styles.hero, tones[exhibition.tone]].join(' ')}>
      <div className={styles.text}>
        <p className={styles.eyebrow}>기획전</p>
        <h1 className={styles.title}>{exhibition.title}</h1>
        <p className={styles.period}>{kstDate(exhibition.startsAt)} ~ {kstDate(exhibition.endsAt)}</p>
        <p className={styles.description}>{exhibition.description}</p>
      </div>
      <span className={styles.art} aria-hidden="true">{exhibition.art.join('')}</span>
    </header>
    {state === 'ENDED' ? <ResultState type="empty" title="종료된 기획전이에요" message="진행 중인 다른 기획전을 둘러보세요." action={<ButtonLink to="/exhibitions" variant="secondary">기획전 목록</ButtonLink>} />
      : state === 'UPCOMING' ? <ResultState type="empty" title="아직 시작 전인 기획전이에요" message={`${kstDate(exhibition.startsAt)}부터 볼 수 있어요.`} action={<ButtonLink to="/exhibitions" variant="secondary">기획전 목록</ButtonLink>} />
      : !sections.length ? <ResultState type="empty" title="기획전 상품을 준비하고 있어요" message="조금 뒤에 다시 들러 주세요." />
      : <>
        {sections.length > 1 && <div className={styles.tabs}><Tabs aria-label="기획전 묶음" value={tab} onChange={setTab} items={[{ value: ALL, label: '전체' }, ...sections.map((section, index) => ({ value: String(index), label: section.title }))]} /></div>}
        {shown.map(section => <section key={section.title} className={styles.section} aria-label={section.title}>
          <h2 className={styles.sectionTitle}>{section.title}</h2>
          <ProductGrid products={section.products} variant="random" />
        </section>)}
      </>}
  </>
}
