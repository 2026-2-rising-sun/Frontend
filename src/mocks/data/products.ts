import type { Product } from '../../domain/types'

/** mock 시드 데이터. 최신 등록 순(첫 항목이 가장 최신). */
export const seedProducts: Product[] = [
  {
    id: 'p-1',
    name: '무선 노이즈캔슬링 이어폰',
    description: '하루 종일 편안한 착용감과 강력한 노이즈 캔슬링. 방송 없이도, 방송 중에도 같은 가격·같은 주문서로 구매합니다.',
    imageUrl: null,
    price: 129000,
    stock: 12,
    status: 'SELLING',
    featuredLive: { id: 'l-1', title: '가을 신상 이어폰 특가 라이브' },
  },
  {
    id: 'p-2',
    name: '스마트 워치 GT',
    description: '심박·수면·운동 기록을 한 번에. 7일 배터리와 방수 지원.',
    imageUrl: null,
    price: 249000,
    stock: 5,
    status: 'SELLING',
    featuredLive: { id: 'l-1', title: '가을 신상 이어폰 특가 라이브' },
  },
  {
    id: 'p-3',
    name: '보조배터리 20000mAh',
    description: '고속 충전을 지원하는 대용량 보조배터리.',
    imageUrl: null,
    price: 39000,
    stock: 0,
    status: 'SOLD_OUT',
    featuredLive: { id: 'l-1', title: '가을 신상 이어폰 특가 라이브' },
  },
  {
    id: 'p-4',
    name: '미니 블루투스 스피커',
    description: '한 손에 들어오는 크기, 12시간 재생.',
    imageUrl: null,
    price: 59000,
    stock: 30,
    status: 'SELLING',
    featuredLive: null,
  },
  {
    id: 'p-5',
    name: '기계식 키보드',
    description: '저소음 적축, 핫스왑 지원.',
    imageUrl: null,
    price: 89000,
    stock: 18,
    status: 'SELLING',
    featuredLive: { id: 'l-2', title: '홈카페 에스프레소 머신 라이브' },
  },
  {
    id: 'p-6',
    name: '무선 충전 패드',
    description: '15W 고속 무선 충전.',
    imageUrl: null,
    price: 29000,
    stock: 40,
    status: 'SELLING',
    featuredLive: null,
  },
  {
    id: 'p-7',
    name: '노트북 파우치',
    description: '13~14인치 노트북 보호 파우치.',
    imageUrl: null,
    price: 19000,
    stock: 60,
    status: 'SELLING',
    featuredLive: null,
  },
  {
    id: 'p-8',
    name: 'USB-C 허브',
    description: 'HDMI·USB-A·SD 카드 슬롯 7-in-1.',
    imageUrl: null,
    price: 45000,
    stock: 0,
    status: 'SOLD_OUT',
    featuredLive: null,
  },
  // 공개 목록에는 노출되지 않는 상태 (관리용 데이터 예시)
  {
    id: 'p-9',
    name: '판매 준비 중 상품',
    description: '판매 설정 전 상품은 공개 목록에 나오지 않습니다.',
    imageUrl: null,
    price: 10000,
    stock: 10,
    status: 'READY',
    featuredLive: null,
  },
  {
    id: 'p-10',
    name: '비공개 상품',
    description: '비공개 상품은 공개 목록·상세에서 제외됩니다.',
    imageUrl: null,
    price: 10000,
    stock: 10,
    status: 'HIDDEN',
    featuredLive: null,
  },
]

/** 페이징을 시연할 수 있도록 공개 상품을 늘리기 위한 추가 시드 (p-11 ~ p-26). */
const EXTRA_NAMES = [
  '스탠드형 선풍기', '휴대용 손풍기', '전기 주전자', '핸드블렌더', '에어프라이어 5L', '무선 청소기', '가습기 4L', '공기청정기 미니',
  '캠핑 랜턴', '접이식 캠핑 의자', '텀블러 500ml', '보온 도시락', '요가 매트', '폼롤러', '스마트 체중계', '블루투스 키보드',
]

const extraProducts: Product[] = EXTRA_NAMES.map((name, i) => ({
  id: `p-${11 + i}`,
  name,
  description: `${name} — 페이징 시연용 mock 상품입니다.`,
  imageUrl: null,
  price: 15000 + i * 7000,
  stock: (i * 7) % 5 === 0 ? 0 : 5 + i,
  status: (i * 7) % 5 === 0 ? 'SOLD_OUT' : 'SELLING',
  featuredLive: null,
}))

seedProducts.push(...extraProducts)

/** 방송별 연결 상품 (노출 순서). */
export const seedLiveProductIds: Record<string, string[]> = {
  'l-1': ['p-1', 'p-2', 'p-3'],
  'l-2': ['p-5', 'p-6'],
  'l-3': ['p-7', 'p-4'],
  'l-4': ['p-8', 'p-6'],
  'l-5': ['p-6'],
  'l-6': ['p-7'],
  'l-7': ['p-4'],
  'l-8': ['p-5'],
  'l-9': ['p-6'],
  'l-10': ['p-2'],
}
