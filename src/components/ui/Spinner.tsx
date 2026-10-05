import styles from './Spinner.module.css'

/** Figma "Loader/Spinner". */
export function Spinner({ size = 32, label = '불러오는 중' }: { size?: number; label?: string }) {
  return <span role="status" aria-label={label} className={styles.spinner} style={{ width: size, height: size }} />
}
