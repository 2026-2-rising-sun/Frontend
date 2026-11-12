import styles from './SegmentedControl.module.css'

interface SegmentedControlProps<T extends string> {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  'aria-label': string
}

/** Figma "Segmented Control". 방송 목록의 진행 중 · 예정 · 종료 구분. */
export function SegmentedControl<T extends string>({ value, options, onChange, ...rest }: SegmentedControlProps<T>) {
  return (
    <div className={styles.root} role="tablist" {...rest}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={[styles.item, o.value === value && styles.selected].filter(Boolean).join(' ')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
