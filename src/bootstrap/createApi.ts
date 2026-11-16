import { authenticationDouble } from '../api/testing/paymentAuthenticationDouble'
import { createHttpApi } from '../api/http'
export async function bootstrap() {
  const api = createHttpApi(import.meta.env.VITE_API_BASE_URL ?? '/api', import.meta.env.DEV)
  await api.auth.restore()
  const doubleUrl = import.meta.env.DEV ? import.meta.env.VITE_PG_AUTH_DOUBLE_URL : undefined
  return { api, paymentAuthentication: doubleUrl ? authenticationDouble(doubleUrl) : undefined }
}
