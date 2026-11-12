import styles from './Tabs.module.css'

interface TabsProps<T extends string> {
  value: T
  items: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  'aria-label': string
}

/** Figma "Tabs / Tab" (Default · Hover · Active). 활성 탭은 강조색(Emphasis) 밑줄. */
export function Tabs<T extends string>({ value, items, onChange, ...rest }: TabsProps<T>) {
  return (
    <div className={styles.root} role="tablist" {...rest}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className={[styles.tab, item.value === value && styles.active].filter(Boolean).join(' ')}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
