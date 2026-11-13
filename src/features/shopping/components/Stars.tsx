import styles from './Stars.module.css'

const Star = ({ filled }: { filled: boolean }) => <svg viewBox="0 0 24 24" className={filled ? styles.filled : styles.empty} aria-hidden="true">
  <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" strokeLinejoin="round" />
</svg>

/** 4개 중 filled 개를 칠한 별. 크기는 부모의 --star-size(기본 16px)로 정한다. 읽기 보조기기에는 숨긴다. */
export function Stars({ filled, tone = 'muted' }: { filled: number; tone?: 'brand' | 'muted' | 'gold' }) {
  return <span className={[styles.stars, styles[tone]].join(' ')} aria-hidden="true">
    {[1, 2, 3, 4].map(n => <Star key={n} filled={n <= filled} />)}
  </span>
}
