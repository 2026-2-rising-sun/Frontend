import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { IMAGE_ACCEPTED_TYPES, IMAGE_MAX_BYTES, validateImageFile } from '../../domain/constraints'
import { ImageIcon } from '../icons'
import { Button } from './Button'
import styles from './ImageUpload.module.css'

interface ImageUploadProps {
  label: string
  /** 선택된 새 이미지 파일 */
  file: File | null
  onChange: (file: File | null) => void
  /** 이미 등록된 이미지가 있는지 (수정 화면) */
  registered?: boolean
  disabled?: boolean
  /** 화면 보조 문구 */
  note?: string
}

/**
 * 대표 이미지 선택 + 형식·용량 확인 + 미리보기.
 * 허용 기준은 domain/constraints 를 쓰므로 처리(서버) 검증과 항상 같다.
 * 잘못된 파일은 선택을 거절하고 이유를 안내한다. (브라우저 미리보기만 보이는 상태를 "저장 성공"으로 오해하지 않도록 안내 문구를 둔다.)
 */
export function ImageUpload({ label, file, onChange, registered, disabled, note }: ImageUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  // 미리보기 주소는 파일을 고르는 순간 만들고, 교체·취소·화면 이탈 때 반드시 해제한다.
  const replaceUrl = (next: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = next
    setPreviewUrl(next)
  }
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )
  // 부모가 file 을 비우면(저장 후 초기화 등) 미리보기도 보이지 않는다.
  const shownUrl = file ? previewUrl : null

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 change 가 발생하도록
    if (!picked) return
    const problem = validateImageFile(picked)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    replaceUrl(URL.createObjectURL(picked))
    onChange(picked)
  }

  const clear = () => {
    setError(null)
    replaceUrl(null)
    onChange(null)
  }

  return (
    <div className={styles.root}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.body}>
        <div className={styles.preview} aria-live="polite">
          {shownUrl ? <img src={shownUrl} alt="선택한 이미지 미리보기" className={styles.image} /> : <ImageIcon size={32} />}
        </div>
        <div className={styles.side}>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={IMAGE_ACCEPTED_TYPES.join(',')}
            className={styles.input}
            onChange={pick}
            disabled={disabled}
          />
          <div className={styles.actions}>
            <Button variant="secondary" size="M" onClick={() => inputRef.current?.click()} disabled={disabled}>
              {file || registered ? '이미지 교체' : '이미지 선택'}
            </Button>
            {file && (
              <Button variant="tonal" size="M" onClick={clear} disabled={disabled}>
                선택 취소
              </Button>
            )}
          </div>
          <p className={styles.status}>
            {file ? `선택됨: ${file.name} (${Math.max(1, Math.round(file.size / 1024))}KB)` : registered ? '대표 이미지가 등록되어 있어요.' : '등록된 대표 이미지가 없어요.'}
          </p>
          <p className={styles.hint}>
            JPG · PNG · WEBP, 최대 {IMAGE_MAX_BYTES / 1024 / 1024}MB
          </p>
          {note && <p className={styles.hint}>{note}</p>}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
