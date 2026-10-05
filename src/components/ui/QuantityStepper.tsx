import { MinusIcon, PlusIcon } from '../icons'
import styles from './QuantityStepper.module.css'

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  /** 기본 1. 1 미만으로 내려가지 않는다. */
  min?: number
  /** 재고 등 상한. 도달하면 + 가 비활성화된다. */
  max?: number
  disabled?: boolean
}

/** Figma "Quantity Stepper" (Default · Min · Max). */
export function QuantityStepper({ value, onChange, min = 1, max, disabled }: QuantityStepperProps) {
  const atMin = value <= min
  const atMax = max !== undefined && value >= max

  return (
    <div className={styles.root} role="group" aria-label="수량">
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(value - 1)}
        disabled={disabled || atMin}
        aria-label="수량 줄이기"
      >
        <MinusIcon />
      </button>
      <output className={styles.value} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={styles.button}
        onClick={() => onChange(value + 1)}
        disabled={disabled || atMax}
        aria-label="수량 늘리기"
      >
        <PlusIcon />
      </button>
    </div>
  )
}
