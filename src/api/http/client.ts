import { ApiError, type ApiErrorCode } from '../../domain/errors'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number | undefined | null>
  body?: unknown
}

interface ErrorBody {
  code?: string
  message?: string
  details?: Record<string, unknown>
}

const KNOWN_CODES: ApiErrorCode[] = [
  'NOT_FOUND',
  'UNAUTHORIZED',
  'PRICE_CHANGED',
  'OUT_OF_STOCK',
  'NOT_ON_SALE',
  'INVALID_STATE',
  'VALIDATION',
]

const toErrorCode = (status: number, code?: string): ApiErrorCode => {
  if (code && (KNOWN_CODES as string[]).includes(code)) return code as ApiErrorCode
  if (status === 404) return 'NOT_FOUND'
  if (status === 401 || status === 403) return 'UNAUTHORIZED'
  if (status === 400 || status === 422) return 'VALIDATION'
  return 'UNKNOWN'
}

/** fetch 래퍼. 백엔드 오류 응답을 ApiError 로 통일한다. */
export function createHttpClient(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, '')

  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${base}${path}`, window.location.origin)
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined,
      })
    } catch {
      throw new ApiError('NETWORK', '서버에 연결하지 못했어요.')
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ErrorBody
      throw new ApiError(
        toErrorCode(response.status, body.code),
        body.message ?? '요청을 처리하지 못했어요.',
        body.details,
      )
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }
}

export type HttpClient = ReturnType<typeof createHttpClient>
