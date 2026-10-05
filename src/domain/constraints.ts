/**
 * 입력 제약. 화면 검증과 서버(mock) 검증이 같은 값을 쓰도록 계약 계층에 둔다.
 * 명세: "이미지 종류·용량, 글자 수, 한 번에 표시할 목록 수와 주문 수량 상한은 팀이 정해 화면과 처리 기능에 동일하게 적용한다."
 * → 아래 값은 팀 합의 전까지의 임시값이며, 바꿀 때는 이 파일만 고치면 된다.
 */
export const PRODUCT_NAME_MAX = 100
export const PRODUCT_DESCRIPTION_MAX = 2000
export const LIVE_TITLE_MAX = 100
export const LIVE_DESCRIPTION_MAX = 2000

/** 대표 이미지 제한 */
export const IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024

/** 이미지 파일이 허용 기준에 맞는지 확인한다. 통과하면 null, 아니면 사용자에게 보여줄 안내 문구. */
export const validateImageFile = (file: { type: string; size: number }): string | null => {
  if (file.size === 0) return '빈 파일은 등록할 수 없어요.'
  if (!(IMAGE_ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'JPG, PNG, WEBP 이미지만 등록할 수 있어요.'
  if (file.size > IMAGE_MAX_BYTES) return `이미지는 ${IMAGE_MAX_BYTES / 1024 / 1024}MB 이하만 등록할 수 있어요.`
  return null
}
