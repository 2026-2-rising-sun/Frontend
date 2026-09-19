import { Link, NavLink } from 'react-router-dom'
import { SearchBox } from '../../components/SearchBox'
import { ButtonLink } from '../../components/ui'
import styles from './Header.module.css'

const NAV = [
  { to: '/', label: '쇼핑', end: true },
  { to: '/lives', label: '방송', end: false },
  { to: '/orders/lookup', label: '주문 조회', end: false },
] as const

/** Figma "Header/Web". 태블릿 이상에서는 내비게이션·검색, 모바일에서는 로고와 내 주문만 보인다. */
export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo} aria-label="ShoppingLive 홈">
          <span className={styles.mark} aria-hidden="true" />
          ShoppingLive
        </Link>

        <nav className={styles.nav} aria-label="주요 메뉴">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => [styles.link, isActive && styles.active].filter(Boolean).join(' ')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.spacer} />
        <SearchBox className={styles.search} />
        <ButtonLink to="/orders/lookup" variant="secondary" size="M" className={styles.orders}>
          내 주문
        </ButtonLink>
      </div>
    </header>
  )
}
