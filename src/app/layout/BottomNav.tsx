import { NavLink } from 'react-router-dom'
import { ReceiptIcon, ShoppingIcon, VideoIcon } from '../../components/icons'
import styles from './BottomNav.module.css'

const ITEMS = [
  { to: '/', label: '쇼핑', end: true, Icon: ShoppingIcon },
  { to: '/lives', label: '방송', end: false, Icon: VideoIcon },
  { to: '/orders/lookup', label: '주문 조회', end: false, Icon: ReceiptIcon },
] as const

/** 모바일(<768px) 전용 하단 탭. 데스크톱은 Header 내비게이션을 사용한다. */
export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="하단 메뉴">
      {ITEMS.map(({ to, label, end, Icon }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => [styles.item, isActive && styles.active].filter(Boolean).join(' ')}>
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
