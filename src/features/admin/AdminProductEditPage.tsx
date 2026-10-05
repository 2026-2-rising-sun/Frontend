import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { Alert, Button, ButtonLink, ImageUpload, Input, Skeleton, StatusBadge, Textarea, adminProductBadge } from '../../components/ui'
import { PRODUCT_DESCRIPTION_MAX, PRODUCT_NAME_MAX } from '../../domain/constraints'
import type { AdminProduct, SaleAction } from '../../domain/types'
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import { ActionAlert } from './components/ActionAlert'
import { AdminSection } from './components/AdminSection'
import { useAction } from './useAction'
import styles from './admin.module.css'

/** 상품 등록(/admin/products/new) 과 수정(/admin/products/:id) 을 한 화면으로 처리한다. */
export function AdminProductEditPage() {
  const { productId } = useParams()
  const api = useApi()
  const location = useLocation()
  const initialNotice = (location.state as { notice?: string } | null)?.notice ?? null
  // 저장 후 상품을 다시 불러오면 섹션이 새로 만들어지므로, 성공 안내는 이 화면이 들고 있는다.
  const [flash, setFlash] = useState<string | null>(initialNotice)
  const product = useAsync(() => (productId ? api.admin.products.get(productId) : Promise.resolve(null)), [api, productId])

  return (
    <>
      <div className={styles.pageHead}>
        <Link to="/admin/products" className={styles.back}>
          ← 상품 목록
        </Link>
        <h1 className="t-h1">{productId ? '상품 수정' : '상품 등록'}</h1>
      </div>
      {flash && <Alert type="success" title={flash} />}
      <AsyncView state={product} skeleton={<Skeleton height={320} radius={14} />}>
        {(p) => (
          <ProductEditor
            key={`${p?.id ?? 'new'}:${p?.version ?? 0}:${p?.status ?? ''}:${p?.stock ?? ''}:${p?.price ?? ''}`}
            product={p}
            reload={product.reload}
            onDone={setFlash}
          />
        )}
      </AsyncView>
    </>
  )
}

interface EditorProps {
  reload: () => void
  /** 성공 안내를 화면 상단에 띄운다 */
  onDone: (message: string | null) => void
}

function ProductEditor({ product, reload, onDone }: EditorProps & { product: AdminProduct | null }) {
  return (
    <>
      <BasicInfoSection product={product} reload={reload} onDone={onDone} />
      {product && <SaleInfoSection product={product} reload={reload} onDone={onDone} />}
      {product && <SaleStatusSection product={product} reload={reload} onDone={onDone} />}
    </>
  )
}

function BasicInfoSection({ product, reload, onDone }: EditorProps & { product: AdminProduct | null }) {
  const api = useApi()
  const navigate = useNavigate()
  const { busy, error, run } = useAction()
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const keyFor = useIdempotencyKey()
  const [image, setImage] = useState<File | null>(null)
  const [attempted, setAttempted] = useState(false)

  const nameError = !name.trim() ? '상품명을 입력해 주세요.' : name.length > PRODUCT_NAME_MAX ? `${PRODUCT_NAME_MAX}자 이하로 입력해 주세요.` : ''
  const descError = !description.trim() ? '상품 설명을 입력해 주세요.' : description.length > PRODUCT_DESCRIPTION_MAX ? `${PRODUCT_DESCRIPTION_MAX}자 이하로 입력해 주세요.` : ''

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    onDone(null)
    if (nameError || descError) return
    if (!product) {
      let createdId = ''
      const ok = await run('save', async () => {
        const created = await api.admin.products.create({ name, description, image, idempotencyKey: keyFor({ name, description, image: image ? [image.name, image.size, image.lastModified] : null }) })
        createdId = created.id
      })
      // 기본정보만 저장된 상품(DRAFT)은 공개·주문 대상이 아니다. 이어서 같은 상품의 판매 설정으로 안내한다.
      if (ok) navigate(`/admin/products/${createdId}`, { replace: true, state: { notice: '기본정보를 등록했어요. 이어서 판매 설정(가격·재고)을 해 주세요.' } })
    } else {
      const ok = await run('save', () => api.admin.products.updateBasicInfo(product.id, { name, description, image, version: product.version }))
      if (ok) {
        onDone('기본정보를 저장했어요.')
        reload()
      }
    }
  }

  return (
    <AdminSection title="기본정보" description="상품명·설명·대표 이미지. 가격·재고는 아래 판매 설정에서 관리해요.">
      <form className={styles.form} onSubmit={submit} noValidate>
        <ActionAlert error={error} onReload={reload} />
        <Input label="상품명" value={name} onChange={(e) => setName(e.target.value)} maxLength={PRODUCT_NAME_MAX + 20} placeholder="예: 무선 노이즈캔슬링 이어폰" error={attempted ? nameError || undefined : undefined} />
        <Textarea label="상품 설명" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={PRODUCT_DESCRIPTION_MAX} error={attempted ? descError || undefined : undefined} />
        <ImageUpload
          label="대표 이미지"
          file={image}
          onChange={setImage}
          registered={product?.hasImage}
          disabled={busy !== null}
          note="저장할 때 대표 이미지를 업로드합니다."
        />
        <div className={styles.actions}>
          <Button type="submit" disabled={busy !== null}>
            {busy === 'save' ? '저장 중…' : product ? '기본정보 저장' : '기본정보 등록'}
          </Button>
        </div>
        {!product && <p className={styles.hint}>등록하면 &lsquo;기본정보만&rsquo; 상태가 되며, 판매 설정을 마치기 전까지는 공개 목록과 주문에 나타나지 않아요.</p>}
      </form>
    </AdminSection>
  )
}

function SaleInfoSection({ product, reload, onDone }: EditorProps & { product: AdminProduct }) {
  const api = useApi()
  const { busy, error, run } = useAction()
  const draft = product.status === 'DRAFT'
  const [price, setPrice] = useState(product.price !== null ? String(product.price) : '')
  const [stock, setStock] = useState(product.status === 'DRAFT' && product.stock !== null ? String(product.stock) : '')

  const toInt = (v: string) => (v.trim() === '' ? NaN : Number(v))
  const priceError = price !== '' && !(Number.isInteger(toInt(price)) && toInt(price) > 0) ? '1원 이상의 정수로 입력해 주세요.' : undefined
  const stockError = stock !== '' && !(Number.isSafeInteger(toInt(stock)) && (!draft || toInt(stock) >= 0)) ? draft ? '0 이상의 정수로 입력해 주세요.' : '증감 수량을 정수로 입력해 주세요.' : undefined

  const done = (text: string) => async (fn: () => Promise<unknown>, key: string) => {
    onDone(null)
    if (await run(key, fn)) {
      onDone(text)
      reload()
    }
  }

  return (
    <AdminSection
      title="판매 설정"
      description={draft ? '가격과 최초 재고를 설정하면 판매 준비 상태가 돼요. 아직 공개·주문 대상은 아니에요.' : '가격은 새로 생기는 주문부터 적용되고, 이미 만든 주문 금액은 바뀌지 않아요.'}
    >
      <div className={styles.form}>
        <ActionAlert error={error} onReload={reload} />
        {!draft && !product.salesId && <Alert type="info" title="기존 판매 설정 변경은 준비 중이에요">판매정보 ID 조회가 제공되면 가격·재고·판매 상태를 변경할 수 있어요. 현재 브라우저에서 새로 설정한 상품은 변경할 수 있어요.</Alert>}
        {draft ? (
          <>
            <div className={`${styles.formRow} ${styles.formRow2}`}>
              <Input label="판매 가격(원)" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} error={priceError} placeholder="129000" />
              <Input label="최초 재고(개)" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} error={stockError} placeholder="10" />
            </div>
            <div className={styles.actions}>
              <Button
                disabled={busy !== null || !!priceError || !!stockError || price === '' || stock === ''}
                onClick={() => done('판매 설정을 저장했어요. 판매 준비 상태예요.')(() => api.admin.products.setSaleInfo(product.id, { price: toInt(price), stock: toInt(stock) }), 'sale')}
              >
                {busy === 'sale' ? '저장 중…' : '판매 설정 저장'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.formRow}>
              <Input label={`판매 가격(원) — 현재 ${formatPrice(product.price ?? 0)}`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} error={priceError} />
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  disabled={!product.salesId || busy !== null || !!priceError || price === '' || toInt(price) === product.price}
                  onClick={() => done('가격을 변경했어요. 새 주문부터 적용돼요.')(() => api.admin.products.changePrice(product.id, toInt(price)), 'price')}
                >
                  {busy === 'price' ? '변경 중…' : '가격 변경'}
                </Button>
              </div>
            </div>
            <div className={styles.formRow}>
              <Input label={`재고 증감량(개) — 현재 ${product.stock ?? 0}`} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} error={stockError} helper="추가는 양수, 감소는 음수로 입력하세요. 현재 재고에 증감량을 적용합니다." />
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  disabled={!product.salesId || busy !== null || !!stockError || stock === '' || toInt(stock) === 0}
                  onClick={() => done('재고를 수정했어요.')(() => api.admin.products.adjustStock(product.id, toInt(stock)), 'stock')}
                >
                  {busy === 'stock' ? '수정 중…' : '재고 수정'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminSection>
  )
}

const ACTION_COPY: Record<SaleAction, { label: string; done: string }> = {
  START_SALE: { label: '판매 시작', done: '판매를 시작했어요. 이제 공개 목록에 보여요.' },
  HIDE: { label: '비공개로 전환', done: '비공개로 전환했어요. 신규 주문이 막혀요.' },
  RESUME: { label: '공개 재개', done: '공개를 재개했어요.' },
}

function SaleStatusSection({ product, reload, onDone }: EditorProps & { product: AdminProduct }) {
  const api = useApi()
  const { busy, error, run } = useAction()

  const act = async (action: SaleAction) => {
    onDone(null)
    if (await run(action, () => api.admin.products.changeSaleStatus(product.id, action))) {
      onDone(ACTION_COPY[action].done)
      reload()
    }
  }

  const status = product.status
  const publicNow = status === 'SELLING' || status === 'SOLD_OUT'

  return (
    <AdminSection title="판매 상태" aside={<StatusBadge status={adminProductBadge(status)} />}>
      <div className={styles.form}>
        <ActionAlert error={error} onReload={reload} />
        {status === 'DRAFT' && <p className={styles.hint}>판매 설정(가격·재고)을 저장하면 판매를 시작할 수 있어요.</p>}
        {status === 'READY' && (
          <>
            <ul className={styles.notice}>
              <li className={styles.hint}>{product.hasImage ? '✓' : '✗'} 대표 이미지 등록</li>
              <li className={styles.hint}>{(product.stock ?? 0) > 0 ? '✓' : '✗'} 판매 가능한 재고 1개 이상</li>
            </ul>
            <div className={styles.actions}>
              <Button disabled={!product.salesId || busy !== null} onClick={() => act('START_SALE')}>
                {busy === 'START_SALE' ? '처리 중…' : ACTION_COPY.START_SALE.label}
              </Button>
            </div>
          </>
        )}
        {publicNow && (
          <>
            <p className={styles.hint}>
              {status === 'SELLING' ? '공개 목록에서 구매할 수 있어요.' : '재고가 0이라 품절로 표시돼요. 재고를 추가하면 판매 중으로 돌아와요.'}
            </p>
            <div className={styles.actions}>
              <Button variant="secondary" disabled={!product.salesId || busy !== null} onClick={() => act('HIDE')}>
                {busy === 'HIDE' ? '처리 중…' : ACTION_COPY.HIDE.label}
              </Button>
              <ButtonLink to={`/products/${product.id}`} variant="tonal">
                공개 상세 보기
              </ButtonLink>
            </div>
          </>
        )}
        {status === 'HIDDEN' && (
          <>
            <p className={styles.hint}>공개 목록과 방송 상품 영역에서 제외되고 신규 주문이 막혀 있어요. 재고를 늘려도 자동으로 공개되지 않아요.</p>
            <div className={styles.actions}>
              <Button disabled={!product.salesId || busy !== null} onClick={() => act('RESUME')}>
                {busy === 'RESUME' ? '처리 중…' : ACTION_COPY.RESUME.label}
              </Button>
            </div>
          </>
        )}
      </div>
    </AdminSection>
  )
}
