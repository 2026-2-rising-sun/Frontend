import { useState, type ReactNode } from 'react'
import { ImageIcon } from '../icons'
import styles from './Thumbnail.module.css'

interface ThumbnailProps {
  src: string | null
  alt: string
  /** CSS aspect-ratio 값. 예: '1 / 1', '16 / 9' */
  ratio?: string
  className?: string
  /** 이미지 위에 겹쳐 표시할 내용 (배지 등) */
  children?: ReactNode
}

/**
 * 상품·방송 이미지. 이미지가 없거나 불러오기에 실패하면 기본 이미지(placeholder)로 대체한다.
 * 이미지 오류가 주문·재고 등 다른 화면 동작에 영향을 주지 않는다.
 */
export function Thumbnail({ src, alt, ratio = '1 / 1', className, children }: ThumbnailProps) {
  const [failed, setFailed] = useState(false)
  const showImage = src && !failed

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} style={{ aspectRatio: ratio }}>
      {showImage ? (
        <img src={src} alt={alt} className={styles.image} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className={styles.placeholder} role="img" aria-label={alt}>
          <ImageIcon size={32} />
        </div>
      )}
      {children}
    </div>
  )
}
