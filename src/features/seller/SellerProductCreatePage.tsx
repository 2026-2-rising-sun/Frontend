import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { Alert, Button, ButtonLink, ImageUpload, Input, Textarea } from '../../components/ui'
import { PRODUCT_DESCRIPTION_MAX, PRODUCT_NAME_MAX } from '../../domain/constraints'
import { ApiError } from '../../domain/errors'
import {
  INITIAL_SKU_MAX, OPTION_LABEL_MAX, normalizeProductRegistration, parseProductCreateResult,
  restoreProductRegistration, validateProductRegistration, type ProductCreateResult,
} from '../../domain/productRegistration'
import { formatPrice } from '../../lib/format'
import { useSession } from '../auth/useSession'
import { SellerSection } from './components/SellerSection'
import { createProductRegistrationAttempt, UnresolvedProductRegistrationError } from './productRegistrationAttempt'
import { useAction } from './useAction'
import styles from './seller.module.css'

const blankSku = () => ({ id: crypto.randomUUID(), optionLabel: '', price: '', stock: '' })

export function SellerProductCreatePage() {
  const session = useSession()
  if (!session) return null
  return <ProductRegistrationForm key={session.memberId} sellerId={session.memberId} />
}

function ProductRegistrationForm({ sellerId }: { sellerId: string }) {
  const api = useApi()
  const [initial] = useState(() => {
    try {
      const attempt = createProductRegistrationAttempt(window.sessionStorage, sellerId)
      const snapshot = attempt.snapshot()
      return { attempt, snapshot, payload: snapshot ? restoreProductRegistration(snapshot.payload) : null,
        result: snapshot?.result ? parseProductCreateResult(snapshot.result) : null, error: null }
    } catch (e) {
      return { attempt: null, snapshot: null, payload: null, result: null,
        error: e instanceof Error ? e.message : '등록 복구 기록을 읽지 못했어요.' }
    }
  })
  const [name, setName] = useState(initial.payload?.name ?? '')
  const [description, setDescription] = useState(initial.payload?.description ?? '')
  const [skus, setSkus] = useState(() => initial.payload?.skus.map(sku => ({ id: crypto.randomUUID(), optionLabel: sku.optionLabel ?? '', price: String(sku.price), stock: String(sku.initialStock) })) ?? [blankSku()])
  const [image, setImage] = useState<File | null>(null)
  const [result, setResult] = useState<ProductCreateResult | null>(initial.result)
  const [locked, setLocked] = useState(!!initial.snapshot && !initial.result)
  const [pendingFilename, setPendingFilename] = useState(initial.snapshot?.filename)
  const [validation, setValidation] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const { busy, error, run, clearError } = useAction()
  const disabled = locked || busy !== null

  const updateSku = (id: string, field: 'optionLabel' | 'price' | 'stock', value: string) => {
    setSkus(rows => rows.map(row => row.id === id ? { ...row, [field]: value } : row))
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const payload = normalizeProductRegistration({ name, description, skus: skus.map(sku => ({
      optionLabel: sku.optionLabel, price: sku.price.trim() ? Number(sku.price) : NaN,
      initialStock: sku.stock.trim() ? Number(sku.stock) : NaN,
    })) })
    const problem = validateProductRegistration(payload, image)
    setValidation(problem)
    if (problem || !image || !initial.attempt) return
    await run('register', async () => {
      let key: string
      try { key = await initial.attempt!.prepare(payload, image) }
      catch (e) {
        if (e instanceof UnresolvedProductRegistrationError) throw new ApiError('CONFLICT', e.message)
        throw e
      }
      setLocked(true)
      setPendingFilename(image.name)
      let created: ProductCreateResult
      try {
        created = await api.seller.products.create({ ...payload, image, idempotencyKey: key })
      } catch (e) {
        if (e instanceof ApiError && e.code === 'VALIDATION') {
          // 서버가 입력을 거절했으므로 수정 후 새로운 요청을 준비할 수 있다.
          initial.attempt!.finish(key)
          setLocked(false)
        }
        throw e
      }
      // 생성 성공은 상세 GET과 독립적이다. 저장소 장애도 성공을 실패로 되돌리지 않는다.
      setResult(created)
      try { initial.attempt!.complete(key, created) }
      catch { setStorageWarning('등록은 완료됐지만 결과를 브라우저에 보관하지 못했어요. 상품 ID를 기록해 주세요. 다시 등록하지 마세요.') }
    })
  }

  const startNew = () => {
    try {
      const snapshot = initial.attempt?.snapshot()
      if (snapshot) initial.attempt!.finish(snapshot.key)
      setName(''); setDescription(''); setSkus([blankSku()]); setImage(null)
      setResult(null); setLocked(false); setPendingFilename(undefined); setValidation(null); setStorageWarning(null); clearError()
    } catch { setStorageWarning('복구 기록을 정리하지 못했어요. 브라우저 저장소를 확인해 주세요.') }
  }

  return <>
    <div className={styles.pageHead}>
      <Link to="/seller/products" className={styles.back}>← 상품 목록</Link>
      <h1 className="t-h1">{result ? '상품 등록 완료' : '상품 등록'}</h1>
      <p className={styles.pageDescription}>대표 이미지와 상품정보, 옵션별 가격·초기 재고를 함께 등록해요.</p>
    </div>
    {initial.error ? <Alert type="danger" title="등록 복구 기록을 확인해 주세요">{initial.error} 브라우저 저장소를 사용할 수 있는지 확인해 주세요. 이전 요청이 있다면 상품 목록에서 결과를 먼저 확인해 주세요.</Alert>
      : result ? <SellerSection title="등록 결과">
        <Alert type="success" title="상품을 판매 허용 상태로 등록했어요">상품 ID {result.productId} · 이미지 ID {result.mainImageId}</Alert>
        {storageWarning && <Alert type="warning" title="등록 결과 보관 안내">{storageWarning}</Alert>}
        <h2 className="t-h4">{name}</h2>
        <p className={styles.hint}>등록 시점의 결과예요. 이후 가격·재고 변경은 이 기록에 반영되지 않아요.</p>
        <ul className={styles.skuResults} aria-label="등록된 판매 옵션">
          {result.skus.map(sku => <li key={sku.skuId} className={styles.skuResult}>
            <strong>{sku.optionLabel || '기본 옵션'}</strong>
            <span>SKU ID {sku.skuId}</span>
            <span>{formatPrice(sku.price)} · 초기 재고 {sku.available}개</span>
            <span>{sku.available === 0 ? '품절' : '재고 있음'}</span>
          </li>)}
        </ul>
        <Alert type="info" title="상품 조회 안내">{result.skus.length > 1
          ? '여러 옵션 상품의 고객 조회·구매는 아직 지원하지 않아요. 판매자 목록·상세도 조회가 제한돼요. 이 등록 결과에서 옵션별 내용을 확인해 주세요.'
          : '상품 조회에 반영되기까지 시간이 걸릴 수 있어요. 조회되지 않아도 등록은 완료됐으니 다시 등록하지 마세요.'}</Alert>
        <div className={styles.actions}>
          <ButtonLink to="/seller/products" variant="secondary">상품 목록</ButtonLink>
          {result.skus.length === 1 && <ButtonLink to={`/seller/products/${encodeURIComponent(result.productId)}`} variant="secondary">기본정보 확인</ButtonLink>}
          <Button onClick={startNew}>다른 상품 등록</Button>
        </div>
      </SellerSection> : <form onSubmit={submit} noValidate className={styles.registrationForm} aria-busy={busy !== null}>
        {locked && <Alert type="warning" title="이전 등록 결과를 확인해 주세요">입력은 보관되어 있어요. {pendingFilename ? `이전 이미지(${pendingFilename})를` : '같은 이미지를'} 다시 선택하면 같은 요청으로 재시도해요. 이 탭에서 새로고침·화면 재진입을 지원하며, 탭을 닫거나 저장소를 지우면 복구할 수 없어요.</Alert>}
        {(error || validation) && <Alert type="danger" title={error?.code === 'CONFLICT' ? '등록 요청 내용이 달라요' : '등록 내용을 확인해 주세요'}>
          {validation || (error?.code === 'CONFLICT' ? '같은 요청 키에 다른 내용이 전달됐어요. 이전 이미지와 입력을 확인해 주세요. 새 키로 자동 등록하지 않아요.' : error?.message)}
          {locked && <p>등록 처리 중이거나 응답을 받지 못한 경우에도 같은 내용으로 재시도해 주세요.</p>}
        </Alert>}
        <SellerSection title="상품정보" description="등록을 완료하면 별도 판매 시작 없이 판매 허용 상태가 돼요.">
          <div className={styles.form}>
            <Input label="상품명" value={name} onChange={e => setName(e.target.value)} maxLength={PRODUCT_NAME_MAX} disabled={disabled} required />
            <Textarea label="상품 설명" value={description} onChange={e => setDescription(e.target.value)} maxLength={PRODUCT_DESCRIPTION_MAX} disabled={disabled} required />
            <ImageUpload label="대표 이미지" file={image} onChange={setImage} disabled={busy !== null} note="상품정보·가격·재고와 함께 등록해요. 재고가 0인 옵션은 품절로 표시해요." />
          </div>
        </SellerSection>
        <SellerSection title="판매 옵션" description={`최대 ${INITIAL_SKU_MAX}개까지 등록해요. 여러 옵션은 서로 다른 옵션명이 필요해요.`}>
          <div className={styles.form}>
            {skus.length > 1 && <Alert type="warning" title="여러 옵션 상품의 조회 안내">현재 여러 옵션 상품이 포함되면 판매자 상품 목록·상세 조회가 제한돼요. 등록 후 이 화면에서 결과를 확인할 수 있으며, 같은 탭에서 다시 열어도 보관된 결과를 볼 수 있어요.</Alert>}
            {skus.map((sku, index) => <fieldset key={sku.id} className={styles.skuFields} disabled={disabled}>
              <legend>판매 옵션 {index + 1}</legend>
              <Input label={`옵션명 ${index + 1}`} value={sku.optionLabel} onChange={e => updateSku(sku.id, 'optionLabel', e.target.value)} maxLength={OPTION_LABEL_MAX} placeholder="예: 검정 / M" helper={skus.length === 1 ? '단일 옵션은 비워도 돼요.' : undefined} />
              <div className={`${styles.formRow} ${styles.formRow2}`}>
                <Input label={`판매 가격 ${index + 1}(원)`} inputMode="numeric" value={sku.price} onChange={e => updateSku(sku.id, 'price', e.target.value)} required />
                <Input label={`초기 재고 ${index + 1}(개)`} inputMode="numeric" value={sku.stock} onChange={e => updateSku(sku.id, 'stock', e.target.value)} required />
              </div>
              <Button variant="tonal" onClick={() => setSkus(rows => rows.filter(row => row.id !== sku.id))} disabled={disabled || skus.length === 1} aria-label={`판매 옵션 ${index + 1} 삭제`}>옵션 삭제</Button>
            </fieldset>)}
            <Button variant="secondary" onClick={() => setSkus(rows => [...rows, blankSku()])} disabled={disabled || skus.length >= INITIAL_SKU_MAX}>판매 옵션 추가</Button>
          </div>
        </SellerSection>
        <div className={styles.actions}>
          <Button type="submit" disabled={busy !== null}>{busy ? '등록 중…' : locked ? '같은 요청으로 재시도' : '상품 등록'}</Button>
        </div>
        <p className={styles.hint}>여러 옵션 상품의 고객 조회·구매는 아직 지원하지 않아요. 등록 후 각 옵션의 결과를 확인해 주세요.</p>
      </form>}
  </>
}
