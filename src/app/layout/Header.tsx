import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { NotificationBadge } from '../../features/notifications/NotificationBadge'
import { useSession } from '../../features/auth/useSession'
import { SearchBox } from '../../components/SearchBox'
import { PRODUCT_CATEGORIES } from '../../domain/types'
import { useApi } from '../apiContext'
import styles from './Header.module.css'

const NAV = [
  { to: '/ranking', label: '랭킹' },
  { to: '/lives', label: '방송' },
] as const

/** 맨 위는 작은 계정 메뉴, 가운데는 로고·검색, 아래는 카테고리·랭킹·방송 탐색 메뉴로 구성한다. */
export function Header() {
  const session = useSession()
  const { auth } = useApi()
  const navigate = useNavigate()
  async function logout() {
    try { await auth.logout() } finally { navigate('/login') }
  }
  return (
    <header className={styles.header}>
      <div className={styles.utility}>
        <nav className={styles.utilityInner} aria-label="계정 메뉴">
          {session ? <button type="button" className={styles.utilityLink} onClick={() => { void logout().catch(() => {}) }}>로그아웃</button>
            : <><Link to="/login" className={styles.utilityLink}>로그인</Link><Link to="/signup" className={styles.utilityLink}>회원가입</Link></>}
          <Link to="/account" className={styles.utilityLink}>마이페이지</Link>
          <Link to="/cart" className={styles.utilityLink}>장바구니</Link>
          <Link to="/orders/lookup" className={styles.utilityLink}>주문배송</Link>
          {session && <span className={styles.utilityBadge}><NotificationBadge /></span>}
          {session?.role === 'SELLER' && <Link to="/seller/products" className={styles.utilityLink}>판매자 콘솔</Link>}
        </nav>
      </div>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo} aria-label="BERRY ON 홈">BERRY ON</Link>
        <SearchBox className={styles.search} />
      </div>
      <div className={styles.navigation}>
        <nav className={styles.nav} aria-label="주요 메뉴">
          <CategoryMenu />
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => [styles.link, isActive && styles.active].filter(Boolean).join(' ')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}

/** "카테고리" 버튼을 누르면 1단계 분류 목록을 펼친다. 바깥 클릭, Esc, 항목 선택 시 닫는다. */
function CategoryMenu() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])
  return (
    <div ref={root} className={styles.category}>
      <button type="button" className={[styles.categoryButton, open && styles.categoryOpen].filter(Boolean).join(' ')} aria-expanded={open} aria-controls="category-menu" onClick={() => setOpen(value => !value)}>
        <span className={styles.burger} aria-hidden="true"><span /><span /><span /></span>
        카테고리
      </button>
      {open && <ul id="category-menu" className={styles.categoryPanel}>
        {PRODUCT_CATEGORIES.map(category => <li key={category.value}><Link to={`/categories/${category.value.toLowerCase()}`} onClick={() => setOpen(false)}>{category.label}</Link></li>)}
      </ul>}
    </div>
  )
}
