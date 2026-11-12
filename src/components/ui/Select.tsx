import type { SelectHTMLAttributes } from 'react'
import { ChevronDownIcon } from '../icons'
import styles from './Select.module.css'

interface SelectProps<T extends string> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  'aria-label': string
}

/** Figma "Select". 접근성을 위해 네이티브 select 를 스타일링해서 사용한다. */
export function Select<T extends string>({ value, options, onChange, className, ...rest }: SelectProps<T>) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value as T)} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon size={18} className={styles.icon} />
    </div>
  )
}
