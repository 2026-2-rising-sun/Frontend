import type { Product, ProductCategory } from './types'

/** 배너 바탕색. 서버가 모르는 값을 주면 기본색을 쓴다. */
export const EXHIBITION_TONES = ['lavender', 'sky', 'blush', 'mint', 'slate', 'peach'] as const
export type ExhibitionTone = typeof EXHIBITION_TONES[number]

/**
 * 테마 기획전. 운영자가 주제를 정하고 상품을 골라 기간 동안 묶어 보여 준다. 카탈로그가 관리한다.
 * 홈 "Today's Brand" 기획전 카드와 기획전 목록 화면(/exhibitions)을 진행 중인 기획전 목록으로 채운다.
 */
export interface ExhibitionSummary {
  id: string
  title: string
  /** 배너에 크게 쓰는 문구. 줄바꿈은 배열 원소로 나눈다 */
  headline: string[]
  description: string
  /** 배너 그림 대신 쓰는 이모지 */
  art: string[]
  tone: ExhibitionTone
  /** 기획전 목록의 분류 칸에서 고르는 분류. null 은 분류 없음(전체에서만 보인다). */
  category: ProductCategory | null
  startsAt: string
  endsAt: string
  /** 홈 배너 카드와 기획전 목록에 보일 대표 상품. 첫 상품을 크게 보인다. 목록 API만 채운다(최대 3개). */
  previewProducts: Product[]
}

export interface ExhibitionSection { title: string; products: Product[] }
export interface Exhibition extends ExhibitionSummary { sections: ExhibitionSection[] }

export type ExhibitionState = 'UPCOMING' | 'ACTIVE' | 'ENDED'
export function exhibitionState(exhibition: ExhibitionSummary, now: number): ExhibitionState {
  if (now < Date.parse(exhibition.startsAt)) return 'UPCOMING'
  return now < Date.parse(exhibition.endsAt) ? 'ACTIVE' : 'ENDED'
}

export interface ExhibitionsPort {
  /** 지금 진행 중인 기획전 */
  list(): Promise<ExhibitionSummary[]>
  get(id: string): Promise<Exhibition>
}
