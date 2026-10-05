import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

/** Figma "Skeleton/Line". 로딩 중 자리 표시. */
export function Skeleton({ width = '100%', height = 12, radius = 6, style }: { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties }) {
  return <span aria-hidden="true" className={styles.skeleton} style={{ width, height, borderRadius: radius, ...style }} />
}
