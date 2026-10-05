import type { InputHTMLAttributes } from 'react'
import { CheckIcon } from '../icons'
import styles from './Checkbox.module.css'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

/** Figma "Checkbox" (Checked × State). 실제 input 을 시각적으로만 가리고 접근성은 유지한다. */
export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={[styles.root, className].filter(Boolean).join(' ')}>
      <input type="checkbox" className={styles.input} {...rest} />
      <span className={styles.box} aria-hidden="true">
        <CheckIcon size={14} strokeWidth={3} />
      </span>
      <span className={styles.label}>{label}</span>
    </label>
  )
}
