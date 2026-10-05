import { useId, type TextareaHTMLAttributes } from 'react'
import { AlertIcon } from '../icons'
import styles from './Textarea.module.css'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  helper?: string
  error?: string
}

/** Input 과 같은 상태(Default · Focus · Error · Disabled)를 갖는 여러 줄 입력. maxLength 가 있으면 글자 수를 보여준다. */
export function Textarea({ label, helper, error, id, maxLength, value, className, ...rest }: TextareaProps) {
  const autoId = useId()
  const textareaId = id ?? autoId
  const describedBy = error || helper ? `${textareaId}-desc` : undefined
  const length = typeof value === 'string' ? value.length : 0

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <div className={styles.head}>
        <label htmlFor={textareaId} className={styles.label}>
          {label}
        </label>
        {maxLength !== undefined && (
          <span className={length > maxLength ? styles.overCount : styles.count}>
            {length}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        id={textareaId}
        className={[styles.textarea, error && styles.error].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        value={value}
        {...rest}
      />
      {(error || helper) && (
        <p id={describedBy} className={error ? styles.errorText : styles.helper}>
          {error && <AlertIcon size={14} />} {error ?? helper}
        </p>
      )}
    </div>
  )
}
