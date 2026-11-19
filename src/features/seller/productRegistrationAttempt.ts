/**
 * 상품 등록 요청의 재시도 식별자. 호출자는 검증·정규화한 JSON과 전송할 파일을 전달한다.
 * 세션 저장소의 키는 인증된 판매자별로 분리해야 한다.
 */
interface Attempt {
  fingerprint: string
  key: string
  payload?: unknown
  filename?: string
  result?: unknown
}

export interface AttemptStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export class UnresolvedProductRegistrationError extends Error {
  constructor() {
    super('이전 등록 결과를 확인하지 못했어요. 같은 내용과 이미지로 재시도해 주세요.')
    this.name = 'UnresolvedProductRegistrationError'
  }
}

/** 파일 메타데이터가 같아도 바이트가 다르면 다른 요청으로 구분한다. */
export async function registrationFingerprint(payload: unknown, file: File): Promise<string> {
  const metadata = JSON.stringify([payload, file.name, file.type])
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const bytes = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const fingerprint = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([metadata, bytes])))
  return Array.from(new Uint8Array(fingerprint), byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * POST 전에 키를 보관한다. NETWORK/5xx/응답 해석 실패는 clear 사유가 아니다.
 * 완료 응답 또는 서버가 미생성을 확정한 경우에만 finish를 호출한다.
 * 유효기간을 임의로 두지 않는다. 만료·처리 중 정책은 서버 계약으로 결정한다.
 */
export function createProductRegistrationAttempt(storage: AttemptStorage, sellerId: string) {
  if (!sellerId.trim()) throw new Error('등록 재시도에는 판매자 식별자가 필요합니다.')
  const storageKey = `seller-product-registration:${encodeURIComponent(sellerId)}`

  const read = (): Attempt | null => {
    const raw = storage.getItem(storageKey)
    if (raw === null) return null
    // 손상된 기록을 새 키로 덮어쓰면 이미 접수된 등록이 중복 생성될 수 있다.
    try {
      const value: unknown = JSON.parse(raw)
      if (typeof value === 'object' && value !== null && 'fingerprint' in value && 'key' in value
        && typeof value.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(value.fingerprint)
        && typeof value.key === 'string' && /^[a-f0-9-]{36}$/.test(value.key)) {
        return { fingerprint: value.fingerprint, key: value.key,
          payload: 'payload' in value ? value.payload : undefined,
          filename: 'filename' in value && typeof value.filename === 'string' ? value.filename : undefined,
          result: 'result' in value ? value.result : undefined }
      }
    } catch { /* 아래에서 복구가 필요한 기록으로 안내한다. */ }
    throw new Error('이전 상품 등록 기록을 읽지 못했어요. 등록 결과를 확인한 뒤 다시 진행해 주세요.')
  }

  return {
    snapshot: read,
    async prepare(payload: unknown, file: File): Promise<string> {
      const fingerprint = await registrationFingerprint(payload, file)
      // 해시 계산 후 다시 읽으므로 동시에 준비한 요청도 먼저 저장한 키를 재사용한다.
      const previous = read()
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new UnresolvedProductRegistrationError()
        return previous.key
      }
      const key = crypto.randomUUID()
      // 저장 실패 시 POST를 시작할 키를 반환하지 않는다.
      storage.setItem(storageKey, JSON.stringify({ fingerprint, key, payload, filename: file.name }))
      return key
    },
    finish(key: string) {
      // 늦게 끝난 요청이 이후 요청의 복구 기록을 지우지 않도록 키를 확인한다.
      if (read()?.key === key) storage.removeItem(storageKey)
    },
    complete(key: string, result: unknown) {
      const previous = read()
      if (!previous || previous.key !== key) throw new Error('등록 결과의 요청 키가 달라요.')
      storage.setItem(storageKey, JSON.stringify({ ...previous, result }))
    },
  }
}
