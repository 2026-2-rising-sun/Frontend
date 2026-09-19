import type { ReactNode } from 'react'
import { AlertIcon, CheckCircleIcon, InfoIcon, WarnIcon } from '../icons'
import styles from './Alert.module.css'

export type AlertType = 'info' | 'success' | 'warning' | 'danger'

const ICONS = { info: InfoIcon, success: CheckCircleIcon, warning: WarnIcon, danger: AlertIcon } as const

interface AlertProps {
  type?: AlertType
  title: string
  children?: ReactNode
  className?: string
}

/** Figma "Alert" (Info · Success · Warning · Danger). */
export function Alert({ type = 'info', title, children, className }: AlertProps) {
  const IconComponent = ICONS[type]
  return (
    <div role={type === 'danger' ? 'alert' : 'status'} className={[styles.root, styles[type], className].filter(Boolean).join(' ')}>
      <IconComponent size={20} className={styles.icon} />
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.message}>{children}</div>}
      </div>
    </div>
  )
}
