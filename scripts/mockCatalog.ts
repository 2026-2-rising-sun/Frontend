import type { IncomingMessage } from 'node:http'
import { seeded, type MockReply } from './mockServer.ts'

// Prism 모의 서버의 상품은 계약 예시 "가을 니트" 하나뿐이라 카테고리, 랭킹, 검색 화면을 확인하기 어렵다.
// 로컬 Prism 모드에서만 화면에 쓰는 5개 분류(식품, 생활, 가전, 뷰티, 패션)마다 15개 이상 상품을 만들어 목록, 상세, 상품 이미지를 직접 응답한다.
// 브랜드, 원가, 만족도, 무료배송, 옵션은 아직 Backend 계약에 없는 화면 확인용 필드다. 씨앗이 고정이라 실행할 때마다 같은 상품이 나온다.

type Category = 'FOOD' | 'LIVING' | 'DIGITAL' | 'BEAUTY' | 'FASHION'
interface Catalog { brands: string[]; items: [emoji: string, name: string, option: OptionKind, subcategory: string][]; price: [min: number, max: number]; colors: [string, string] }

// 화면 순서(식품, 생활, 가전, 뷰티, 패션). 아이, 반려동물, 캠핑, 문구 상품은 쓰임새에 맞는 분류로 나눠 넣었다.
const CATALOG: Record<Category, Catalog> = {
  FOOD: { brands: ['으뜸한돈', '진한식품', '이쌀이다', '바다곳간', '과일상회'], price: [8000, 59000], colors: ['#fef3c7', '#fcd34d'],
    items: [['🥩', '국내산 냉장 삼겹살 1kg', 'weight', 'fresh'], ['🍲', '바른 도가니탕 500g X 4팩', 'pack', 'processed'], ['🍚', '햅쌀 특등급 10kg', 'none', 'fresh'], ['🍊', '제주 감귤 3kg', 'fruit', 'fresh'], ['🦐', '손질 새우 1kg', 'weight', 'fresh'], ['🍓', '설향 딸기 500g', 'fruit', 'fresh'], ['🥟', '고기 왕만두 1.4kg', 'set', 'processed'], ['☕', '콜드브루 원액 1L', 'set', 'drink']] },
  LIVING: { brands: ['살림공방', '코지홈', '데이린넨', '정리왕', '숲내음'], price: [9000, 129000], colors: ['#e0f2fe', '#7dd3fc'],
    items: [['🛏️', '극세사 겨울 이불 세트', 'bedding', 'bedding'], ['🕯️', '소이 캔들 디퓨저', 'scent', 'interior'], ['🧺', '접이식 수납 바구니', 'set', 'storage'], ['🍳', '인덕션 통주물 프라이팬', 'pan', 'kitchen'], ['🪴', '공기정화 식물 화분', 'none', 'interior'], ['🧹', '무선 물걸레 청소기', 'color', 'bath'], ['🫖', '유리 티포트 세트', 'none', 'kitchen'], ['🛁', '호텔 수건 5장', 'set', 'bath'], ['🧸', '애착 곰인형', 'toy', 'toy'], ['🧩', '원목 퍼즐 세트', 'none', 'toy'], ['🖍️', '세척되는 크레파스 24색', 'set', 'hobby'], ['🚲', '유아 밸런스 바이크', 'color', 'bike'], ['📚', '그림책 전집 10권', 'none', 'book'], ['⛺', '원터치 캠핑 텐트', 'tent', 'camping'], ['✏️', '젤펜 12색 세트', 'set', 'stationery'], ['🪑', '사무용 메쉬 의자', 'color', 'furniture'], ['🎨', '아크릴 물감 세트', 'none', 'hobby'], ['🏕️', '캠핑 의자 2개', 'color', 'camping'], ['🐱', '고양이 스크래쳐', 'none', 'pet']] },
  DIGITAL: { brands: ['소닉랩', '픽셀원', '에어모션', '라이트온', '볼트'], price: [19000, 399000], colors: ['#e2e8f0', '#94a3b8'],
    items: [['🎧', '노이즈 캔슬링 무선 헤드폰', 'color', 'audio'], ['⌚', '스마트 워치 GPS', 'watch', 'mobile'], ['🔋', '고속 충전 보조배터리 20000mAh', 'color', 'mobile'], ['⌨️', '무선 기계식 키보드', 'switch', 'pc'], ['🖱️', '저소음 무선 마우스', 'color', 'pc'], ['📷', '액션캠 4K', 'none', 'camera'], ['🔊', '블루투스 스피커', 'color', 'audio'], ['💡', '스마트 LED 무드등', 'set', 'home'], ['🍼', '젖병 소독기', 'none', 'kitchen']] },
  BEAUTY: { brands: ['수분결', '라벨르', '퓨어랩', '메르시', '오롯'], price: [9000, 69000], colors: ['#ffe4ec', '#fda4af'],
    items: [['🧴', '히알루론 수분 크림', 'volume', 'skin'], ['💄', '벨벳 립 틴트', 'shade', 'skin'], ['🧼', '약산성 클렌징 폼', 'set', 'skin'], ['🌸', '데일리 톤업 선크림', 'set', 'skin'], ['💅', '젤 네일 스티커', 'nail', 'skin'], ['🪞', '커버 쿠션 리필 포함', 'cushion', 'skin'], ['🫧', '버블 클렌저', 'none', 'body'], ['🌿', '시카 진정 앰플', 'volume', 'skin']] },
  FASHION: { brands: ['드넬', '모노웨어', '어반핏', '라온', '시티무드'], price: [29000, 249000], colors: ['#f3e8ff', '#d8b4fe'],
    items: [['🧥', '울 블렌디드 벨티드 하프코트', 'apparel', 'women'], ['🧶', '캐시미어 라운드 니트', 'apparel', 'women'], ['👖', '와이드 데님 팬츠', 'pants', 'men'], ['👟', '데일리 러닝 스니커즈', 'shoes', 'shoes'], ['👜', '미니 숄더백', 'color', 'bag'], ['🧣', '램스울 머플러', 'color', 'bag'], ['👕', '오버핏 기모 맨투맨', 'apparel', 'men'], ['🧤', '니트 장갑 세트', 'color', 'bag'], ['👶', '유기농 아기 내복', 'baby', 'kids'], ['🎒', '초등 경량 책가방', 'color', 'kids'], ['🐶', '반려견 겨울 패딩', 'pet', 'pet'], ['🧳', '기내용 캐리어 20인치', 'color', 'bag']] },
}
/** 상품 특성별 옵션. 값마다 추가 금액(원)을 둘 수 있다. 추가 금액은 기본 가격 대비 비율로 정한다. */
type OptionKind = keyof typeof OPTIONS
type OptionSpec = { name: string; values: [label: string, extra?: number][] }[]
const SIZES: [string][] = [['S'], ['M'], ['L'], ['XL']]
const OPTIONS = {
  none: [],
  apparel: [{ name: '컬러', values: [['블랙'], ['아이보리'], ['네이비'], ['카멜']] }, { name: '사이즈', values: SIZES }],
  pants: [{ name: '컬러', values: [['연청'], ['중청'], ['흑청']] }, { name: '사이즈', values: [['26'], ['28'], ['30'], ['32'], ['34']] }],
  shoes: [{ name: '컬러', values: [['화이트'], ['블랙'], ['그레이']] }, { name: '사이즈', values: [['230'], ['240'], ['250'], ['260'], ['270'], ['280']] }],
  color: [{ name: '컬러', values: [['블랙'], ['화이트'], ['베이지'], ['그레이']] }],
  shade: [{ name: '컬러', values: [['01 로지 핑크'], ['02 코랄 브라운'], ['03 체리 레드'], ['04 누드 베이지']] }],
  nail: [{ name: '디자인', values: [['프렌치'], ['글리터'], ['마블'], ['원컬러']] }],
  cushion: [{ name: '호수', values: [['17호 라이트'], ['21호 내추럴'], ['23호 미디엄']] }],
  volume: [{ name: '용량', values: [['50ml'], ['100ml', 0.6]] }],
  set: [{ name: '구성', values: [['1개'], ['2개 세트', 0.9], ['3개 세트', 1.7]] }],
  pan: [{ name: '사이즈', values: [['24cm'], ['28cm', 0.2]] }, { name: '구성', values: [['1개'], ['2개 세트', 0.9]] }],
  weight: [{ name: '중량', values: [['500g', -0.45], ['1kg'], ['2kg', 0.9]] }],
  pack: [{ name: '구성', values: [['4팩'], ['8팩', 0.85]] }],
  fruit: [{ name: '크기', values: [['중과'], ['대과', 0.25], ['특대과', 0.5]] }],
  bedding: [{ name: '사이즈', values: [['싱글'], ['퀸', 0.3], ['킹', 0.5]] }, { name: '컬러', values: [['크림'], ['그레이'], ['핑크']] }],
  scent: [{ name: '향', values: [['라벤더'], ['우디 앰버'], ['화이트 머스크']] }],
  watch: [{ name: '컬러', values: [['블랙'], ['실버'], ['로즈골드']] }, { name: '사이즈', values: [['41mm'], ['45mm', 0.1]] }],
  switch: [{ name: '스위치', values: [['적축'], ['갈축'], ['청축']] }],
  toy: [{ name: '크기', values: [['30cm'], ['50cm', 0.5]] }],
  baby: [{ name: '사이즈', values: [['70'], ['80'], ['90'], ['100']] }, { name: '컬러', values: [['오트밀'], ['스카이']] }],
  pet: [{ name: '컬러', values: [['베이지'], ['네이비']] }, { name: '사이즈', values: [['S'], ['M'], ['L', 0.15]] }],
  tent: [{ name: '인원', values: [['2인용'], ['4인용', 0.6]] }],
} satisfies Record<string, OptionSpec>

export interface MockOption { name: string; values: { label: string; extraPrice: number; soldOut: boolean }[] }

/** 옵션 값에 추가 금액을 붙이고, 일부 값은 품절로 둔다. 옵션은 상품 번호를 씨앗으로 써서 상품 목록이 바뀌어도 그대로다. */
function productOptions(kind: OptionKind, price: number, productId: number): MockOption[] {
  const random = seeded(productId * 7919)
  return (OPTIONS[kind] as OptionSpec).map(group => ({
    name: group.name,
    values: group.values.map(([label, extra = 0]) => ({ label, extraPrice: round100(price * extra), soldOut: group.values.length > 2 && random() < 0.12 })),
  }))
}

/** 누적 판매량. 다른 값의 난수 순서를 바꾸지 않도록 상품 번호를 씨앗으로 따로 뽑는다. */
const seededSales = (productId: number) => Math.floor(10 ** (1 + seeded(productId * 104729)() * 4))

const SUFFIXES = [' 1+1', ' 기획세트', ' 단독 구성', ' 시즌 신상', ' 대용량', ' 선물 포장']
const DAY_MS = 24 * 60 * 60 * 1000

export interface Satisfaction { veryGood: number; good: number; bad: number; veryBad: number }
export interface MockProduct {
  productId: number; name: string; description: string; mainImageUrl: string; price: number; available: number
  salesStatus: 'ON_SALE' | 'SOLD_OUT'; purchasable: boolean; category: Category; subcategory: string; createdAt: string
  brandName: string; originalPrice: number | null; satisfaction: Satisfaction; freeShipping: boolean; emoji: string; options: MockOption[]
  /** 누적 판매량. 화면에는 쓰지 않고 판매량순, 랭킹순 정렬에만 쓴다. */
  salesCount: number
  /** 지금 주문 진행 중인 수, 상품을 보고 있는 사람 수. 화면 확인용 고정값이다. */
  orderingCount: number; viewingCount: number
  /** 상품 카드 종류별 표시값. 새벽도착(DAWN), 오늘출발(TODAY), 무료반품, 총 내용량, 묶음 수 */
  deliveryType: 'DAWN' | 'TODAY' | null; freeReturn: boolean; netContent: NetContent | null; packCount: number | null
}

export interface NetContent { amount: number; unit: 'g' | 'ml' | '개' }

/** 상품명에서 총 내용량과 묶음 수를 읽는다. "500g X 4팩"은 2000g, "수건 5장"은 5개, "1+1"은 2개 묶음이다. */
export function readContent(name: string): { netContent: NetContent | null; packCount: number | null } {
  const pack = Number(name.match(/X\s*(\d+)\s*팩/)?.[1] ?? 1) * (name.includes('1+1') ? 2 : 1)
  const size = name.match(/(\d+(?:\.\d+)?)\s*(kg|g|L|ml)(?![a-zA-Z])/)
  if (size) {
    const [amount, unit] = { kg: [1000, 'g'], g: [1, 'g'], L: [1000, 'ml'], ml: [1, 'ml'] }[size[2] as 'kg' | 'g' | 'L' | 'ml'] as [number, 'g' | 'ml']
    return { netContent: { amount: Math.round(Number(size[1]) * amount * pack), unit }, packCount: pack > 1 ? pack : null }
  }
  const pieces = Number(name.match(/(\d+)\s*(?:개|장|권)(?!\S*색)/)?.[1] ?? 1) * pack
  return { netContent: pieces > 1 ? { amount: pieces, unit: '개' } : null, packCount: pieces > 1 ? pieces : null }
}

/** 식품은 대부분 새벽도착, 그 밖에는 일부만 오늘출발. 상품 번호를 씨앗으로 따로 뽑아 다른 값의 난수 순서를 바꾸지 않는다. */
function delivery(category: Category, productId: number): MockProduct['deliveryType'] {
  const roll = seeded(productId * 41)()
  if (category === 'FOOD') return roll < 0.75 ? 'DAWN' : null
  return roll < 0.45 ? 'TODAY' : null
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
    const count = Math.max(catalog.items.length, 15 + Math.floor(random() * 6))
    for (let i = 0; i < count; i++) {
      const [emoji, item, option, subcategory] = catalog.items[i % catalog.items.length]
      const brandName = catalog.brands[Math.floor(random() * catalog.brands.length)]
      const name = `${item}${i < catalog.items.length ? '' : SUFFIXES[Math.floor(random() * SUFFIXES.length)]}`
      const list = round100(catalog.price[0] + random() * (catalog.price[1] - catalog.price[0]))
      const discounted = random() < 0.8
      const price = discounted ? round100(list * (1 - (0.1 + random() * 0.5))) : list
      const available = random() < 0.1 ? 0 : 1 + Math.floor(random() * 80)
      const productId = products.length + 1
      products.push({
        productId, name, description: `${brandName}의 ${item}. 로컬 모의 상품입니다.`, mainImageUrl: `/api/catalog/v1/mock-images/${productId}.svg`,
        price, available, salesStatus: available ? 'ON_SALE' : 'SOLD_OUT', purchasable: available > 0, category, subcategory,
        createdAt: new Date(now - Math.floor(random() * 30 * DAY_MS)).toISOString(),
        brandName, originalPrice: discounted ? list : null, satisfaction: satisfaction(random), freeShipping: random() < 0.6, emoji,
        options: productOptions(option, price, productId), salesCount: seededSales(productId),
        orderingCount: Math.floor(seeded(productId * 31)() * 3000), viewingCount: Math.floor(seeded(productId * 37)() * 4000),
        deliveryType: delivery(category, productId), freeReturn: seeded(productId * 43)() < 0.4, ...readContent(name),
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

const reviews = (product: MockProduct) => Object.values(product.satisfaction).reduce((sum, n) => sum + n, 0)
/** 랭킹 점수. 판매량, 리뷰 수, 최근 등록을 섞는다. 실제 랭킹 기준이 정해지면 Backend 가 대신한다. */
const rankScore = (product: MockProduct, now: number) => Math.log10(product.salesCount + 1) * 3 + Math.log10(reviews(product) + 1) * 2 - (now - Date.parse(product.createdAt)) / DAY_MS / 10
const SORTS = {
  RANKING: (a: MockProduct, b: MockProduct) => rankScore(b, Date.now()) - rankScore(a, Date.now()),
  SALES: (a: MockProduct, b: MockProduct) => b.salesCount - a.salesCount,
  REVIEWS: (a: MockProduct, b: MockProduct) => reviews(b) - reviews(a),
  LATEST: (a: MockProduct, b: MockProduct) => b.createdAt.localeCompare(a.createdAt),
  PRICE_ASC: (a: MockProduct, b: MockProduct) => a.price - b.price,
  PRICE_DESC: (a: MockProduct, b: MockProduct) => b.price - a.price,
}

/** 지금 보고 있는 사람 수는 요청마다 조금씩 바뀐다(실제처럼 오르내림). "조회 급상승"의 업데이트를 눌렀을 때 순위가 바뀌는 것을 확인할 수 있다. */
const fluctuate = (items: MockProduct[]) => items.map(item => ({ ...item, viewingCount: Math.round(item.viewingCount * (0.6 + Math.random() * 0.8)) }))

/** 상품 목록, 상세, 이미지 요청에 답한다. 그 밖의 요청(쿠폰, 구매 확인 등)은 undefined 를 돌려 Prism 에 맡긴다. */
/** decorate 는 응답 직전에 상품에 덧붙일 값(라이브 할인 등)을 정한다. */
export function catalogMock(products = mockProducts(), decorate: (items: MockProduct[]) => object[] = items => items) {
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
      return product && { body: { ...decorate(fluctuate([product]))[0], maxQuantity: Math.min(product.available, 10) } }
    }
    if (url.pathname !== '/v1/products') return
    const q = url.searchParams.get('q')?.trim(), status = url.searchParams.get('status'), category = url.searchParams.get('category'), subcategory = url.searchParams.get('subcategory')
    // 계약상 sort 를 생략하면 최신순이지만, 화면의 기본 정렬인 랭킹순을 확인할 수 있게 모의 서버는 랭킹순으로 답한다.
    const sort = SORTS[url.searchParams.get('sort') as keyof typeof SORTS] ?? SORTS.RANKING
    const free = url.searchParams.get('freeShipping') === 'true'
    const min = Number(url.searchParams.get('minPrice') ?? '') || 0, max = Number(url.searchParams.get('maxPrice') ?? '') || Infinity
    const found = products
      .filter(item => !q || item.name.includes(q) || item.brandName.includes(q))
      .filter(item => !status || item.salesStatus === status)
      .filter(item => !category || item.category === category)
      .filter(item => !subcategory || item.subcategory === subcategory)
      .filter(item => (!free || item.freeShipping) && item.price >= min && item.price <= max)
      .toSorted(sort)
    const from = Number(url.searchParams.get('cursor') ?? 0) || 0
    const size = Math.min(Number(url.searchParams.get('size') ?? 20) || 20, 50)
    const hasNext = from + size < found.length
    return { body: { items: decorate(fluctuate(found.slice(from, from + size))), nextCursor: hasNext ? String(from + size) : null, hasNext } }
  }
}
