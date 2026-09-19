import { useState } from 'react'
import { updateMockSettings, useMockSettings, type PaymentScenario } from './control'
import { resetDb } from './db'
import styles from './MockControlPanel.module.css'

const SCENARIOS: { value: PaymentScenario; label: string }[] = [
  { value: 'SUCCESS', label: '즉시 성공' },
  { value: 'FAIL', label: '즉시 실패' },
  { value: 'DELAYED_SUCCESS', label: '지연 후 성공' },
  { value: 'DELAYED_FAIL', label: '지연 후 실패' },
]

/** 시연용 플로팅 패널. mock 모드에서만 렌더링된다. */
export function MockControlPanel() {
  const [open, setOpen] = useState(false)
  const settings = useMockSettings()

  const reset = () => {
    resetDb()
    window.location.assign('/')
  }

  return (
    <div className={styles.root}>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Mock 설정">
          <p className={styles.title}>Mock 설정</p>
          <p className={styles.note}>백엔드 없이 동작하는 시연용 스위치입니다.</p>

          <label className={styles.field}>
            <span>Mock 결제 시나리오</span>
            <select
              value={settings.paymentScenario}
              onChange={(e) => updateMockSettings({ paymentScenario: e.target.value as PaymentScenario })}
            >
              {SCENARIOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>지연 시나리오 확정 시간: {settings.confirmDelayMs / 1000}초</span>
            <input
              type="range"
              min={1000}
              max={15000}
              step={1000}
              value={settings.confirmDelayMs}
              onChange={(e) => updateMockSettings({ confirmDelayMs: Number(e.target.value) })}
            />
          </label>

          <label className={styles.field}>
            <span>네트워크 지연: {settings.latencyMs}ms</span>
            <input
              type="range"
              min={0}
              max={2000}
              step={100}
              value={settings.latencyMs}
              onChange={(e) => updateMockSettings({ latencyMs: Number(e.target.value) })}
            />
          </label>

          <label className={styles.field}>
            <span>미결제 주문 만료</span>
            <select value={settings.orderExpiryMs} onChange={(e) => updateMockSettings({ orderExpiryMs: Number(e.target.value) })}>
              <option value={0}>사용 안 함 (기본)</option>
              <option value={30000}>30초 (시연용)</option>
              <option value={60000}>1분</option>
              <option value={300000}>5분</option>
              <option value={900000}>15분</option>
            </select>
          </label>

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.failReads}
              onChange={(e) => updateMockSettings({ failReads: e.target.checked })}
            />
            <span>상품·방송 조회 실패시키기</span>
          </label>

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={settings.failPaymentStart}
              onChange={(e) => updateMockSettings({ failPaymentStart: e.target.checked })}
            />
            <span>결제 시작 요청 실패시키기 (주문은 &lsquo;결제 전&rsquo;으로 남음)</span>
          </label>

          <button type="button" className={styles.reset} onClick={reset}>
            데이터 초기화 (재고·주문)
          </button>
        </div>
      )}
      <button type="button" className={styles.fab} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        MOCK
      </button>
    </div>
  )
}
