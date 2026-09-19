import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Skeleton, Tabs } from '../../components/ui'
import { UserIcon } from '../../components/icons'
import { useAsync } from '../../hooks/useAsync'
import { formatDateTime } from '../../lib/format'
import { LivePlayer } from './components/LivePlayer'
import { LiveProductItem } from './components/LiveProductItem'
import styles from './LiveWatchPage.module.css'

type PanelTab = 'products' | 'about'

const TABS: { value: PanelTab; label: string }[] = [
  { value: 'products', label: '방송 상품' },
  { value: 'about', label: '방송 소개' },
]

/**
 * 방송 시청. 영상(방송 정보)과 방송 상품은 각각 조회하며 한쪽이 실패해도 다른 쪽은 유지된다.
 * 방송이 종료되어도 상품 구매에는 영향이 없다.
 */
export function LiveWatchPage() {
  const { liveId = '' } = useParams()
  const api = useApi()
  const [tab, setTab] = useState<PanelTab>('products')
  const live = useAsync(() => api.lives.get(liveId), [api, liveId])
  const products = useAsync(() => api.lives.listProducts(liveId), [api, liveId])

  return (
    <PageContainer className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.main}>
          <AsyncView state={live} skeleton={<Skeleton height={0} style={{ aspectRatio: '16 / 9', height: 'auto' }} radius={20} />}>
            {(l) => (
              <>
                <LivePlayer live={l} />
                <div className={styles.info}>
                  <h1 className="t-h2">{l.title}</h1>
                  <p className={styles.host}>
                    <span className={[styles.avatar, l.status === 'LIVE' && styles.avatarLive].filter(Boolean).join(' ')} aria-hidden="true">
                      <UserIcon size={18} />
                    </span>
                    {l.hostName} · {l.status === 'LIVE' ? '지금 방송 중' : l.status === 'READY' ? `${formatDateTime(l.scheduledAt)} 시작 예정` : '방송 종료'}
                  </p>
                </div>
              </>
            )}
          </AsyncView>
        </div>

        <aside className={styles.side} aria-label="방송 정보">
          <Tabs aria-label="방송 정보 탭" value={tab} items={TABS} onChange={setTab} />
          {tab === 'products' ? (
            <AsyncView
              state={products}
              skeleton={
                <div className={styles.list}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} height={88} radius={14} />
                  ))}
                </div>
              }
              isEmpty={(list) => list.length === 0}
              emptyTitle="연결된 상품이 없어요"
              emptyMessage="이 방송에는 아직 소개된 상품이 없어요."
            >
              {(list) => (
                <div className={styles.list}>
                  {list.map((p) => (
                    <LiveProductItem key={p.id} product={p} />
                  ))}
                </div>
              )}
            </AsyncView>
          ) : (
            <p className={styles.about}>{live.data?.description ?? '방송 소개를 불러오는 중이에요.'}</p>
          )}
        </aside>
      </div>
    </PageContainer>
  )
}
