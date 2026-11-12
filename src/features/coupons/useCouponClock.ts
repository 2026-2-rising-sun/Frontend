import { useEffect, useState } from 'react'

/** 발급·사용 기한이 지나면 화면을 갱신한다. 최종 판정은 기존 서버 API가 담당한다. */
export function useCouponClock(dates: string[]) {
  const [now, setNow] = useState(Date.now)
  const key = dates.join('|')
  useEffect(() => {
    const deadlines = key.split('|').map(Date.parse).filter(Number.isFinite)
    let timer: ReturnType<typeof setTimeout>
    function tick() {
      const current = Date.now()
      setNow(current)
      const next = Math.min(...deadlines.filter(deadline => deadline > current))
      if (Number.isFinite(next)) timer = setTimeout(tick, Math.min(next - current + 1, 2_147_483_647))
    }
    timer = setTimeout(tick, 0)
    return () => clearTimeout(timer)
  }, [key])
  return now
}
