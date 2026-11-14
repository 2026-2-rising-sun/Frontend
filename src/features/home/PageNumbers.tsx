import styles from './PageNumbers.module.css'

/** 섹션 오른쪽 위의 페이지 번호(1, 2). 지금 페이지는 검은 원으로 표시한다. */
export function PageNumbers({ label, count, current, onChange }: { label: string; count: number; current: number; onChange: (page: number) => void }) {
  if (count < 2) return null
  return <div className={styles.pages} role="group" aria-label={label}>
    {Array.from({ length: count }, (_, page) => <button key={page} type="button" className={[styles.page, page === current && styles.current].filter(Boolean).join(' ')}
      aria-label={`${page + 1}페이지`} aria-pressed={page === current} onClick={() => onChange(page)}>{page + 1}</button>)}
  </div>
}
