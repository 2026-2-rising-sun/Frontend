import type { LiveDetail } from '../../domain/types'

const HOUR = 60 * 60 * 1000
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

/** mock 시드 방송. 시간은 실행 시점 기준 상대값이라 항상 "지금 방송 중"이 존재한다. */
export const seedLives: LiveDetail[] = [
  {
    id: 'l-1',
    title: '가을 신상 이어폰 특가 라이브',
    description: '이어폰·워치·보조배터리를 방송 특가로 만나보세요. 방송이 끝나도 상품은 계속 구매할 수 있어요.',
    thumbnailUrl: null,
    status: 'LIVE',
    scheduledAt: iso(-1 * HOUR),
    startedAt: iso(-0.9 * HOUR),
    endedAt: null,
    hostName: '셀러 라이브',
    playbackUrl: null,
  },
  {
    id: 'l-2',
    title: '홈카페 에스프레소 머신 라이브',
    description: '집에서 즐기는 카페 라이프. 키보드·충전 패드도 함께 소개합니다.',
    thumbnailUrl: null,
    status: 'LIVE',
    scheduledAt: iso(-2 * HOUR),
    startedAt: iso(-1.8 * HOUR),
    endedAt: null,
    hostName: '홈카페TV',
    playbackUrl: null,
  },
  {
    id: 'l-3',
    title: '겨울 아우터 미리보기',
    description: '겨울 시즌 신상을 미리 만나보세요.',
    thumbnailUrl: null,
    status: 'READY',
    scheduledAt: iso(20 * HOUR),
    startedAt: null,
    endedAt: null,
    hostName: '스타일 라이브',
    playbackUrl: null,
  },
  {
    id: 'l-4',
    title: '주방 가전 특가 다시 만나기',
    description: '지난 방송에서 소개한 상품입니다. 방송은 종료되었지만 상품은 계속 판매 중이에요.',
    thumbnailUrl: null,
    status: 'ENDED',
    scheduledAt: iso(-30 * HOUR),
    startedAt: iso(-29.8 * HOUR),
    endedAt: iso(-28 * HOUR),
    hostName: '셀러 라이브',
    playbackUrl: null,
  },
]

/** 종료 방송 목록의 페이징을 시연하기 위한 추가 시드 (l-5 ~ l-10). */
const endedTitles = ['여름 캠핑용품 특집', '봄맞이 홈트 라이브', '주방 가전 하반기 결산', '노트북 액세서리 모음전', '겨울 침구 특가', '스마트 워치 언박싱']
seedLives.push(
  ...endedTitles.map((title, i): LiveDetail => ({
    id: `l-${5 + i}`,
    title,
    description: `${title} 다시 만나기. 방송은 종료되었지만 상품은 계속 판매 중이에요.`,
    thumbnailUrl: null,
    status: 'ENDED',
    scheduledAt: iso(-(40 + i * 24) * HOUR),
    startedAt: iso(-(39.8 + i * 24) * HOUR),
    endedAt: iso(-(38 + i * 24) * HOUR),
    hostName: '셀러 라이브',
    playbackUrl: null,
  })),
)
