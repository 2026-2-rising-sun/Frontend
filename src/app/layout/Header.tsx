import { useSession } from '../../features/auth/useSession'
import { useApi } from '../apiContext'
import { useNavigate } from 'react-router-dom'
import { Link, NavLink } from 'react-router-dom'
import { SearchBox } from '../../components/SearchBox'
import { Button, ButtonLink } from '../../components/ui'
import styles from './Header.module.css'

const NAV = [
  { to: '/', label: '쇼핑', end: true },
  { to: '/lives', label: '방송', end: false },
  { to: '/orders/lookup', label: '내 주문', end: false },
  { to: '/cart', label: '장바구니', end: false },
] as const

/** Figma "Header/Web". 태블릿 이상에서는 내비게이션·검색, 모바일에서는 로고와 내 주문만 보인다. */
export function Header() {
  const session = useSession()
  const { auth } = useApi()
  const navigate = useNavigate()
  async function logout() {
    try { await auth.logout() } finally { navigate('/login') }
  }
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
        {session && <ButtonLink to="/account" variant="secondary" size="S">내 계정</ButtonLink>}
        {session?.role === 'SELLER' && <ButtonLink className={styles.desktopAction} to="/admin/products" variant="secondary" size="S">판매자 콘솔</ButtonLink>}
        {session ? <Button className={styles.desktopAction} variant="secondary" size="S" onClick={() => { void logout().catch(() => {}) }}>로그아웃</Button>
          : <ButtonLink to="/login" variant="secondary" size="M">로그인</ButtonLink>}
      </div>
    </header>
  )
}
