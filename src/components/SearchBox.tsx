import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SearchIcon } from './icons'
import styles from './SearchBox.module.css'

/** Figma "Search". 상품명 검색어를 홈의 ?q= 로 전달한다. */
export function SearchBox({ className }: { className?: string }) {
  const [params] = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')
  const navigate = useNavigate()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/')
  }

  return (
    <form role="search" onSubmit={submit} className={[styles.root, className].filter(Boolean).join(' ')}>
      <SearchIcon size={18} className={styles.icon} />
      <input
        type="search"
        className={styles.input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="상품 검색"
        aria-label="상품 검색"
      />
    </form>
  )
}
