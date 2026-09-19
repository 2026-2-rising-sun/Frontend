import { Link, Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import styles from './AppLayout.module.css'

/** 하단 탭 대신 자체 액션 바를 쓰는 화면(상품 상세·주문서)에서는 탭을 숨긴다. */
const HIDE_BOTTOM_NAV = /^\/(products\/|checkout)/

export function AppLayout() {
  const { pathname } = useLocation()
  const showBottomNav = !HIDE_BOTTOM_NAV.test(pathname)

  return (
    <div className={styles.root}>
      <Header />
      <main className={[styles.main, showBottomNav && styles.withBottomNav].filter(Boolean).join(' ')}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <Link to="/admin/products">관리 콘솔 (개발·시연용)</Link>
      </footer>
      {showBottomNav && <BottomNav />}
    </div>
  )
}
