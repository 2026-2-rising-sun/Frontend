# API 검증과 프론트 연동

기준일: 2026-10-06. Backend `dev` 9cf25ba, Frontend `mocking-branch` c320fdd에서 시작한다. 이 연동에서는 백엔드 도메인 기능과 API 계약을 수정하지 않는다. 모든 문서는 Git 파일로 관리하며 Notion에는 작성하지 않는다.

## 진행 순서와 보고

1. **리뷰 → 수정 → 검증 → Merge**: Live PR #136~#142 병합 확인. #126은 회귀 16건 확인 후 종료. #127은 Live SSE 종료·검증 수정 후 PR #147의 CI가 모두 통과하여 dev 병합 및 이슈 종료를 확인했다. #145도 Apidog 59개 API·테스트 환경·조건부 Mock·토큰 자동화의 검증 완료 기록과 이슈 종료를 확인했다. 단계 보고에 수정/미해결 항목과 검증 근거를 포함한다.
2. **git pull → API 검증 → YAML/Apidog 동기화**: Backend와 Frontend를 fast-forward로 갱신했다. Member 9, Shopping 12, Commerce 20, Live 18의 총 59개 계약을 확인했다. 계약 도구 테스트 41건, YAML lint와 schema/reference/example 검증 통과. 현재 YAML은 변경하지 않았다. 이후 #145에서 Apidog 59개 API·DTO 87개 재내보내기 및 테스트 자동화 적용 검증을 완료했다.
3. **프론트 개발·연동 → Prism → kind → 체크리스트 → 수동 환경**: HTTP 어댑터와 UI를 기존 계약에 맞춘다. 미구현 백엔드 기능은 아래 갭에 기록한다. Prism은 형식·응답 렌더링, kind는 실제 인증·DB·Redis·서비스 간 HTTP 흐름을 검증한다. 모든 요청 형식과 화면 사용 위치를 아래에 문서화한다. 종료 보고에서 테스트 통과/실패/미실행을 구분한다.

프론트는 이미 병합된 Backend `dev` API에 연동한다. 이후 병합된 #147은 로컬 실행과 SSE 종료·검증을 보완하며 API 경로·스키마를 바꾸지 않는다. 백엔드 기능 추가는 별도 범위다.

## 주요 계약 결정

- 공개 상품·방송·연결 상품·채팅 이력·좋아요 합계는 무토큰으로 조회한다. 채팅·좋아요 전송은 로그인한 USER/SELLER에게만 제공하며 LIVE 상태에서만 활성화한다.
- 채팅 API는 **최근 50개를 오래된 순으로** 반환한다. 화면도 위→아래 시간순으로 표시하고 최신 메시지가 아래에 온다. 전체 과거 이력이나 최신순 페이지 API는 제공하지 않는다.
- SSE에는 replay가 없다. 연결 준비/오류/재연결/탭 복귀 시 REST로 복구하고 15초 주기 조회를 유지한다. 종료 이벤트에서 연결을 닫고 방송 상태를 재조회한다. 채팅 실패는 자동 재전송하지 않는다(서버 멱등키 없음).
- 상품 공개 목록은 cursor/size를 사용한다. 빈 items여도 hasNext=true이면 다음 묶음을 조회할 수 있다. 목록 전체 개수는 만들지 않는다. 검색·상태·가격 정렬은 **불러온 상품에 한정**하며 UI에 범위를 표시한다. 공개 방송 상태 필터도 조회한 페이지에 적용한다.
- 주문은 로그인한 회원 본인 기준이다. 비회원 조회 비밀번호·임의 회원 ID·서비스 토큰을 보내지 않는다. 주문번호로 상세 조회하고 취소는 POST 후 재조회한다.
- 주문 생성은 `expectedTotalAmount=확인한 단가×수량`과 `X-Idempotency-Key`를 전달한다. 같은 입력 재시도는 같은 키를 쓴다. 장바구니 주문은 실제 선택 항목에서 상품·수량을 읽어 서버 재검증에 맡긴다.
- 장바구니 수량은 기존 QuantityStepper의 −/+로 조절한다. 최소 1·조회한 재고 상한을 적용한다. 클릭 즉시 절대 수량 PATCH를 보내고, 변경·삭제 후 전체 장바구니와 각 상품의 최신 가격을 다시 조회해 수량·상품별 금액(단가×수량)·총 상품 금액을 함께 갱신한다. 전체 재조회가 끝날 때까지 추가 변경과 주문을 막는다. 실패 시 쓰기를 자동 재시도하지 않고 서버 항목을 조회하며, 재조회 실패 시 주문을 막고 다시 조회 버튼을 제공한다. 장바구니 API에는 가격이 없으므로 상품 상세 API를 함께 조회하며, 최종 결제 금액은 주문서에서 서버가 재검증한다. 별도 수량 저장 버튼은 없다.
- 상품 등록은 이미지 업로드 → JSON 기본정보 등록이다. 이미지 ID를 등록 재시도 중 보존해 같은 멱등키에 다른 본문이 전달되지 않게 한다. 가격·재고는 Commerce에 등록하고 재고 변경은 최종 수량 설정이 아닌 **delta**를 보낸다.
- 방송 진행 중에도 상품 연결·해제·정렬을 허용한다. 마지막 상품 해제와 최대 100개 초과 연결을 막는다. 시작은 판매 중/품절 연결 상품과 IVS 상태로 판단하며 재고 0만으로 시작을 막지 않는다. 연결 후보는 최대 50개씩 cursor로 더 불러온다.
- 방송 상태 PREPARING/공개 '예정'은 UI '준비/예정'으로 매핑한다. 수정은 query version, 시작은 query expectedVersion, 연결 변경은 expectedVersion을 전달한다. 종료에는 version과 멱등키 파라미터가 없다. 등록에만 Idempotency-Key 헤더를 사용한다. 상품 ID와 linkId를 구분한다. 재정렬은 PUT과 전체 linkIds 배열이다.
- 회원 표시 이름 80자, 주문자 이름 64자, 전화번호 숫자·하이픈 9~32자, 상품 이름 100자·설명 2000자, 이미지 JPEG/PNG 5MB, 채팅 공백 제거 후 1~200 code point를 검증한다. 최종 검증은 서버가 수행한다.
- access token과 회원 정보는 메모리에 둔다. refresh token만 현재 탭의 sessionStorage에 저장하며, 새로고침 시 서버 refresh → /members/me 검증을 마친 뒤 화면을 연다. 만료가 임박하면 refresh를 한 번 공유해 갱신한다. 로그아웃·탈퇴·세션 종료·인증 거절 시 저장값도 삭제한다. 일시적인 서버 연결 실패는 복원 재시도 화면을 표시한다. 탭을 닫은 뒤의 영구 자동 로그인은 지원하지 않는다.
- Figma [ShoppingLive Components](https://www.figma.com/design/BMvGAMliCwOezu7LpiXj0i?node-id=2-3)의 Button/Input/Alert/Order Summary를 확인하고 기존 CSS Modules·토큰·컴포넌트를 재사용한다. 영상 오류와 상품·채팅 오류는 각각 표시한다. HLS 재생은 [Hls.js 공식 API](https://github.com/video-dev/hls.js/blob/master/docs/API.md)를 따르며 네이티브 HLS도 지원한다.

## 연동 체크리스트

경로는 서비스가 받는 `/v1` 기준이다. 브라우저에서는 `/api/<서비스>/v1/...`로 요청한다. ✓는 어댑터·화면 연결 완료이며 모든 행의 독립 E2E 통과를 뜻하지 않는다. 테스트 근거는 마지막 검증 표에서 구분한다.

| 서비스 | 요청 | 화면/사용처 | 상태 |
|---|---|---|---|
| Member | POST /auth/signup | 회원가입 | ✓ |
| Member | POST /auth/login | 로그인, 로컬 user/seller 별칭 | ✓ |
| Member | GET /members/me | 로그인 후 회원·역할 확인 | ✓ |
| Member | PATCH /members/me | 내 계정 이름 변경 | ✓ |
| Member | DELETE /members/me | 비밀번호 확인 후 탈퇴 | ✓ |
| Member | POST /auth/refresh | 접근 토큰 만료 전 갱신 | ✓ |
| Member | POST /auth/logout | 로그아웃 | ✓ |
| Member | POST /admin/members/{id}/sessions/revoke | SELLER 자신의 모든 세션 종료 | ✓ |
| Member | POST /internal/auth/sessions/check | 서버 전용 | 제외 |
| Shopping | GET /products | 홈 목록 cursor/size | ✓ |
| Shopping | GET /products/{id} | 상품 상세·장바구니 표시 | ✓ |
| Shopping | GET /products/{id}/purchase-check | 주문 생성 직전 확인 | ✓ |
| Shopping | POST /admin/product-images | 판매자 이미지 업로드 | ✓ |
| Shopping | GET /product-images/{id} | 상품 이미지 표시 | ✓ |
| Shopping | POST /admin/products | 기본정보 등록·멱등키 | ✓ |
| Shopping | GET /admin/products | 판매자 목록 | ✓ |
| Shopping | GET /admin/products/{id} | 판매자 상세 | ✓ |
| Shopping | PATCH /admin/products/{id} | 기본정보 수정·version | ✓ |
| Shopping | GET /internal/products | 서버 전용 | 제외 |
| Shopping | GET /internal/products/{id} | 서버 전용 | 제외 |
| Shopping | DELETE /dev/product-images | 개발 유지보수 전용 | 제외 |
| Commerce | GET /orders/checkout | 최신 주문 금액·주문 가능 여부 | ✓ |
| Commerce | POST /orders | 직접 주문 생성·멱등키 | ✓ |
| Commerce | GET /orders | 내 주문 목록 | ✓ |
| Commerce | GET /orders/{number} | 본인 주문 상세·상태 갱신 | ✓ |
| Commerce | POST /orders/{number}/cancel | 결제 전 주문 취소 | ✓ |
| Commerce | POST /orders/{number}/payments | 빈 JSON으로 결제 요청 | ✓ |
| Commerce | GET /orders/{number}/payments/{id} | 반환받은 결제 시도 조회 | ✓ |
| Commerce | GET /cart/items | 장바구니 | ✓ |
| Commerce | POST /cart/items | 상품 담기 | ✓ |
| Commerce | PATCH /cart/items/{id} | 절대 수량 변경 | ✓ |
| Commerce | DELETE /cart/items/{id} | 삭제 | ✓ |
| Commerce | POST /cart/items/{id}/orders | 선택 항목 단건 주문·멱등키 | ✓ |
| Commerce | POST /sales | 최초 판매 설정 | ✓ |
| Commerce | PATCH /sales/{id}/price | 확인된 판매정보 ID로 가격 변경 | ✓ 조건부 |
| Commerce | GET /sales/{id}/stock | 확인된 판매정보 ID로 재고 확인 | ✓ 조건부 |
| Commerce | PATCH /sales/{id}/stock | 증감량으로 재고 조정 | ✓ 조건부 |
| Commerce | PATCH /sales/{id}/status | 공개/비공개 상태 변경 | ✓ 조건부 |
| Commerce | GET /sales | Shopping/Live 서비스 토큰 전용 | 제외 |
| Commerce | PUT /dev/payment-scenarios/{number} | 결제 결과 강제 선택 | 프론트 제외 |
| Commerce | DELETE /dev/payment-scenarios/{number} | 결제 결과 설정 초기화 | 프론트 제외 |
| Live | GET /broadcasts | 공개 방송 목록 | ✓ |
| Live | GET /broadcasts/{id} | 공개 방송·재생 가능 정보 | ✓ |
| Live | GET /broadcasts/{id}/products | 상품 영역 | ✓ |
| Live | GET /broadcasts/{id}/chats | 최근 50개 채팅 | ✓ |
| Live | POST /broadcasts/{id}/chats | 로그인 채팅 전송 | ✓ |
| Live | GET /broadcasts/{id}/likes | 공개 좋아요 합계 | ✓ |
| Live | POST /broadcasts/{id}/likes | 로그인 좋아요 누적 | ✓ |
| Live | GET /broadcasts/{id}/events | SSE 연결·복구·종료 | ✓ |
| Live | POST /admin/broadcasts | 방송 등록·Idempotency-Key | ✓ |
| Live | GET /admin/broadcasts | 판매자 방송 목록 | ✓ |
| Live | GET /admin/broadcasts/{id} | version 포함 편집 정보 | ✓ |
| Live | PATCH /admin/broadcasts/{id} | 기본정보 수정·query version | ✓ |
| Live | POST /admin/broadcasts/{id}/start | 시작·query expectedVersion | ✓ |
| Live | POST /admin/broadcasts/{id}/end | 종료·파라미터 없이 POST | ✓ |
| Live | GET /admin/broadcasts/{id}/products | linkId·노출 순서 조회 | ✓ |
| Live | POST /admin/broadcasts/{id}/products | 상품 연결·expectedVersion | ✓ |
| Live | DELETE /admin/broadcasts/{id}/products/{linkId} | 연결 해제·expectedVersion | ✓ |
| Live | PUT /admin/broadcasts/{id}/products/order | 전체 linkIds 재정렬 | ✓ |

## 별도 구현·수정 갭

백엔드는 이번 연동에서 추가 구현하지 않는다.

| 항목 | 현재 처리 | 후속 검토 |
|---|---|---|
| 기존 상품의 salesId 조회 | POST /sales 응답의 productId→salesId 관계만 회원별 sessionStorage에 저장한다. 확인된 ID가 없는 기존 상품은 가격·재고·상태 변경 버튼을 닫는다. | SELLER용 조회 또는 Shopping 판매자 상세에 salesId 제공. 내부 /sales를 브라우저에 공개하거나 서비스 토큰을 배포하지 않는다. |
| 전체 상품 검색·가격 정렬·상태 필터 | 불러온 상품만 처리하고 적용 범위를 안내한다. | 서버 검색/정렬/필터 계약 필요. |
| 공개 방송 상태별 페이지 조회 | 전체 페이지를 받아 해당 상태만 표시한다. 빈 페이지에도 더 보기를 제공한다. | 서버 status 필터 제공 시 전환. |
| 방송 설명·썸네일·진행자 | 임의 데이터·입력폼을 제거하고 제목/시각/상태와 공통 이미지 자리만 사용한다. | 실제 지원 API와 디자인 필드 필요. |
| 실제 영상 송출·IVS | 프론트 HLS 재생은 구현. kind는 명시적 IVS readiness stub이며 예시 URL로 송출 성공을 검증하지 않는다. | 실제 IVS 채널·송출·브라우저 재생 별도 검증. |
| 실제 결제 대행 | 기존 서버 Mock gateway의 응답으로 결제 상태를 표시한다. 프론트 결과 강제 선택·Mock 패널·시드 데이터는 삭제했다. | 실결제 gateway 구현 및 승인/실패/타임아웃 환경 검증. |
| 다중 장바구니 결제 | 상품 하나씩 주문한다. | 별도 배치 주문 API가 필요할 때 계획. |
| 채팅 중복 전송 방지·과거 페이지·SSE replay | 전송 중 중복 클릭 차단, 실패 자동 재전송 없음, 최근 50개 REST 복구. | 서버 계약 추가가 필요한 경우 별도 설계. |
| 실패/타임아웃 결제 상태 E2E | UI는 실제 서버 FAILED/EXPIRED/CONFIRMING을 처리한다. 일반 화면에서 결과를 조작하지 않는다. | 안전한 외부 테스트 서버 시나리오로 추가 검증. |
| 판매자 상품 소유권 | 기존 SELLER 권한 계약을 유지한다. 회원별 소유권 모델은 아직 없다. | 신규 모델 도입 시 별도 계획·권한 검증 필요. |
| #127 CI | SSE 종료·검증 수정 후 PR #147의 CI 통과, dev 병합 및 #127 종료 확인. | 완료. |
| Apidog | #145에 59개 API·DTO 87개 재내보내기, 환경·조건부 Mock·토큰 자동화 검증 완료가 기록되어 있고 이슈도 종료됐다. | 이후 API 계약 변경 시 동기화. |
| 배포 | Vercel build에서 mock 강제 활성화를 제거했다. | 실제 API 도메인·동일 origin reverse proxy 연결 후 배포 검증. 현재 Vercel 배포 완료를 주장하지 않는다. |

## 검증과 수동 확인

- `npm run lint`, `npm run test`, `npm run build`
- `npm run e2e:prism`: 별도 Prism 4개 서비스와 브라우저를 통해 공개 조회·로그인→주문서·장바구니·방송/채팅 조회·내 주문·로그아웃 확인.
- `npm run local:kind`: 기존 Backend를 빌드하고 kind-shoppinglive-dev의 **shoppinglive-frontend-local** 네임스페이스에 Member/Shopping/Commerce/Live, PostgreSQL/Redis를 배치한다. 백엔드 소스 수정 없음. JDK 21·Docker·kind·kubectl 필요.
- `npm run local:frontend`: 서비스 준비 확인 후 18481~18484로 port-forward하고 http://localhost:5174 프론트를 연다. 이 프로세스를 유지한다. 다른 팀 서비스나 기존 shoppinglive-dev 네임스페이스를 변경하지 않는다.
- `npm run e2e:kind`: 판매자 상품/재고/가격, 회원 장바구니 주문·결제 조회, 취소·소유권, 방송 연결/정렬/해제·채팅/좋아요·종료, 가입/이름 수정/탈퇴 시나리오. 실행 결과 JSON·실패 trace는 Git 제외 `test-artifacts`, `test-results`에 저장한다.
- 정리할 때만 `npm run local:down`: 소유권 확인 후 이 테스트 네임스페이스를 삭제한다. PostgreSQL과 이미지 저장은 emptyDir이므로 삭제/Pod 교체 시 테스트 데이터가 사라진다. 생성 키·서비스 토큰은 Git 제외 경로와 Kubernetes Secret에만 저장한다.

수동 테스트 계정은 `user/user`, `seller/seller`다. 판매자로 상품 등록→판매 설정→판매 시작→방송 등록/연결을 확인하고, 유저로 장바구니→주문→결제 결과→내 주문을 확인한다. 비로그인 창에서 공개 조회, 로그인 창에서 채팅/좋아요를 확인한다. 같은 탭의 새로고침과 직접 URL 이동에서도 서버 검증 후 로그인 상태를 복원한다. 이전 버전에서 로그인한 상태는 저장된 refresh token이 없으므로 한 번 다시 로그인해야 한다.

### 실행 환경 주의사항

- Docker VM 메모리 부족으로 공유 kind 제어부와 테스트 Pod가 재시작했다. 테스트 서비스의 JVM 상한과 동시 실행 수를 줄였으며, 기존 수동 검증 컨테이너 4개(`sl-p2-flow-2874994bc928-{member,shopping,commerce,live}`)만 중지했다. DB와 데이터는 유지했다. 기존 환경을 재개하려면 현재 테스트 네임스페이스를 정리한 뒤 다음을 실행한다.

```sh
docker start sl-p2-flow-2874994bc928-member sl-p2-flow-2874994bc928-shopping sl-p2-flow-2874994bc928-commerce sl-p2-flow-2874994bc928-live
```

- 서비스 Pod가 재시작되어 port-forward 프로세스가 끝나면 `npm run local:frontend`를 다시 실행한다.
- 로컬 IVS stub은 ARN 마지막 ID가 `demo`이면 `https://stub.live-video.net/demo.m3u8`를 저장해야 시작 검증을 통과한다. 이 주소는 실제 영상 파일이 아니다. 영상 재생을 확인하려면 실제 송출 채널과 URL을 따로 준비한다.
- `npm audit --omit=dev`: 운영 의존성 취약점 0개. Prism 개발 도구 의존성에는 high 9개, moderate 1개가 남았다. 자동 해결 제안은 Prism 3.1.1로의 주요 버전 하향이어서 적용하지 않았다. Prism은 로컬 127.0.0.1에서만 실행하며 운영 앱 번들에 포함되지 않는다.
- HLS SDK는 지연 로딩하며 해당 별도 chunk의 500KB 경고가 남는다. 빌드는 성공한다.

### 최종 실행 결과

2026-10-06 최종 결과. Frontend 수정, Backend 도메인 소스 변경 0건.

| 검증 | 결과 | 실제 확인 범위 |
|---|---|---|
| lint / TypeScript / production build | 통과 | 정적 검사와 번들 생성. HLS 별도 chunk 크기 경고만 남음. |
| 단위·계약 회귀 | 21/21 통과 | 인증 경합·갱신·복원·철회·저장값 정리, 실제 DTO/경로/버전 파라미터, 멱등 등록 재시도, 커서·판매 상태 매핑. |
| Prism 브라우저 E2E | 3/3 통과, 5.0초 | 공개 상품·방송·채팅 조회, 로그인 후 주문서·장바구니·주문 목록, 로그아웃. 상태 변경의 정합성 검증은 kind 결과에만 해당. |
| kind 브라우저 E2E | 9/9 통과, 29.9초 | 상품 이미지/등록/기본정보 수정/가격/재고 증감/공개·비공개, 장바구니 −/+ 수량·최소 1·금액/전체 합계·변경 후 전체 조회/다른 상품 가격 갱신·선택 주문·삭제, 직접 주문·결제 상태 조회, 취소·본인 소유권, 방송 등록/수정/연결/정렬/해제/시작/종료, 공개 SSE 채팅과 로그인 채팅·좋아요, 가입·이름 수정·탈퇴, USER 콘솔 차단·SELLER 세션 종료, 새로고침 복원·로그아웃 후 복원 차단. |
| 반응형 확인 | 통과 | 상품 상세·장바구니 390px 가로 넘침 검사와 desktop/mobile 스크린샷, 종료된 방송 채팅과 수정한 계정 화면 직접 확인. |
| 수동 환경 | 실행 중 | kind-shoppinglive-dev / shoppinglive-frontend-local, 4개 서비스 Ready·이미지 9cf25ba929de 확인, localhost:5174. |

테스트 결과는 `test-artifacts/prism-results.json`, `test-artifacts/kind-results.json`, 이미지(`kind-product-desktop.png`, `kind-product-mobile.png`, `kind-live-chat.png`, `kind-cart-desktop.png`, `kind-cart-mobile.png`, `account-after-mobile.png`, `account-after-desktop.png`)에 저장되어 있다. mode별 trace 폴더를 분리해 테스트 실행 간 파일 삭제 충돌을 방지했다. 이 파일들은 생성 데이터·토큰이 포함될 수 있어 Git에 올리지 않는다.

실제 결제 대행 승인/실패/타임아웃, AWS IVS 실송출·HLS 재생, 모든 endpoint의 독립 E2E, 운영 배포는 이 프론트 E2E 통과 결과에 포함되지 않는다. Apidog 동기화는 별도 #145의 완료 기록으로 확인했으며 #127과 #145는 종료됐다. 좋아요 멱등 요청은 Frontend #6 / Backend #148, 장바구니 다중 선택·통합 결제는 Frontend #7 / Backend #149의 후속 작업이다.

## 좋아요 멱등성 진단 (변경 없음)

- Backend #133과 현재 YAML은 같은 회원의 반복 요청을 허용하는 누적 좋아요다. POST마다 +1이며 멱등키와 사용자별 중복 체크가 없다. Redis Lua INCR은 동시 증가의 유실을 막지만 멱등성을 제공하지 않는다.
- 프론트는 전송 중 클릭을 막으며 자동 재전송하지 않는다. 별도 진단 방송 9에서 의도적인 클릭 2회 → POST 2회 → 응답 합계 1, 2를 실제 브라우저로 확인했다. 진단 방송만 종료했으며 사용자 수동 방송 8은 그대로 유지한다.
- 사용자당 한 번만 허용하는 정책과 동일 요청 재시도를 중복 집계하지 않는 정책은 별개다. 어느 요구를 적용하든 서버 계약과 집계 방식 검토가 필요하다. 이 작업에서는 좋아요 백엔드·프론트 로직을 수정하지 않았다.
