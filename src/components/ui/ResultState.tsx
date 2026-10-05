import type { ReactNode } from 'react'
import { AlertIcon, SearchIcon } from '../icons'
import { Spinner } from './Spinner'
import styles from './ResultState.module.css'

export type ResultStateType = 'empty' | 'error' | 'processing'

interface ResultStateProps {
  type: ResultStateType
  title: string
  message?: string
  action?: ReactNode
}

/**
 * Figma "Result State" (Empty · Error · Processing).
 * "결과 없음", "조회 실패", "처리 중"은 서로 다른 상태로 항상 구분해서 보여준다.
 * (조회 실패를 품절·재고 없음으로 위장하지 않는다.)
 */
export function ResultState({ type, title, message, action }: ResultStateProps) {
  return (
    <div className={styles.root} role={type === 'error' ? 'alert' : 'status'}>
      <div className={[styles.icon, type === 'error' && styles.iconError].filter(Boolean).join(' ')}>
        {type === 'processing' ? <Spinner size={28} /> : type === 'error' ? <AlertIcon size={28} /> : <SearchIcon size={28} />}
      </div>
      <p className={styles.title}>{title}</p>
      {message && <p className={styles.message}>{message}</p>}
      {action}
    </div>
  )
}
