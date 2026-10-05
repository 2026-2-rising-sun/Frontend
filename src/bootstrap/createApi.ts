import { createHttpApi } from '../api/http'
export async function bootstrap() {
  return { api: createHttpApi(import.meta.env.VITE_API_BASE_URL ?? '/api', import.meta.env.DEV) }
}
