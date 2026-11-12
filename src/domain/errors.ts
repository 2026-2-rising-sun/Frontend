/**
 * API 오류 계약. HTTP 어댑터는 같은 코드로 오류를 던진다.
 * 화면은 `ApiError.code` 만 보고 분기한다.
 */
export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED' // 로그인 필요 또는 세션 무효
  | 'FORBIDDEN' // 로그인했지만 역할 권한이 없음
  | 'PRICE_CHANGED' // details.currentUnitPrice 에 현재 가격
  | 'OUT_OF_STOCK'
  | 'NOT_ON_SALE'
  | 'INVALID_STATE' // 허용되지 않는 상태 전이 (주문·상품·방송)
  | 'CONFLICT' // 다른 수정이 먼저 반영됨 — 최신 내용을 확인해야 한다
  | 'VALIDATION'
  | 'NETWORK'
  | 'UNKNOWN'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError
