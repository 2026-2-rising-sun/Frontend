import { useSession } from '../auth/useSession'
import { ButtonLink, ResultState } from '../../components/ui'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import styles from './AdminLayout.module.css'

const NAV = [
  { to: '/admin/products', label: '상품 관리' },
  { to: '/admin/lives', label: '방송 관리' },
] as const

/**
 * 판매자 콘솔 레이아웃.
 * 모바일: 상단 가로 메뉴 / PC(≥1024px): 왼쪽 사이드바.
 */
export function AdminLayout() {
  const session = useSession()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (session.role !== 'SELLER') return <ResultState type="error" title="판매자만 접근할 수 있어요."
    action={<ButtonLink to="/login">다른 계정으로 로그인</ButtonLink>} />
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/admin/products" className={styles.logo}>
          <span className={styles.mark} aria-hidden="true" />
          판매자 콘솔
        </Link>
        <nav className={styles.nav} aria-label="관리 메뉴">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => [styles.link, isActive && styles.active].filter(Boolean).join(' ')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/" className={styles.shop}>
          ← 쇼핑몰로
        </Link>
        <p className={styles.notice}>판매자 계정으로 로그인되어 있어요.</p>
      </aside>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
