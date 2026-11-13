import type { ProductCategory } from './types'

/**
 * 분류별 세부 분류. 아직 Backend 계약에 없어 화면과 로컬 모의 서버가 같이 쓰는 목록이다.
 * "기타" 같은 묶음 없이, 상품이 하나뿐이어도 이름 있는 세부 분류에 넣는다.
 */
export const SUBCATEGORIES: Partial<Record<ProductCategory, { value: string; label: string }[]>> = {
  FOOD: [
    { value: 'fresh', label: '쌀/과일/농축수산물' },
    { value: 'processed', label: '가공식품' },
    { value: 'drink', label: '음료/생수/커피' },
  ],
  LIVING: [
    { value: 'bedding', label: '침구/커튼/카페트' },
    { value: 'interior', label: '홈/인테리어/가드닝' },
    { value: 'storage', label: '수납/정리/선반' },
    { value: 'kitchen', label: '주방/식기/용기' },
    { value: 'bath', label: '욕실/청소/세제' },
    { value: 'toy', label: '완구/장난감/교구' },
    { value: 'hobby', label: '악기/취미/만들기' },
    { value: 'stationery', label: '문구/사무/용지' },
    { value: 'book', label: '도서/음반/DVD' },
    { value: 'camping', label: '등산/캠핑/낚시' },
    { value: 'bike', label: '자전거/인라인/모터사이클' },
    { value: 'furniture', label: '홈오피스/키즈가구' },
    { value: 'pet', label: '반려동물/애완용품' },
  ],
  DIGITAL: [
    { value: 'audio', label: '음향가전/스피커/학습기기' },
    { value: 'mobile', label: '휴대폰/액세서리' },
    { value: 'pc', label: '프린터/PC주변/사무기기' },
    { value: 'camera', label: '카메라/캠코더/주변기기' },
    { value: 'home', label: '생활가전/세탁기/청소기' },
    { value: 'kitchen', label: '주방가전/냉장고/전기밥솥' },
  ],
  BEAUTY: [
    { value: 'skin', label: '스킨케어/메이크업' },
    { value: 'body', label: '향수/바디/헤어' },
  ],
  FASHION: [
    { value: 'women', label: '여성의류' },
    { value: 'men', label: '남성의류' },
    { value: 'shoes', label: '신발/수제화' },
    { value: 'bag', label: '가방/지갑/잡화' },
    { value: 'kids', label: '유아동의류/신발/가방' },
    { value: 'pet', label: '반려동물/애완용품' },
  ],
}

export const subcategoriesOf = (category: ProductCategory | null | undefined) => (category && SUBCATEGORIES[category]) || []
export const subcategoryLabel = (category: ProductCategory | null | undefined, value: string | null | undefined) =>
  subcategoriesOf(category).find(item => item.value === value)?.label ?? null
