import { EXHIBITION_TONES, isExhibitionCategory, type Exhibition, type ExhibitionSummary, type ExhibitionTone, type ExhibitionsPort } from '../../domain/exhibitions'
import type { HttpClient } from './client'
import { product, type ProductDto } from './mappers'

type SummaryDto = Omit<ExhibitionSummary, 'id' | 'tone' | 'category' | 'previewProducts'> & { id: string | number; tone?: string | null; category?: string | null; previewProducts?: ProductDto[] | null }
type ExhibitionDto = SummaryDto & { sections: { title: string; products: ProductDto[] }[] }

const tone = (value?: string | null): ExhibitionTone => EXHIBITION_TONES.includes(value as ExhibitionTone) ? value as ExhibitionTone : 'lavender'
const summary = ({ id, tone: value, category, previewProducts, ...rest }: SummaryDto): ExhibitionSummary =>
  ({ ...rest, id: String(id), tone: tone(value), category: isExhibitionCategory(category) ? category : null, previewProducts: (previewProducts ?? []).map(product) })

/** 기획전은 카탈로그가 관리하고 로그인 없이 본다. */
export function createExhibitions(publicRequest: HttpClient): ExhibitionsPort {
  return {
    list: async () => (await publicRequest<SummaryDto[]>('/catalog/v1/exhibitions')).map(summary),
    async get(id) {
      const { sections, ...rest } = await publicRequest<ExhibitionDto>(`/catalog/v1/exhibitions/${encodeURIComponent(id)}`)
      const exhibition: Exhibition = { ...summary(rest), sections: sections.map(section => ({ title: section.title, products: section.products.map(product) })) }
      return exhibition
    },
  }
}
