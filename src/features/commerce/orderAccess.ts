/**
 * 로그인이 없는 P1 에서는 "주문번호 + 조회 비밀번호"가 주문 접근 수단이다.
 * 주문 직후 결과 화면으로 자연스럽게 이동할 수 있도록 이 브라우저 탭(sessionStorage)에만 잠시 보관한다.
 * (탭을 닫으면 사라지며, 다시 조회하려면 주문 조회 화면에서 비밀번호를 입력한다.)
 */
const KEY = 'shoppinglive:order-access'

type AccessMap = Record<string, string>

const read = (): AccessMap => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as AccessMap
  } catch {
    return {}
  }
}

export const saveOrderAccess = (orderNumber: string, lookupPassword: string) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...read(), [orderNumber]: lookupPassword }))
  } catch {
    /* 저장하지 못해도 주문 조회 화면에서 다시 접근할 수 있다 */
  }
}

export const getOrderAccess = (orderNumber: string): string | null => read()[orderNumber] ?? null

export const clearOrderAccess = (orderNumber: string) => {
  const map = read()
  delete map[orderNumber]
  try {
    sessionStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* noop */
  }
}
