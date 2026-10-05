import type { ReactNode } from 'react'
import styles from '../admin.module.css'

/** 관리 화면의 섹션 카드 (제목 + 설명 + 내용) */
export function AdminSection({ title, description, children, aside }: { title: string; description?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.cardHead}>
        <div>
          <h2 className="t-h4">{title}</h2>
          {description && <p className={styles.cardDesc}>{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}
