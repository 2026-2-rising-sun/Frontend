import type { Product } from './types'

/** 배너 바탕색. 서버가 모르는 값을 주면 기본색을 쓴다. */
export const EXHIBITION_TONES = ['lavender', 'sky', 'blush', 'mint', 'slate', 'peach'] as const
export type ExhibitionTone = typeof EXHIBITION_TONES[number]

/**
 * 기획전 목록의 분류 칸. 상단바 대표 분류보다 잘게 나눈 기획전 전용 분류다.
 * 운영자가 기획전을 만들 때 하나를 고른다. 화면 순서 그대로다.
 */
export const EXHIBITION_CATEGORIES = [
  { value: 'skincare', label: '스킨케어' },
  { value: 'makeup', label: '메이크업' },
  { value: 'cleansing', label: '클렌징' },
  { value: 'body-hair', label: '바디/헤어' },
  { value: 'fresh', label: '신선식품' },
  { value: 'meal', label: '간편식/가공식품' },
  { value: 'drink', label: '음료/커피' },
  { value: 'kitchen', label: '주방용품' },
  { value: 'interior', label: '홈/인테리어' },
  { value: 'cleaning', label: '생활/청소' },
  { value: 'kids', label: '유아동/완구' },
  { value: 'hobby', label: '캠핑/취미' },
  { value: 'pet', label: '반려동물' },
  { value: 'digital', label: '음향/디지털' },
  { value: 'appliance', label: '생활가전' },
  { value: 'office', label: 'PC/문구' },
  { value: 'women', label: '여성패션' },
  { value: 'men', label: '남성패션' },
  { value: 'fashion-goods', label: '신발/가방/잡화' },
] as const
export type ExhibitionCategory = typeof EXHIBITION_CATEGORIES[number]['value']
export const isExhibitionCategory = (value: string | null | undefined): value is ExhibitionCategory => EXHIBITION_CATEGORIES.some(category => category.value === value)

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
  category: ExhibitionCategory | null
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
