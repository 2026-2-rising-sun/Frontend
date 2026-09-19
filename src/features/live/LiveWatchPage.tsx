import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Button, Skeleton, Tabs } from '../../components/ui'
import { UserIcon } from '../../components/icons'
import { useAsync } from '../../hooks/useAsync'
import { formatDateTime, formatTime } from '../../lib/format'
import { LivePlayer } from './components/LivePlayer'
import { LiveProductItem } from './components/LiveProductItem'
import styles from './LiveWatchPage.module.css'

/**
 * 방송 상품(가격·품절·순서·비공개)을 다시 조회하는 주기.
 * 명세: 자동 갱신 주기는 팀이 정하며 초 단위 실시간을 보장하지 않는다. → 합의 전까지의 임시값이며 이 상수만 바꾸면 된다.
 * 구매 진입과 주문 생성 때는 항상 서버에서 다시 검증한다.
 */
const PRODUCT_REFRESH_MS = 15_000

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

  // 방송 상품 영역만 주기적으로 다시 조회한다. (탭이 보일 때만, 종료된 방송은 제외)
  const liveStatus = live.data?.status
  const reloadProducts = products.reload
  useEffect(() => {
    if (!liveStatus || liveStatus === 'ENDED') return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') reloadProducts()
    }, PRODUCT_REFRESH_MS)
    return () => clearInterval(timer)
  }, [liveStatus, reloadProducts])

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
          {tab === 'products' && (
            <div className={styles.refresh}>
              <span>
                {products.updatedAt ? `${formatTime(products.updatedAt)} 기준` : '불러오는 중'}
                {liveStatus && liveStatus !== 'ENDED' ? ` · ${PRODUCT_REFRESH_MS / 1000}초마다 자동 갱신` : ''}
              </span>
              <Button variant="tonal" size="S" onClick={products.reload}>
                새로고침
              </Button>
            </div>
          )}
          {tab === 'products' && products.error && products.data && (
            <p role="alert" className={styles.staleWarning}>
              최신 상품 정보를 확인하지 못했어요. 표시된 가격·재고는 이전 정보일 수 있어요.
            </p>
          )}
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
