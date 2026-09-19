import { Link, NavLink, Outlet } from 'react-router-dom'
import styles from './AdminLayout.module.css'

const NAV = [
  { to: '/admin/products', label: '상품 관리' },
  { to: '/admin/lives', label: '방송 관리' },
] as const

/**
 * 관리 콘솔 레이아웃. P1 에는 로그인·역할이 없으므로 개발·시연 환경에서만 쓰는 화면이다.
 * 모바일: 상단 가로 메뉴 / PC(≥1024px): 왼쪽 사이드바.
 */
export function AdminLayout() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/admin/products" className={styles.logo}>
          <span className={styles.mark} aria-hidden="true" />
          관리 콘솔
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
        <p className={styles.notice}>개발·시연용 화면이에요. 외부에 공개하지 않습니다.</p>
      </aside>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
