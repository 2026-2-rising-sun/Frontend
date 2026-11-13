import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { NotificationBadge } from '../../features/notifications/NotificationBadge'
import { useSession } from '../../features/auth/useSession'
import { SearchBox } from '../../components/SearchBox'
import { PRODUCT_CATEGORIES, type ProductCategory } from '../../domain/types'
import { useApi } from '../apiContext'
import styles from './Header.module.css'

const categoryPath = (value: ProductCategory) => `/categories/${value.toLowerCase()}`
const NAV = [
  { to: '/today', label: '오특' },
  { to: '/lives', label: '라이브' },
  ...PRODUCT_CATEGORIES.map(category => ({ to: categoryPath(category.value), label: category.label })),
]
/** 카테고리 펼침 화면에서 분류 이름 아래에 적는 대표 품목 */
const CATEGORY_HINTS: Partial<Record<ProductCategory, string>> = {
  FOOD: '정육, 수산, 과일, 간편식',
  LIVING: '침구, 주방, 완구, 캠핑, 문구',
  DIGITAL: '음향, 웨어러블, 주변기기, 육아가전',
  BEAUTY: '스킨케어, 메이크업, 클렌징',
  FASHION: '의류, 신발, 가방, 유아동, 반려견',
}

/** 맨 위는 계정 메뉴(카테고리, 장바구니, 마이페이지, 로그인 상태, 알림), 가운데는 로고와 검색, 아래는 오특, 라이브, 대표 분류 탭이다. */
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
          <CategoryMenu />
          <Link to="/cart" className={styles.utilityLink}>장바구니</Link>
          <Link to="/account" className={styles.utilityLink}>마이페이지</Link>
          {session ? <>
            <button type="button" className={styles.utilityLink} onClick={() => { void logout().catch(() => {}) }}>로그아웃</button>
            <span className={styles.utilityBadge}><NotificationBadge /></span>
          </> : <>
            <Link to="/login" className={styles.utilityLink}>로그인</Link>
            <Link to="/signup" className={styles.utilityLink}>회원가입</Link>
          </>}
        </nav>
      </div>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo} aria-label="BERRY ON 홈">BERRY ON</Link>
        <SearchBox className={styles.search} />
      </div>
      <div className={styles.navigation}>
        {/* 좁은 화면에서는 탭을 가로로 밀어 본다. */}
        <nav className={styles.nav} aria-label="주요 메뉴">
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

/** "카테고리"를 누르면 머리글 아래에 전체 분류를 펼친다. 바깥 클릭, Esc, 항목 선택 시 닫는다. */
function CategoryMenu() {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); button.current?.focus() } return }
      const target = event.target as Node
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])
  return <>
    <button ref={button} type="button" className={[styles.utilityLink, styles.categoryButton].join(' ')} aria-expanded={open} aria-controls="category-menu" onClick={() => setOpen(value => !value)}>
      카테고리
      <svg className={styles.chevron} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    {open && <div ref={panel} id="category-menu" className={styles.categoryPanel}>
      <ul className={styles.categoryGrid}>
        {PRODUCT_CATEGORIES.map(category => <li key={category.value}>
          <Link to={categoryPath(category.value)} className={styles.categoryLink} onClick={() => setOpen(false)}>
            <span className={styles.categoryName}>{category.label}<span aria-hidden="true">›</span></span>
            <span className={styles.categoryHint}>{CATEGORY_HINTS[category.value]}</span>
          </Link>
        </li>)}
      </ul>
    </div>}
  </>
}
