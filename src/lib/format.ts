const KST = 'Asia/Seoul'

export const formatPrice = (value: number) => `${value.toLocaleString('ko-KR')}원`

const shortFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST,
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const fullFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** 한국 시간 기준. 예: 9월 20일 (일) 20:00 */
export const formatDateTime = (iso: string) => shortFormatter.format(new Date(iso))

/** 한국 시간 기준. 예: 2026. 09. 19. 20:33 */
export const formatFullDateTime = (iso: string) => fullFormatter.format(new Date(iso))

const timeFormatter = new Intl.DateTimeFormat('ko-KR', { timeZone: KST, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

/** 한국 시간 기준 시각. 예: 20:33:12 */
export const formatTime = (date: Date) => timeFormatter.format(date)

const kstParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: KST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** ISO 시각 → <input type="datetime-local"> 값(한국 시간). 예: 2026-09-20T20:00 */
export const toKstInputValue = (iso: string) => {
  const p = Object.fromEntries(kstParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** <input type="datetime-local"> 값(한국 시간으로 입력) → ISO 8601. 값이 비었으면 빈 문자열. */
export const fromKstInputValue = (value: string) => (value ? new Date(`${value}:00+09:00`).toISOString() : '')
