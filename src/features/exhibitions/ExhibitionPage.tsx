import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { ChevronRightIcon } from '../../components/icons'
import { ButtonLink, ResultState, Skeleton } from '../../components/ui'
import { exhibitionState, type Exhibition } from '../../domain/exhibitions'
import { useAsync } from '../../hooks/useAsync'
import { toKstInputValue } from '../../lib/format'
import { ExhibitionProductTile } from './ExhibitionProductTile'
import tones from './tones.module.css'
import styles from './ExhibitionPage.module.css'

/** 한국 날짜 조각 [연, 월, 일] */
const kstDay = (iso: string) => toKstInputValue(iso).slice(0, 10).split('-').map(Number)
const pad = (n: number) => String(n).padStart(2, '0')
/** "26.11.01" */
const fullDate = (iso: string) => { const [year, month, day] = kstDay(iso); return `${pad(year % 100)}.${pad(month)}.${pad(day)}` }
/** "11.1" */
const shortDate = (iso: string) => { const [, month, day] = kstDay(iso); return `${month}.${day}` }
/** 묶음 칸은 한 줄에 4칸이다. 마지막 줄은 빈 칸으로 채운다. */
const NAV_COLUMNS = 4

/**
 * 기획전 화면. 위에서부터 제목 줄(제목, 기간, 링크 복사), 세로로 긴 기획전 포스터,
 * 묶음 칸, 묶음마다 회색 제목 띠와 상품 목록이다. 묶음 칸에서 전체는 모든 묶음을, 묶음 하나를 고르면 그 묶음 상품만 보여 준다.
 */
export function ExhibitionPage() {
  const { exhibitionId = '' } = useParams()
  const api = useApi()
  const exhibition = useAsync(() => api.exhibitions.get(exhibitionId), [api, exhibitionId])
  return <PageContainer className={styles.page}>
    <AsyncView state={exhibition} skeleton={<><Skeleton height={32} width="40%" /><Skeleton height={640} radius={0} /></>}>
      {data => <ExhibitionView key={data.id} exhibition={data} />}
    </AsyncView>
  </PageContainer>
}

function ExhibitionView({ exhibition }: { exhibition: Exhibition }) {
  const [now] = useState(Date.now)
  const state = exhibitionState(exhibition, now)
  const sections = exhibition.sections.filter(section => section.products.length)
  const [selected, setSelected] = useState<number | null>(null)
  const id = (index: number) => `exhibition-section-${index}`
  const shown = sections.map((section, index) => ({ section, index })).filter(({ index }) => selected === null || index === selected)
  const navItems = [{ label: '전체', value: null }, ...sections.map((section, index) => ({ label: section.title, value: index as number | null }))]
  /** 전체는 모든 묶음을, 묶음을 고르면 그 묶음 상품만 보여 준다. 묶음 칸이 화면 맨 위에 오게 옮겨 다른 묶음도 바로 고를 수 있다. */
  function choose(value: number | null) {
    setSelected(value)
    document.getElementById('exhibition-nav')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const blanks = (NAV_COLUMNS - navItems.length % NAV_COLUMNS) % NAV_COLUMNS

  return <>
    <header className={styles.top}>
      <h1 className={styles.title}>{exhibition.title}</h1>
      <div className={styles.meta}>
        <span className={styles.period} aria-label={`기간 ${fullDate(exhibition.startsAt)}부터 ${fullDate(exhibition.endsAt)}까지`}>{fullDate(exhibition.startsAt)} - {fullDate(exhibition.endsAt)}</span>
        <CopyLink />
      </div>
    </header>

    <div className={[styles.poster, tones[exhibition.tone]].join(' ')}>
      <span className={styles.art} aria-hidden="true">{exhibition.art.join('')}</span>
      <div className={styles.posterText}>
        <span className={styles.posterPeriod}>{shortDate(exhibition.startsAt)} - {shortDate(exhibition.endsAt)}</span>
        <strong className={styles.headline}>{exhibition.headline.map(line => <span key={line}>{line}</span>)}</strong>
        <span className={styles.description}>{exhibition.description}</span>
      </div>
    </div>

    {state === 'ENDED' ? <ResultState type="empty" title="종료된 기획전이에요" message="진행 중인 다른 기획전을 둘러보세요." action={<ButtonLink to="/exhibitions" variant="secondary">기획전 목록</ButtonLink>} />
      : state === 'UPCOMING' ? <ResultState type="empty" title="아직 시작 전인 기획전이에요" message={`${shortDate(exhibition.startsAt)}부터 볼 수 있어요.`} action={<ButtonLink to="/exhibitions" variant="secondary">기획전 목록</ButtonLink>} />
      : !sections.length ? <ResultState type="empty" title="기획전 상품을 준비하고 있어요" message="조금 뒤에 다시 들러 주세요." />
      : <>
        <nav id="exhibition-nav" className={styles.nav} aria-label="기획전 묶음">
          {navItems.map(item => <button key={item.label} type="button" className={styles.navItem} aria-pressed={selected === item.value} onClick={() => choose(item.value)}>
            <span>{item.label}</span><ChevronRightIcon size={14} />
          </button>)}
          {Array.from({ length: blanks }, (_, i) => <span key={i} className={styles.navItem} aria-hidden="true" />)}
        </nav>
        <div id="exhibition-sections" className={styles.sections}>
          {shown.map(({ section, index }) => <section key={section.title} id={id(index)} className={styles.section} aria-labelledby={`${id(index)}-title`}>
            <h2 id={`${id(index)}-title`} className={styles.sectionTitle}>{section.title}</h2>
            <ul className={styles.grid}>
              {section.products.map(product => <li key={product.id}><ExhibitionProductTile product={product} /></li>)}
            </ul>
          </section>)}
        </div>
      </>}
  </>
}

/** 지금 화면 주소를 복사한다. 복사하지 못하면(권한 없음 등) 알려 준다. */
function CopyLink() {
  const [status, setStatus] = useState<'idle' | 'done' | 'failed'>('idle')
  async function copy() {
    try { await navigator.clipboard.writeText(window.location.href); setStatus('done') }
    catch { setStatus('failed') }
  }
  return <>
    <button type="button" className={styles.share} onClick={() => void copy()}>URL</button>
    <span className={styles.copied} role="status">{status === 'done' ? '주소를 복사했어요' : status === 'failed' ? '복사하지 못했어요' : ''}</span>
  </>
}
