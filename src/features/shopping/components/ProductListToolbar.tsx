import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ProductSort } from '../../../domain/types'
import { PRICE_RANGES, SORT_OPTIONS, priceLabel, type ProductFilter } from '../productFilter'
import styles from './ProductListToolbar.module.css'

const Chevron = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
const CloseIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>

/** 상품 목록 위 정렬 버튼. 누르면 정렬 창이 열린다. 제목 줄 오른쪽에 둔다. */
export function SortButton({ sort, onChange }: { sort: ProductSort; onChange: (sort: ProductSort) => void }) {
  const [open, setOpen] = useState(false)
  const label = SORT_OPTIONS.find(option => option.value === sort)?.label
  return <>
    <button type="button" className={styles.sortButton} aria-haspopup="dialog" aria-label={`정렬: ${label}`} onClick={() => setOpen(true)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /></svg>
      {label}
    </button>
    {open && <SortDialog sort={sort} onClose={() => setOpen(false)} onChange={value => { onChange(value); setOpen(false) }} />}
  </>
}

/** 무료배송, 가격 필터 칩. 가격을 누르면 오른쪽에서 필터 창이 나온다. */
export function FilterChips({ filter, onChange }: { filter: ProductFilter; onChange: (filter: ProductFilter) => void }) {
  const [open, setOpen] = useState(false)
  const price = priceLabel(filter)
  return <div className={styles.chips} role="group" aria-label="상품 필터">
    <button type="button" className={styles.chip} aria-pressed={filter.freeShipping} onClick={() => onChange({ ...filter, freeShipping: !filter.freeShipping })}>무료배송</button>
    <button type="button" className={styles.chip} aria-pressed={price !== null} aria-haspopup="dialog" aria-label={price ? `가격: ${price}` : '가격'} onClick={() => setOpen(true)}>
      {price ?? '가격'} <Chevron />
    </button>
    {open && <PriceDrawer filter={filter} onChange={onChange} onClose={() => setOpen(false)} />}
  </div>
}

/** 화면에 붙자마자 모달로 여는 dialog. 정리 단계에서 close() 를 부르지 않는다(다시 연 창까지 닫히는 것을 막기 위해). */
function useModal() {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const node = ref.current; if (node && !node.open) node.showModal() }, [])
  return ref
}

function SortDialog({ sort, onChange, onClose }: { sort: ProductSort; onChange: (sort: ProductSort) => void; onClose: () => void }) {
  const dialog = useModal()
  return <dialog ref={dialog} className={styles.sortDialog} aria-labelledby="sort-title" onClose={onClose} onClick={event => { if (event.target === dialog.current) onClose() }}>
    <div className={styles.dialogHead}>
      <h2 id="sort-title" className={styles.dialogTitle}>상품 정렬</h2>
      <button type="button" className={styles.iconButton} aria-label="닫기" onClick={onClose}><CloseIcon /></button>
    </div>
    <fieldset className={styles.radios}>
      <legend className="sr-only">정렬 기준</legend>
      {SORT_OPTIONS.map(option => <label key={option.value} className={styles.radio}>
        <input type="radio" name="sort" value={option.value} checked={option.value === sort} onChange={() => onChange(option.value)} />
        <span className={styles.radioText}>
          <span>{option.label}</span>
          {option.description && <span className={styles.radioHint}>{option.description}</span>}
        </span>
      </label>)}
    </fieldset>
  </dialog>
}

const CUSTOM = -1

function PriceDrawer({ filter, onChange, onClose }: { filter: ProductFilter; onChange: (filter: ProductFilter) => void; onClose: () => void }) {
  const dialog = useModal()
  const [expanded, setExpanded] = useState(true)
  const preset = PRICE_RANGES.findIndex(range => range.min === filter.minPrice && range.max === filter.maxPrice)
  const hasPrice = filter.minPrice !== undefined || filter.maxPrice !== undefined
  const [choice, setChoice] = useState(!hasPrice ? null : preset >= 0 ? preset : CUSTOM)
  const [min, setMin] = useState(choice === CUSTOM && filter.minPrice !== undefined ? String(filter.minPrice) : '')
  const [max, setMax] = useState(choice === CUSTOM && filter.maxPrice !== undefined ? String(filter.maxPrice) : '')
  const [error, setError] = useState<string | null>(null)

  const pick = (index: number | null) => {
    setChoice(index); setError(null)
    if (index === CUSTOM) return
    const range: { min?: number; max?: number } = index === null ? {} : PRICE_RANGES[index]
    onChange({ ...filter, minPrice: range.min, maxPrice: range.max })
  }
  const applyCustom = (event: FormEvent) => {
    event.preventDefault()
    const low = min.trim() === '' ? undefined : Number(min.replaceAll(',', '')), high = max.trim() === '' ? undefined : Number(max.replaceAll(',', ''))
    if ([low, high].some(n => n !== undefined && (!Number.isInteger(n) || n < 0))) { setError('가격은 0 이상 숫자로 입력해 주세요.'); return }
    if (low !== undefined && high !== undefined && low > high) { setError('최소 가격이 최대 가격보다 클 수 없어요.'); return }
    setError(null)
    onChange({ ...filter, minPrice: low, maxPrice: high })
  }
  const reset = () => { setMin(''); setMax(''); pick(null) }

  return <dialog ref={dialog} className={styles.drawer} aria-labelledby="filter-title" onClose={onClose} onClick={event => { if (event.target === dialog.current) onClose() }}>
    <div className={styles.drawerHead}>
      <h2 id="filter-title" className={styles.dialogTitle}>필터</h2>
      <div className={styles.headActions}>
        <button type="button" className={[styles.iconButton, styles.reset].join(' ')} aria-label="가격 필터 초기화" onClick={reset}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" /></svg>
        </button>
        <button type="button" className={styles.iconButton} aria-label="닫기" onClick={onClose}><CloseIcon /></button>
      </div>
    </div>
    <section className={styles.drawerSection}>
      <button type="button" className={styles.sectionToggle} aria-expanded={expanded} aria-controls="price-options" onClick={() => setExpanded(value => !value)}>
        가격 <span className={styles.toggleIcon}><Chevron /></span>
      </button>
      {expanded && <div id="price-options">
        <fieldset className={styles.radios}>
          <legend className="sr-only">가격 범위</legend>
          <label className={styles.radio}><input type="radio" name="price" checked={choice === null} onChange={() => pick(null)} /><span>전체</span></label>
          {PRICE_RANGES.map((range, index) => <label key={range.label} className={styles.radio}>
            <input type="radio" name="price" checked={choice === index} onChange={() => pick(index)} /><span>{range.label}</span>
          </label>)}
          <label className={styles.radio}><input type="radio" name="price" checked={choice === CUSTOM} onChange={() => pick(CUSTOM)} /><span>직접입력</span></label>
        </fieldset>
        <form className={styles.custom} onSubmit={applyCustom}>
          <input className={styles.priceInput} inputMode="numeric" aria-label="최소 가격(원)" placeholder="최소" value={min} disabled={choice !== CUSTOM} onChange={event => setMin(event.target.value)} />
          <span aria-hidden="true">~</span>
          <input className={styles.priceInput} inputMode="numeric" aria-label="최대 가격(원)" placeholder="최대" value={max} disabled={choice !== CUSTOM} onChange={event => setMax(event.target.value)} />
          <button type="submit" className={styles.apply} disabled={choice !== CUSTOM}>적용</button>
        </form>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>}
    </section>
  </dialog>
}
