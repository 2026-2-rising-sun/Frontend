import type { Satisfaction } from '../../domain/types'

/** 만족도 4단계. stars 는 단계 옆에 칠하는 별 개수다. */
export const SATISFACTION_LEVELS = [
  { key: 'veryGood', label: '매우 만족해요', stars: 4 },
  { key: 'good', label: '만족해요', stars: 3 },
  { key: 'bad', label: '아쉬워요', stars: 2 },
  { key: 'veryBad', label: '매우 아쉬워요', stars: 1 },
] as const satisfies readonly { key: keyof Satisfaction; label: string; stars: number }[]

export const reviewCount = (s: Satisfaction | null | undefined) => s ? s.veryGood + s.good + s.bad + s.veryBad : 0

/** "매우 만족해요"와 "만족해요"를 고른 비율(%). 리뷰가 없으면 null. */
export function satisfiedPercent(s: Satisfaction | null | undefined) {
  const total = reviewCount(s)
  return s && total ? Math.round((s.veryGood + s.good) / total * 100) : null
}

/** 단계별 비율(%). 리뷰가 없으면 모두 0. */
export const levelPercent = (s: Satisfaction, key: keyof Satisfaction) => {
  const total = reviewCount(s)
  return total ? Math.round(s[key] / total * 100) : 0
}
