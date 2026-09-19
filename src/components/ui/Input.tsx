import { useId, type InputHTMLAttributes } from 'react'
import { AlertIcon } from '../icons'
import styles from './Input.module.css'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  helper?: string
  /** 오류 메시지. 있으면 Error 상태로 표시된다. */
  error?: string
}

/** Figma "Input" (Default · Focus · Filled · Error · Disabled). Focus 는 :focus-within. */
export function Input({ label, helper, error, id, className, ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error || helper ? `${inputId}-desc` : undefined

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={[styles.field, error && styles.error].filter(Boolean).join(' ')}>
        <input
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {error && <AlertIcon size={18} className={styles.errorIcon} />}
      </div>
      {(error || helper) && (
        <p id={describedBy} className={error ? styles.errorText : styles.helper}>
          {error ?? helper}
        </p>
      )}
    </div>
  )
}
