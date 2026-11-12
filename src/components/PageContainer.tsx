import type { ReactNode } from 'react'
import styles from './PageContainer.module.css'

interface PageContainerProps {
  children: ReactNode
  /** 폼·결과 화면처럼 좁은 중앙 정렬 폭이 필요할 때 */
  narrow?: boolean
  className?: string
}

/** 반응형 콘텐츠 폭. 모바일 16px → 태블릿 24px → 데스크톱 최대 1200px 로 정렬. */
export function PageContainer({ children, narrow, className }: PageContainerProps) {
  return <div className={[styles.container, narrow && styles.narrow, className].filter(Boolean).join(' ')}>{children}</div>
}
