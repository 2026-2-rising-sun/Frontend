import { useState, type ReactNode } from 'react'
import styles from './InfoTip.module.css'

/**
 * ⓘ 안내 아이콘. 마우스를 올리거나 초점을 주면 말풍선이 뜨고, 누르면 고정된다. X 나 Esc 로 닫는다.
 * 말풍선은 가장 가까운 position: relative 조상의 왼쪽 아래에 붙는다.
 */
export function InfoTip({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hovered || pinned
  const close = () => { setHovered(false); setPinned(false) }
  return <div className={styles.wrap} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onKeyDown={event => { if (event.key === 'Escape') close() }}>
    <button type="button" className={styles.info} aria-label={label} aria-expanded={open} aria-controls={id}
      onClick={() => setPinned(value => !value)} onFocus={() => setHovered(true)} onBlur={event => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setHovered(false) }}>i</button>
    {open && <div id={id} role="tooltip" className={styles.tooltip}>
      <p>{children}</p>
      <button type="button" className={styles.close} aria-label="안내 닫기" onClick={close}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>}
  </div>
}
