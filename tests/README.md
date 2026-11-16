# 검증

- `npm run test`: 인증/토큰 갱신, 커서 계약, 회원 주문 입력, 방송 linkId/version, 이미지 등록 재시도 단위 테스트.
- `npx playwright test --config playwright.ui.config.ts`: 로그인·내 계정·판매자 목록·쇼핑 홈·상품 상세 및 기존 검색·시청자 수 동작을 API 응답 fixture로 검증합니다. 실제 백엔드 연동 검증과는 구분합니다.
- `npx playwright install chromium`: E2E 브라우저 설치.
- `npm run e2e:prism`: 현재 Backend YAML을 사용한 외부 Prism 계약 서버와 브라우저 테스트.
- `BACKEND_DIR=<분리 Backend 경로> npm run local:kind` 후 `npm run e2e:kind`: 실제 PostgreSQL/Redis/서비스 간 HTTP 및 브라우저 테스트.

- `npm run e2e:checkout-ui`: 통합 장바구니 선택·수량 변경·주문/결제 응답 유실·새로고침 복구·모바일 레이아웃을 브라우저의 API 응답 fixture로 검증. 실제 DB/결제 연동 검증은 `e2e:kind`에서 별도로 수행합니다.

별도 로컬 환경을 보존하려면 `KIND_NAMESPACE=<검증용 이름>`을 `local:kind`와 `local:frontend`에 동일하게 지정합니다.
이미 실행 중인 실제 백엔드 연결 프론트를 검사할 때는 `E2E_EXTERNAL_SERVER=true E2E_BASE_URL=http://127.0.0.1:<포트> npm run e2e:kind`를 사용합니다. 서버 자동 기동을 생략하므로 대상 서버와 데이터 격리는 실행 전에 확인합니다.

쿠폰·환불·알림·프로모션과 기존 상품 판매 설정은 `npm run e2e:features`로 검증합니다. Catalog 상품·판매·쿠폰 사본과 Payment 결과 반영에는 Kafka가 필수입니다. `KIND_KAFKA=true KIND_NAMESPACE=<새 검증 공간> npm run local:kind`로 격리된 Kafka까지 기동합니다. Kafka는 기본 활성화되며 `KIND_KAFKA=false`는 거부합니다. `local:frontend`에도 같은 `KIND_NAMESPACE`를 지정합니다. 기존 서버를 사용할 때는 `E2E_EXTERNAL_SERVER=true`를 추가합니다.

검증용 PostgreSQL·Redis·이미지는 임시 저장소를 사용합니다. `local:down`이나 해당 파드 삭제는 검증 데이터를 제거하므로 기존 데이터가 있는 환경에는 실행하지 않습니다. 기존 환경과 다른 namespace를 사용하고, 이미지 변경 전에도 필요한 데이터를 별도로 백업합니다.

서비스 분리용 기본 namespace는 `shoppinglive-service-split-local`입니다. 기존 `shoppinglive-frontend-local`을 교체하지 않습니다. Kind 스크립트는 별도 DB `member/catalog/commercecore/live/notification/payment`를 준비하며 기존 Shopping/Commerce DB를 삭제하거나 이전하지 않습니다. 스크립트를 수정한 것과 실제 Kind 기동 검증은 구분합니다.

이미 실행 중인 분리 Backend 로컬 HTTP에 Vite만 연결하려면 다음처럼 실행합니다. 기본 주소와 같으면 URL 환경변수는 생략할 수 있습니다. Payment 8086은 Core가 내부적으로 연결하며 Vite proxy에는 없습니다.

```sh
MEMBER_URL=http://127.0.0.1:8081 CATALOG_URL=http://127.0.0.1:8082 COMMERCECORE_URL=http://127.0.0.1:8083 LIVE_URL=http://127.0.0.1:8084 NOTIFICATION_URL=http://127.0.0.1:8085 npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
E2E_EXTERNAL_SERVER=true E2E_BASE_URL=http://127.0.0.1:5174 npm run e2e:kind
E2E_EXTERNAL_SERVER=true E2E_BASE_URL=http://127.0.0.1:5174 npm run e2e:features
```

`npm run e2e:checkout-ui`에는 단건·0원 묶음 Payment 성공 응답 뒤 Core 주문/묶음 반영을 기다리는 fixture 회귀가 포함됩니다. 실제 새 서비스/DB/Kafka 결과 전달의 증거는 별도 Backend 연동 실행으로 확인해야 합니다. `BACKEND_DIR`는 Prism 실행 시에도 새 서비스 계약 YAML 경로로 사용됩니다.


Cart 그룹 응답 호환은 `cartCheckout.test.ts`에서 서로 다른 productId/skuId/Cart ID·수량·버전·가격과 수정/견적/주문/삭제 요청을 검사합니다. `e2e:checkout-ui`는 그룹 응답 fixture에서 Cart 현재가/구매불가 표시를 Catalog 값으로 덮지 않는지와 선택·수량 변경·새로고침 복구를 검사합니다. 이 fixture 검사를 실제 Backend E2E로 보고하지 않으며, 실서버 실행은 Backend/Frontend 정확 SHA와 포트·데이터·요청 증거를 별도 기록합니다.


`npm run e2e:cart-backend`는 이미 기동된 격리 Frontend/Core·팀원Payment와 명시적 인증/PG대역을 대상으로 새 주문서 쿠폰·승인후상태·Cart 버전 조건부 정리를 검사합니다. `E2E_BASE_URL`, `CART_E2E_PRODUCT_IDS`(단일SKU상품2개), 격리로그인 `CART_E2E_EMAIL`/`CART_E2E_PASSWORD`, 정확 `CART_E2E_BACKEND_SHA`/`CART_E2E_FRONTEND_SHA`, `CART_E2E_COUPON_ID`/`CART_E2E_COUPON_DISCOUNT`가 필요합니다. 실제Core응답을intercept하지않으며승인요청을실행하므로소유자와합의한테스트회원/PG대역만사용합니다. 자신이만든Cart만정리하고PAID주문에임의환불을실행하지않습니다. 인증헤더/JWT/paymentKey원문을증거에남기지않습니다. [상태와 검증 경계](order-sheet-verification.md)에실SDK미연결·실PG미검증및당시실행결과를명시합니다.
