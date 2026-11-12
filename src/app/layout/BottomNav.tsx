import { NavLink } from 'react-router-dom'
import { RankingIcon, ShoppingIcon, UserIcon, VideoIcon } from '../../components/icons'
import styles from './BottomNav.module.css'

const ITEMS = [
  { to: '/', label: '홈', end: true, Icon: ShoppingIcon },
  { to: '/ranking', label: '랭킹', end: false, Icon: RankingIcon },
  { to: '/lives', label: '방송', end: false, Icon: VideoIcon },
  { to: '/account', label: '마이페이지', end: false, Icon: UserIcon },
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
