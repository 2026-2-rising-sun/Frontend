import { Select } from '../../../components/ui'
import type { ProductOptionGroup } from '../../../domain/types'
import { formatPrice } from '../../../lib/format'
import styles from './ProductOptions.module.css'

/** 옵션 값 이름. 추가 금액과 품절을 함께 적는다. 예: "2개 세트 (+35,000원)", "XL (품절)" */
function optionLabel(value: ProductOptionGroup['values'][number]) {
  const extra = value.extraPrice ? ` (${value.extraPrice > 0 ? '+' : '-'}${formatPrice(Math.abs(value.extraPrice))})` : ''
  return `${value.label}${extra}${value.soldOut ? ' (품절)' : ''}`
}

/** 상품 상세의 옵션 선택. 묶음마다 하나씩 고르며, 품절 값은 고를 수 없다. chosen 은 묶음별로 고른 값의 순번('' 은 미선택)이다. */
export function ProductOptions({ groups, chosen, onChange, disabled }: { groups: ProductOptionGroup[]; chosen: string[]; onChange: (chosen: string[]) => void; disabled?: boolean }) {
  return <fieldset className={styles.options} disabled={disabled}>
    <legend className={styles.legend}>옵션 선택</legend>
    {groups.map((group, index) => <label key={group.name} className={styles.field}>
      <span className={styles.name}>{group.name}</span>
      <Select aria-label={group.name} className={styles.select} value={chosen[index] ?? ''}
        options={[{ value: '', label: `${group.name} 선택`, disabled: true }, ...group.values.map((value, n) => ({ value: String(n), label: optionLabel(value), disabled: value.soldOut }))]}
        onChange={value => onChange(chosen.map((current, n) => n === index ? value : current))} />
    </label>)}
  </fieldset>
}
