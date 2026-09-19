interface ImportMetaEnv {
  /** 'true' 면 src/mocks 를 API 로 사용한다 (백엔드 없이 동작) */
  readonly VITE_USE_MOCK?: string
  /** 실제 백엔드 base URL. 기본값 '/api' */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
