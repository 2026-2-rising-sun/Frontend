import { loadTossPayments, type TossPaymentsSDK } from '@tosspayments/tosspayments-sdk'
import type { PaymentAuthentication } from '../../domain/orderSheets'
import { beginWidgetReturn, discardWidgetIntent } from './widgetReturn'
import styles from './TossWidgetDialog.module.css'
export interface WidgetConfiguration { clientKey: string; customerKey: string }
export type WidgetConfigurationResolver = (memberId: string) => Promise<WidgetConfiguration>
/** customerKey는 인증된 설정 공급자가 주입한다. 회원ID/전화번호로 추정하거나 새 고객키를 발급하지 않는다. */
export function tossWidgetAuthentication(options: {
  memberId: () => string | undefined
  configuration: WidgetConfigurationResolver
  load?: (clientKey: string) => Promise<TossPaymentsSDK>
}): PaymentAuthentication {
  return {
    async authenticate(input) {
      const memberId = options.memberId()
      if (!memberId) throw new Error('로그인 상태를 확인해 주세요.')
      const config = await options.configuration(memberId)
      if (!/^(test|live)_gck_/.test(config.clientKey) || !/^[A-Za-z0-9_=.@-]{22,255}$/.test(config.customerKey)) throw new Error('위젯 공개키와 고객키 설정을 확인해 주세요.')
      if (input.signal?.aborted) return null
      const sdk = await (options.load ?? loadTossPayments)(config.clientKey)
      if (input.signal?.aborted) return null
      const widgets = sdk.widgets({ customerKey: config.customerKey })
      const dialog = document.createElement('dialog'); dialog.className = styles.dialog; dialog.setAttribute('aria-label', '결제 수단 선택')
      const title = document.createElement('h2'); title.textContent = '결제 수단 선택'
      const methods = document.createElement('div'); const agreement = document.createElement('div')
      const id = crypto.randomUUID(); methods.id = `payment-methods-${id}`; agreement.id = `payment-agreement-${id}`
      const error = document.createElement('p'); error.className = styles.error; error.setAttribute('role', 'alert')
      const actions = document.createElement('div'); actions.className = styles.actions
      const pay = document.createElement('button'); pay.type = 'button'; pay.textContent = '선택한 수단으로 인증'; pay.disabled = true
      const close = document.createElement('button'); close.type = 'button'; close.textContent = '결제창 닫기'
      actions.append(pay, close); dialog.append(title, methods, agreement, error, actions); document.body.append(dialog); dialog.showModal()
      const resources: { destroy(): Promise<void> }[] = []
      let settled = false; let sending = false; let intent: string | undefined
      return new Promise<null>((resolve, reject) => {
        const cleanup = () => { input.signal?.removeEventListener('abort', aborted); dialog.remove(); for (const resource of resources) void resource.destroy().catch(() => undefined) }
        const finish = (force = false) => { if (settled || (sending && !force)) return; settled = true; if (intent) discardWidgetIntent(intent); cleanup(); resolve(null) }
        const aborted = () => finish(true)
        input.signal?.addEventListener('abort', aborted, { once: true })
        close.onclick = () => finish()
        dialog.oncancel = event => { event.preventDefault(); finish() }
        pay.onclick = async () => {
          if (settled || sending || pay.disabled) return
          sending = true; pay.disabled = true; close.disabled = true; error.textContent = ''
          try {
            const urls = beginWidgetReturn({ memberId, orderNumber: input.orderNumber, pgOrderId: input.pgOrderId, amount: input.amount }, window.location.origin); intent = urls.state
            // Redirect 방식을 사용한다. 이 Promise의 완료를 인증 성공이나 승인으로 해석하지 않는다.
            await widgets.requestPayment({ windowTarget: 'self', orderId: input.pgOrderId, orderName: `주문 ${input.orderNumber}`.slice(0, 100), successUrl: urls.successUrl, failUrl: urls.failUrl })
          } catch (cause) {
            if (intent) discardWidgetIntent(intent)
            const code = typeof cause === 'object' && cause !== null && 'code' in cause ? cause.code : undefined
            if (code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED') { sending = false; finish(); return }
            error.textContent = '인증 창을 열지 못했어요. 결제 수단과 약관을 확인해 주세요.'
            sending = false; pay.disabled = false; close.disabled = false
          }
        }
        void (async () => {
          try {
            await widgets.setAmount({ currency: 'KRW', value: input.amount })
            // 렌더 중 창이 닫혀도 생성된 SDK 자원을 회수한다.
            const method = await widgets.renderPaymentMethods({ selector: `#${methods.id}` }); if (settled) { await method.destroy(); return }; resources.push(method)
            const terms = await widgets.renderAgreement({ selector: `#${agreement.id}` }); if (settled) { await terms.destroy(); return }; resources.push(terms)
            pay.disabled = false
          } catch (cause) { if (!settled) { settled = true; cleanup(); reject(cause) } }
        })()
      })
    },
  }
}
