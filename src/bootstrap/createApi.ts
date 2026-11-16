import { captureWidgetReturn } from '../features/commerce/widgetReturn'
import { tossWidgetAuthentication, type WidgetConfigurationResolver } from '../features/commerce/tossWidgetAuthentication'
import { authenticationDouble } from '../api/testing/paymentAuthenticationDouble'
import { createHttpApi } from '../api/http'
export async function bootstrap(options: { paymentWidgetConfiguration?: WidgetConfigurationResolver } = {}) {
  captureWidgetReturn()
  const api = createHttpApi(import.meta.env.VITE_API_BASE_URL ?? '/api', import.meta.env.DEV)
  await api.auth.restore()
  const doubleUrl = import.meta.env.DEV ? import.meta.env.VITE_PG_AUTH_DOUBLE_URL : undefined
  return { api, paymentAuthentication: options.paymentWidgetConfiguration ? tossWidgetAuthentication({ memberId: () => api.auth.getSession()?.memberId, configuration: options.paymentWidgetConfiguration }) : doubleUrl ? authenticationDouble(doubleUrl) : undefined }
}
