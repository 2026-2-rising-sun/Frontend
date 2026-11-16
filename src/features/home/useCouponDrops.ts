import { useEffect, useState } from 'react'
import { useApi } from '../../app/apiContext'
import { couponDropState } from '../../domain/couponDrops'
import { useAsync } from '../../hooks/useAsync'
import { toKstInputValue } from '../../lib/format'

/** 진행 중인 쿠폰이 있으면 남은 수량을 이 간격으로 다시 불러온다. */
const POLL_MS = 10_000
/** "HH:mm" (한국 시간) */
export const kstTime = (iso: string) => toKstInputValue(iso).slice(11, 16)
/** 남은 시간 "01:12:30" */
export function countdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(n => String(n).padStart(2, '0')).join(':')
}

/** 1초마다 바뀌는 현재 시각. until(마지막 쿠폰의 받기 마감)이 지나면 멈춘다. */
function useTicker(until: number) {
  const [now, setNow] = useState(Date.now)
  const active = now < until
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

/**
 * 오늘의 선착순 쿠폰. 1초마다 남은 시간을 갱신하고, 진행 중인 쿠폰이 있으면 남은 수량을 다시 불러온다.
 * hour 는 매일 쿠폰이 열리는 시각(가장 먼저 열리는 쿠폰 기준)이고, 쿠폰이 없으면 null 이다.
 */
export function useCouponDrops() {
  const api = useApi()
  const drops = useAsync(() => api.couponDrops.today(), [api])
  const items = drops.data ?? []
  const now = useTicker(Math.max(0, ...items.map(drop => Date.parse(drop.endsAt))))
  const open = items.some(drop => couponDropState(drop, now) === 'OPEN')
  const { reload } = drops
  useEffect(() => {
    if (!open) return
    const timer = setInterval(reload, POLL_MS)
    return () => clearInterval(timer)
  }, [open, reload])
  const hour = items.length ? Number(kstTime(items.map(drop => drop.opensAt).toSorted()[0]).slice(0, 2)) : null
  return { items, now, hour, reload }
}

export type CouponDrops = ReturnType<typeof useCouponDrops>
