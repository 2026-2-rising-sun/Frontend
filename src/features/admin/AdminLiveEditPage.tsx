import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { ChevronDownIcon } from '../../components/icons'
import { Alert, Button, ButtonLink, Input, Select, Skeleton, StatusBadge, Textarea, liveBadge, productBadge } from '../../components/ui'
import { LIVE_DESCRIPTION_MAX, LIVE_TITLE_MAX } from '../../domain/constraints'
import type { AdminLive } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice, fromKstInputValue, toKstInputValue } from '../../lib/format'
import { ActionAlert } from './components/ActionAlert'
import { AdminSection } from './components/AdminSection'
import { useAction } from './useAction'
import styles from './admin.module.css'

/** 방송 등록(/admin/lives/new) 과 편집(/admin/lives/:id) 을 한 화면으로 처리한다. */
export function AdminLiveEditPage() {
  const { liveId } = useParams()
  const api = useApi()
  const location = useLocation()
  const [flash, setFlash] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null)
  const live = useAsync(() => (liveId ? api.admin.lives.get(liveId) : Promise.resolve(null)), [api, liveId])

  return (
    <>
      <div className={styles.pageHead}>
        <Link to="/admin/lives" className={styles.back}>
          ← 방송 목록
        </Link>
        <div className={styles.pageTitle}>
          <h1 className="t-h1">{liveId ? '방송 편집' : '방송 등록'}</h1>
          {live.data && <StatusBadge status={liveBadge(live.data.status)} label={live.data.status === 'READY' ? '준비 중' : undefined} />}
        </div>
      </div>
      {flash && <Alert type="success" title={flash} />}
      <AsyncView state={live} skeleton={<Skeleton height={320} radius={14} />}>
        {(l) => <LiveEditor key={`${l?.id ?? 'new'}:${l?.version ?? 0}:${l?.status ?? ''}`} live={l} reload={live.reload} onDone={setFlash} />}
      </AsyncView>
    </>
  )
}

interface EditorProps {
  reload: () => void
  onDone: (message: string | null) => void
}

function LiveEditor({ live, reload, onDone }: EditorProps & { live: AdminLive | null }) {
  return (
    <>
      {live && live.status !== 'READY' && (
        <Alert type="info" title={live.status === 'LIVE' ? '진행 중인 방송이에요' : '종료된 방송이에요'}>
          {live.status === 'LIVE' ? '기본정보와 상품 연결은 수정할 수 없고, 상품 노출 순서만 바꿀 수 있어요.' : '종료된 방송은 조회만 할 수 있어요.'}
        </Alert>
      )}
      <BasicSection live={live} reload={reload} onDone={onDone} />
      {live && <ProductsSection live={live} reload={reload} onDone={onDone} />}
      {live && <ControlSection live={live} reload={reload} onDone={onDone} />}
    </>
  )
}

function BasicSection({ live, reload, onDone }: EditorProps & { live: AdminLive | null }) {
  const api = useApi()
  const navigate = useNavigate()
  const { busy, error, run } = useAction()
  const editable = !live || live.status === 'READY'
  const [title, setTitle] = useState(live?.title ?? '')
  const [description, setDescription] = useState(live?.description ?? '')
  const [scheduled, setScheduled] = useState(live ? toKstInputValue(live.scheduledAt) : '')
  const [playbackUrl, setPlaybackUrl] = useState(live?.playbackUrl ?? '')
  const [attempted, setAttempted] = useState(false)

  const errors = {
    title: !title.trim() ? '방송 제목을 입력해 주세요.' : title.length > LIVE_TITLE_MAX ? `${LIVE_TITLE_MAX}자 이하로 입력해 주세요.` : '',
    scheduled: !scheduled ? '예정 시작 시각을 입력해 주세요.' : '',
    playbackUrl: !playbackUrl.trim() ? '시청 연결 정보를 입력해 주세요.' : !/^https?:\/\//i.test(playbackUrl.trim()) ? 'http(s):// 로 시작하는 재생 주소를 입력해 주세요.' : '',
  }
  const show = (key: keyof typeof errors) => (attempted && errors[key] ? errors[key] : undefined)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    onDone(null)
    if (Object.values(errors).some(Boolean)) return
    const input = { title, description, scheduledAt: fromKstInputValue(scheduled), playbackUrl }
    if (!live) {
      let createdId = ''
      const ok = await run('save', async () => {
        createdId = (await api.admin.lives.create(input)).id
      })
      // 상품 연결 없이도 준비 중 방송은 저장할 수 있다. 이어서 같은 방송에서 상품을 연결한다.
      if (ok) navigate(`/admin/lives/${createdId}`, { replace: true, state: { notice: '방송을 등록했어요(준비 중). 이어서 상품을 연결해 주세요.' } })
    } else if (await run('save', () => api.admin.lives.update(live.id, { ...input, version: live.version }))) {
      onDone('방송 기본정보를 저장했어요.')
      reload()
    }
  }

  return (
    <AdminSection title="기본정보" description="방송 제목·예정 시각·시청 연결 정보. 방송을 등록해도 영상 송출이 시작되는 것은 아니에요.">
      <form className={styles.form} onSubmit={submit} noValidate>
        <ActionAlert error={error} onReload={reload} />
        <Input label="방송 제목" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} error={show('title')} placeholder="예: 가을 신상 이어폰 특가 라이브" />
        <Textarea label="방송 설명 (선택)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={LIVE_DESCRIPTION_MAX} disabled={!editable} />
        <Input
          label="예정 시작 시각"
          type="datetime-local"
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
          disabled={!editable}
          error={show('scheduled')}
          helper="한국 시간 기준이에요. 예정 시각이 되어도 자동으로 시작되지 않아요."
        />
        <Input
          label="AWS IVS 시청 연결 정보"
          value={playbackUrl}
          onChange={(e) => setPlaybackUrl(e.target.value)}
          disabled={!editable}
          error={show('playbackUrl')}
          placeholder="https://….playback.live-video.net/api/video/v1/….m3u8"
          helper="IVS 채널의 재생(Playback) URL을 입력하세요. 스트림 키 같은 송출용 비밀 정보는 입력하지 않아요. (시연 화면: 입력값 형식만 확인하고 실제 IVS 연결은 하지 않아요.)"
        />
        {editable && (
          <div className={styles.actions}>
            <Button type="submit" disabled={busy !== null}>
              {busy === 'save' ? '저장 중…' : live ? '기본정보 저장' : '방송 등록'}
            </Button>
          </div>
        )}
      </form>
    </AdminSection>
  )
}

function ProductsSection({ live, reload, onDone }: EditorProps & { live: AdminLive }) {
  const api = useApi()
  const { busy, error, run } = useAction()
  const canLink = live.status === 'READY'
  const canReorder = live.status !== 'ENDED'
  const [selected, setSelected] = useState('')

  const candidates = useAsync(() => (canLink ? api.products.list({ size: 100 }).then((p) => p.items) : Promise.resolve([])), [api, canLink, live.version])
  const options = (candidates.data ?? []).filter((p) => !live.products.some((l) => l.id === p.id))

  const finish = async (key: string, fn: () => Promise<unknown>, message: string) => {
    onDone(null)
    if (await run(key, fn)) {
      onDone(message)
      reload()
    }
  }

  const move = (index: number, delta: -1 | 1) => {
    const ids = live.products.map((p) => p.id)
    const [item] = ids.splice(index, 1)
    ids.splice(index + delta, 0, item)
    void finish('reorder', () => api.admin.lives.reorderProducts(live.id, ids), '노출 순서를 저장했어요.')
  }

  return (
    <AdminSection
      title="연결 상품"
      description="방송에서 소개할 상품과 노출 순서. 판매 중·품절인 공개 상품만 연결할 수 있고, 연결해도 상품·재고는 복제되지 않아요."
      aside={<span className={styles.hint}>{live.products.length}개</span>}
    >
      <div className={styles.form}>
        <ActionAlert error={error} onReload={reload} />

        {live.products.length === 0 ? (
          <p className={styles.hint}>연결된 상품이 없어요. 상품 없이도 준비 중 방송으로 저장할 수 있지만, 방송을 시작하려면 판매 가능한 상품이 1개 이상 필요해요.</p>
        ) : (
          <div className={styles.notice}>
            {live.products.map((p, i) => (
              <div key={p.id} className={styles.linked}>
                <span className={styles.linkedIndex}>{i + 1}</span>
                <div className={styles.linkedText}>
                  <span className={styles.rowName}>{p.name}</span>
                  <span className={styles.rowMeta}>{formatPrice(p.price)}</span>
                </div>
                <StatusBadge status={productBadge(p.status)} />
                {canReorder && (
                  <>
                    <button type="button" className={`${styles.iconBtn} ${styles.flip}`} aria-label={`${p.name} 위로`} disabled={busy !== null || i === 0} onClick={() => move(i, -1)}>
                      <ChevronDownIcon size={16} />
                    </button>
                    <button type="button" className={styles.iconBtn} aria-label={`${p.name} 아래로`} disabled={busy !== null || i === live.products.length - 1} onClick={() => move(i, 1)}>
                      <ChevronDownIcon size={16} />
                    </button>
                  </>
                )}
                {canLink && (
                  <Button size="S" variant="secondary" disabled={busy !== null} onClick={() => finish('unlink', () => api.admin.lives.unlinkProduct(live.id, p.id), `'${p.name}' 연결을 해제했어요.`)}>
                    해제
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canLink && (
          <div className={styles.addRow}>
            <Select
              aria-label="연결할 상품"
              value={selected}
              onChange={setSelected}
              options={[{ value: '', label: candidates.loading && !candidates.data ? '불러오는 중…' : '연결할 상품 선택' }, ...options.map((p) => ({ value: p.id, label: `${p.name} (${productBadgeLabel(p.status)})` }))]}
            />
            <Button
              variant="tonal"
              disabled={busy !== null || !selected}
              onClick={() => finish('link', () => api.admin.lives.linkProduct(live.id, selected), '상품을 연결했어요.').then(() => setSelected(''))}
            >
              상품 연결
            </Button>
          </div>
        )}
        {canLink && candidates.error && <p className={styles.hint}>연결 가능한 상품을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
      </div>
    </AdminSection>
  )
}

const productBadgeLabel = (status: 'READY' | 'SELLING' | 'SOLD_OUT' | 'HIDDEN') => (status === 'SOLD_OUT' ? '품절' : '판매 중')

function ControlSection({ live, reload, onDone }: EditorProps & { live: AdminLive }) {
  const api = useApi()
  const { busy, error, run } = useAction()
  const [confirmEnd, setConfirmEnd] = useState(false)

  const sellable = live.products.some((p) => p.status === 'SELLING' && p.stock > 0)
  const hasPlayback = !!live.playbackUrl

  const act = async (key: 'start' | 'end') => {
    onDone(null)
    if (await run(key, () => (key === 'start' ? api.admin.lives.start(live.id) : api.admin.lives.end(live.id)))) {
      onDone(key === 'start' ? '방송을 시작했어요. 이제 공개 방송 목록에서 진행 중으로 보여요.' : '방송을 종료했어요. 소개된 상품은 계속 구매할 수 있어요.')
      reload()
    }
  }

  return (
    <AdminSection title="방송 진행">
      <div className={styles.form}>
        <ActionAlert error={error} onReload={reload} />

        {live.status === 'READY' && (
          <>
            <ul className={styles.notice}>
              <li className={styles.hint}>{hasPlayback ? '✓' : '✗'} 시청 연결 정보 입력</li>
              <li className={styles.hint}>{sellable ? '✓' : '✗'} 판매 가능한 연결 상품 1개 이상 (판매 중이며 재고가 있어야 해요)</li>
            </ul>
            <div className={styles.actions}>
              <Button disabled={busy !== null} onClick={() => act('start')}>
                {busy === 'start' ? '시작하는 중…' : '방송 시작'}
              </Button>
            </div>
            <p className={styles.hint}>서비스의 진행 상태만 바뀌며, 실제 영상 송출 시작·중단은 IVS 쪽에서 따로 확인해요.</p>
          </>
        )}

        {live.status === 'LIVE' && (
          <>
            <div className={styles.actions}>
              <ButtonLink to={`/lives/${live.id}`} variant="tonal">
                시청 화면 열기
              </ButtonLink>
              {!confirmEnd && (
                <Button variant="danger" disabled={busy !== null} onClick={() => setConfirmEnd(true)}>
                  방송 종료
                </Button>
              )}
            </div>
            {confirmEnd && (
              <Alert type="warning" title="방송을 종료할까요?">
                종료하면 다시 시작할 수 없어요. 상품 판매·기존 주문에는 영향이 없어요.
                <div className={styles.actions} style={{ marginTop: 8 }}>
                  <Button variant="danger" size="S" disabled={busy !== null} onClick={() => act('end')}>
                    {busy === 'end' ? '종료하는 중…' : '종료 확정'}
                  </Button>
                  <Button variant="secondary" size="S" disabled={busy !== null} onClick={() => setConfirmEnd(false)}>
                    취소
                  </Button>
                </div>
              </Alert>
            )}
          </>
        )}

        {live.status === 'ENDED' && (
          <div className={styles.actions}>
            <ButtonLink to={`/lives/${live.id}`} variant="tonal">
              공개 화면에서 보기
            </ButtonLink>
          </div>
        )}
      </div>
    </AdminSection>
  )
}
