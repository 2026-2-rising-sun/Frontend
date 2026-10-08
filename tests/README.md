# 검증

- `npm run test`: 인증/토큰 갱신, 커서 계약, 회원 주문 입력, 방송 linkId/version, 이미지 등록 재시도 단위 테스트.
- `npx playwright install chromium`: E2E 브라우저 설치.
- `npm run e2e:prism`: 현재 Backend YAML을 사용한 외부 Prism 계약 서버와 브라우저 테스트.
- `npm run local:kind` 후 `npm run e2e:kind`: 실제 PostgreSQL/Redis/서비스 간 HTTP 및 브라우저 테스트.

- `npm run e2e:checkout-ui`: 통합 장바구니 선택·수량 변경·주문/결제 응답 유실·새로고침 복구·모바일 레이아웃을 브라우저의 API 응답 fixture로 검증. 실제 DB/결제 연동 검증은 `e2e:kind`에서 별도로 수행합니다.
