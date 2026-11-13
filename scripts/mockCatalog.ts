import type { IncomingMessage } from 'node:http'
import { seeded, type MockReply } from './mockServer.ts'

// Prism 모의 서버의 상품은 계약 예시 "가을 니트" 하나뿐이라 카테고리, 랭킹, 검색 화면을 확인하기 어렵다.
// 로컬 Prism 모드에서만 카테고리마다 15~20개 상품을 만들어 목록, 상세, 상품 이미지를 직접 응답한다.
// 브랜드, 원가, 만족도, 무료배송은 아직 Backend 계약에 없는 화면 확인용 필드다. 씨앗이 고정이라 실행할 때마다 같은 상품이 나온다.

type Category = 'FASHION' | 'BEAUTY' | 'FOOD' | 'LIVING' | 'DIGITAL' | 'KIDS' | 'ETC'
interface Catalog { brands: string[]; items: [emoji: string, name: string][]; price: [min: number, max: number]; colors: [string, string] }

const CATALOG: Record<Category, Catalog> = {
  FASHION: { brands: ['드넬', '모노웨어', '어반핏', '라온', '시티무드'], price: [29000, 249000], colors: ['#f3e8ff', '#d8b4fe'],
    items: [['🧥', '울 블렌디드 벨티드 하프코트'], ['🧶', '캐시미어 라운드 니트'], ['👖', '와이드 데님 팬츠'], ['👟', '데일리 러닝 스니커즈'], ['👜', '미니 숄더백'], ['🧣', '램스울 머플러'], ['👕', '오버핏 기모 맨투맨'], ['🧤', '니트 장갑 세트']] },
  BEAUTY: { brands: ['수분결', '라벨르', '퓨어랩', '메르시', '오롯'], price: [9000, 69000], colors: ['#ffe4ec', '#fda4af'],
    items: [['🧴', '히알루론 수분 크림'], ['💄', '벨벳 립 틴트'], ['🧼', '약산성 클렌징 폼'], ['🌸', '데일리 톤업 선크림'], ['💅', '젤 네일 스티커'], ['🪞', '커버 쿠션 리필 포함'], ['🫧', '버블 클렌저'], ['🌿', '시카 진정 앰플']] },
  FOOD: { brands: ['으뜸한돈', '진한식품', '이쌀이다', '바다곳간', '과일상회'], price: [8000, 59000], colors: ['#fef3c7', '#fcd34d'],
    items: [['🥩', '국내산 냉장 삼겹살 1kg'], ['🍲', '바른 도가니탕 500g X 4팩'], ['🍚', '햅쌀 특등급 10kg'], ['🍊', '제주 감귤 3kg'], ['🦐', '손질 새우 1kg'], ['🍓', '설향 딸기 500g'], ['🥟', '고기 왕만두 1.4kg'], ['☕', '콜드브루 원액 1L']] },
  LIVING: { brands: ['살림공방', '코지홈', '데이린넨', '정리왕', '숲내음'], price: [9000, 129000], colors: ['#e0f2fe', '#7dd3fc'],
    items: [['🛏️', '극세사 겨울 이불 세트'], ['🕯️', '소이 캔들 디퓨저'], ['🧺', '접이식 수납 바구니'], ['🍳', '인덕션 통주물 프라이팬'], ['🪴', '공기정화 식물 화분'], ['🧹', '무선 물걸레 청소기'], ['🫖', '유리 티포트 세트'], ['🛁', '호텔 수건 5장']] },
  DIGITAL: { brands: ['소닉랩', '픽셀원', '에어모션', '라이트온', '볼트'], price: [19000, 399000], colors: ['#e2e8f0', '#94a3b8'],
    items: [['🎧', '노이즈 캔슬링 무선 헤드폰'], ['⌚', '스마트 워치 GPS'], ['🔋', '고속 충전 보조배터리 20000mAh'], ['⌨️', '무선 기계식 키보드'], ['🖱️', '저소음 무선 마우스'], ['📷', '액션캠 4K'], ['🔊', '블루투스 스피커'], ['💡', '스마트 LED 무드등']] },
  KIDS: { brands: ['아이숲', '꼬마랑', '베베로운', '토이랜드', '몽글'], price: [9000, 159000], colors: ['#dcfce7', '#86efac'],
    items: [['🧸', '애착 곰인형'], ['🧩', '원목 퍼즐 세트'], ['👶', '유기농 아기 내복'], ['🎒', '초등 경량 책가방'], ['🖍️', '세척되는 크레파스 24색'], ['🚲', '유아 밸런스 바이크'], ['🍼', '젖병 소독기'], ['📚', '그림책 전집 10권']] },
  ETC: { brands: ['펫앤미', '캠핑로그', '하루문구', '트립백', '오피스핏'], price: [5000, 189000], colors: ['#ffedd5', '#fdba74'],
    items: [['🐶', '반려견 겨울 패딩'], ['⛺', '원터치 캠핑 텐트'], ['✏️', '젤펜 12색 세트'], ['🧳', '기내용 캐리어 20인치'], ['🪑', '사무용 메쉬 의자'], ['🎨', '아크릴 물감 세트'], ['🏕️', '캠핑 의자 2개'], ['🐱', '고양이 스크래쳐']] },
}
const SUFFIXES = [' 1+1', ' 기획세트', ' 단독 구성', ' 시즌 신상', ' 대용량', ' 선물 포장']
const DAY_MS = 24 * 60 * 60 * 1000

export interface Satisfaction { veryGood: number; good: number; bad: number; veryBad: number }
export interface MockProduct {
  productId: number; name: string; description: string; mainImageUrl: string; price: number; available: number
  salesStatus: 'ON_SALE' | 'SOLD_OUT'; purchasable: boolean; category: Category; createdAt: string
  brandName: string; originalPrice: number | null; satisfaction: Satisfaction; freeShipping: boolean; emoji: string
}

const round100 = (value: number) => Math.round(value / 100) * 100

/** 리뷰 수와 만족도 4단계 인원. 대체로 만족 쪽이 많고, 일부 상품은 리뷰가 없다. */
function satisfaction(random: () => number): Satisfaction {
  if (random() < 0.1) return { veryGood: 0, good: 0, bad: 0, veryBad: 0 }
  const total = Math.floor(10 ** (0.5 + random() * 3.5))
  const veryGood = Math.round(total * (0.45 + random() * 0.45))
  const good = Math.round((total - veryGood) * (0.3 + random() * 0.4))
  const bad = Math.round((total - veryGood - good) * 0.6)
  return { veryGood, good, bad, veryBad: total - veryGood - good - bad }
}

/** 카테고리마다 15~20개 상품. 같은 씨앗이면 같은 목록이다. */
export function mockProducts(random = seeded(20261113)): MockProduct[] {
  const products: MockProduct[] = []
  const now = Date.now()
  for (const [category, catalog] of Object.entries(CATALOG) as [Category, Catalog][]) {
    const count = 15 + Math.floor(random() * 6)
    for (let i = 0; i < count; i++) {
      const [emoji, item] = catalog.items[i % catalog.items.length]
      const brandName = catalog.brands[Math.floor(random() * catalog.brands.length)]
      const name = `${item}${i < catalog.items.length ? '' : SUFFIXES[Math.floor(random() * SUFFIXES.length)]}`
      const list = round100(catalog.price[0] + random() * (catalog.price[1] - catalog.price[0]))
      const discounted = random() < 0.8
      const price = discounted ? round100(list * (1 - (0.1 + random() * 0.5))) : list
      const available = random() < 0.1 ? 0 : 1 + Math.floor(random() * 80)
      const productId = products.length + 1
      products.push({
        productId, name, description: `${brandName}의 ${item}. 로컬 모의 상품입니다.`, mainImageUrl: `/api/catalog/v1/mock-images/${productId}.svg`,
        price, available, salesStatus: available ? 'ON_SALE' : 'SOLD_OUT', purchasable: available > 0, category,
        createdAt: new Date(now - Math.floor(random() * 30 * DAY_MS)).toISOString(),
        brandName, originalPrice: discounted ? list : null, satisfaction: satisfaction(random), freeShipping: random() < 0.6, emoji,
      })
    }
  }
  return products
}

/** 상품 이미지 대신 쓰는 그림. 카테고리 색 바탕에 상품 이모지를 크게 그린다. */
export function productImage(product: MockProduct) {
  const [from, to] = CATALOG[product.category].colors
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="600" height="600" fill="url(#g)"/>
<circle cx="${420 + product.productId % 5 * 20}" cy="${150 + product.productId % 3 * 30}" r="150" fill="#fff" opacity="0.35"/>
<text x="300" y="330" font-size="240" text-anchor="middle" dominant-baseline="middle">${product.emoji}</text>
</svg>`
}

const SORTS = {
  LATEST: (a: MockProduct, b: MockProduct) => b.createdAt.localeCompare(a.createdAt),
  PRICE_ASC: (a: MockProduct, b: MockProduct) => a.price - b.price,
  PRICE_DESC: (a: MockProduct, b: MockProduct) => b.price - a.price,
}

/** 상품 목록, 상세, 이미지 요청에 답한다. 그 밖의 요청(쿠폰, 구매 확인 등)은 undefined 를 돌려 Prism 에 맡긴다. */
export function catalogMock(products = mockProducts()) {
  return (url: URL, req: IncomingMessage): MockReply | undefined => {
    if (req.method !== 'GET') return
    const image = url.pathname.match(/^\/v1\/mock-images\/(\d+)\.svg$/)
    if (image) {
      const product = products.find(item => item.productId === Number(image[1]))
      return product && { body: productImage(product), type: 'image/svg+xml' }
    }
    const detail = url.pathname.match(/^\/v1\/products\/(\d+)$/)
    if (detail) {
      const product = products.find(item => item.productId === Number(detail[1]))
      return product && { body: { ...product, maxQuantity: Math.min(product.available, 10) } }
    }
    if (url.pathname !== '/v1/products') return
    const q = url.searchParams.get('q')?.trim(), status = url.searchParams.get('status'), category = url.searchParams.get('category')
    const sort = SORTS[url.searchParams.get('sort') as keyof typeof SORTS] ?? SORTS.LATEST
    const found = products
      .filter(item => !q || item.name.includes(q) || item.brandName.includes(q))
      .filter(item => !status || item.salesStatus === status)
      .filter(item => !category || item.category === category)
      .toSorted(sort)
    const from = Number(url.searchParams.get('cursor') ?? 0) || 0
    const size = Math.min(Number(url.searchParams.get('size') ?? 20) || 20, 50)
    const hasNext = from + size < found.length
    return { body: { items: found.slice(from, from + size), nextCursor: hasNext ? String(from + size) : null, hasNext } }
  }
}
