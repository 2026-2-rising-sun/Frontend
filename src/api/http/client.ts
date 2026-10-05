import { ApiError, type ApiErrorCode } from '../../domain/errors'

interface RequestOptions {
  headers?: Record<string, string>
  anonymous?: boolean
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'
  query?: Record<string, string | number | undefined | null>
  /** JSON 으로 보낼 객체, 또는 파일 업로드용 FormData */
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
  'FORBIDDEN',
  'PRICE_CHANGED',
  'OUT_OF_STOCK',
  'NOT_ON_SALE',
  'INVALID_STATE',
  'CONFLICT',
  'VALIDATION',
]

const toErrorCode = (status: number, code?: string): ApiErrorCode => {
  if (code && (KNOWN_CODES as string[]).includes(code)) return code as ApiErrorCode
  if (status === 409) return 'CONFLICT'
  if (status === 404) return 'NOT_FOUND'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 400 || status === 422) return 'VALIDATION'
  return 'UNKNOWN'
}

/** fetch 래퍼. 백엔드 오류 응답을 ApiError 로 통일한다. */
export function createHttpClient(baseUrl: string, auth?: { accessToken: () => string | undefined; unauthorized: (token: string) => void }) {
  const base = baseUrl.replace(/\/$/, '')

  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${base}${path}`, window.location.origin)
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
    }

    const token = options.anonymous ? undefined : auth?.accessToken()
    const headers: Record<string, string> = { ...options.headers }
    if (token) headers.Authorization = `Bearer ${token}`
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
    let response: Response
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
      })
    } catch {
      throw new ApiError('NETWORK', '서버에 연결하지 못했어요.')
    }

    if (!response.ok) {
      if (response.status === 401 && token) auth?.unauthorized(token)
      const payload = await response.json().catch(() => ({}))
      const body = (payload.error ?? payload) as ErrorBody
      throw new ApiError(
        toErrorCode(response.status, body.code),
        body.message ?? '요청을 처리하지 못했어요.',
        body.details,
      )
    }

    if (response.status === 204) return undefined as T
    const payload = await response.json()
    return (payload.success === true ? payload.data : payload) as T
  }
}

export type HttpClient = ReturnType<typeof createHttpClient>
