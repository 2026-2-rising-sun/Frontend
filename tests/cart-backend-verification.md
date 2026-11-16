# Cart 그룹 응답 호환 검증

시작 Frontend dev는 `e2748d7762fce9499018a30de6c9f46738546f22`, 수정 앱 코드는 `8b9a47f88ed4cc90a3e6c6a66aed1c26ed1066d1`이다. 전용 `fix/cart-product-group-compat` 브랜치에서 작업했고 dev를 직접 수정하지 않았다. 후속 실서버 검사 스크립트/문서는 앱 소스를 바꾸지 않는다.

## 독립 검사

- `npm test`:89건, 실패·스킵0. Product그룹과 CartID·skuId·version·수량·가격을 구분하며 nullable SKU/가격과 그룹상품정보를 보존한다.
- `npm run e2e:checkout-ui`:7건, 실패·스킵0. API 응답 fixture를 쓰는 UI 회귀이며 실서버 검증이 아니다.
- `npm run build`, `npm run lint`:통과. 기존 Vite 번들 크기 안내는 빌드 실패가 아니다.
- 최초 수정 SHA의 CI43697925320은 성공이다. 후속 HEAD의 CI는 PR81에서 별도로 확인한다.

## 실제 Core API 실행 — 감사 수정 중간 체크포인트

Backend `3b44a879de878d96e536dec647271f927e1f3283`의 격리 Core API와 전용 PostgreSQL·실제 ProductQuery/SKU 원본을 사용했다. Frontend Vite5369가 Core58131로 proxy했으며 Core 요청을 mock/intercept하지 않았다. 로그인·세션복원·알림만 소유한 로컬 Member/Notification HTTP fixture를 사용해 Backend 담당이 제공한 JWT를 전달했다. 실제 Member 서비스/운영 인증·결제 제공자 E2E로 확대하지 않는다.

| 단계 | 관측 |
|---|---|
| API로 Cart 생성 |Product101/SKU501/Cart1 수량2, Product102/SKU502/Cart2 수량1, HTTP201|
| 새로고침·표시 |그룹 응답의 단가4000/3000, 합계11000. Catalog 조회로 현재가를 덮지 않음|
| 선택·수량 변경 |두번째 해제→합계8000. 첫 Cart1 PATCH200→수량3/version1·합계12000|
| 삭제·새로고침 |Cart2 DELETE204, Cart1 선택 유지/재조회 뒤 수량3·가격12000|
| 견적 |POST `/cart/checkout`200, items=[{itemId:1,version:1}]. Product/SKU ID로 대체하지 않음|
| 실제 보유쿠폰 선택 |유효쿠폰2000, 같은 견적 API와 couponId 호출200|
| 주문 생성 |POST `/cart/orders`201, expectedTotalAmount12000·동일 CartID/version. 총액12000/할인2000/실지불10000|
| 정리 |생성한 미결제 묶음만 취소204로 선점 해제, 자신이 만든 Cart 행만 삭제. 결제 API 호출0|

최초 쿠폰 미선택 실행1건10.2초, 쿠폰 선택 실행1건7.7초가 통과했다. Backend 재기동/새 JWT 뒤 JSON 증거 저장을 보강한 같은 쿠폰 시나리오1건을7.5초에 재검증했다. 세 실행을 세 개의 서로 다른 시나리오로 세지 않는다. 마지막 결과의 실제 wire/calls JSON과 desktop/mobile·생성 주문 캡처는 `test-results/cart-backend/`에 생성되며 저장소에는 추적하지 않는다. JWT·인증 헤더는 증거 JSON에 넣지 않는다.

Orca에서는 별도 Cart3/Product101/SKU501의4000원×2=8000 화면을1280/390px에서 열었다. 수량 클릭 명령 뒤 실제 GET은2/version0이므로 이 수동 명령을 수정 성공으로 판정하지 않는다. 수동 행삭제204는 확인했다. 수량 변경 성공 근거는 앞 Playwright의 실제PATCH200/주문수량3에 한정한다.

## 최종 API 범위와 남은 확인

위3b44a879는 중간 실행 기준이다. 이후 사용자 지시로 Backend PR은 Payment 변경 없는 CommerceCore 독립 범위로 조정 중이며 기존 legacy 결제는 보존한다. 이 Frontend는 기존 Cart CRUD·checkout·cart/orders만 호출하고 새 order-sheets·Payment 직접호출·임시503 정책을 추가하지 않는다. 최종 Order 정정 SHA/API 목록을 받아 같은 호환 경로를 재확인한 뒤 PR에 결과를 갱신한다. 모든 새 주문10분 요구나 새 금전연동까지 충족했다고 주장하지 않는다.

Backend [Cart PR341](https://github.com/2026-2-rising-sun/Backend/pull/341)·[Order PR343](https://github.com/2026-2-rising-sun/Backend/pull/343), Frontend [PR81](https://github.com/2026-2-rising-sun/Frontend/pull/81)은 Draft이며 dev 병합·배포는 수행하지 않는다. 공개 다중SKU·대표가·옵션 UI나 구 견적409 우회는 이 수정 범위가 아니다.

## 최종 축소 계약 영향검증 — 2026-11-15

Order `d588f70a28730f1dff6030e72a43139b06802866` + Frontend `3abc8113ecd2f9770e1f1977b8bb8dcaef025c03`에서 실제 브라우저1건이5.7초(전체6.4초)에 실패·스킵0으로 통과했다. Cart 생성201·그룹조회200·선택·수량PATCH200/version1·삭제204·쿠폰견적200·기존cart/orders201을 재확인했다. 총액12000/할인2000/실지불10000, Product101/SKU501/Cart1을 구분했다. 운영 인증 대신 같은 격리 Member/Notification fixture를 사용했고 Core API는 실제 서버였다.

유지 API는 기존 Cart CRUD·checkout·cart/orders·묶음 조회/미결제cancel이며 신규 `/v1/order-sheets` 공개 핸들러는 제외됐다는 Order 담당 인계를 받았다. 이번 자동 검사는 묶음 URL 이동까지 확인했으나 개별 묶음GET 응답은 캡처되지 않았다. 완료파일 뒤 추가 GET은 서버 종료로 connection refused였으므로 조회200으로 세지 않는다. 생성한 본인 미결제 묶음cancel204·Cart삭제와 후속GET200 빈배열을 확인하고 종료를 인계했다. 자체 fixture/Vite는 종료했다.

이 최종 경로는 기존 legacy policy0/PT15M이며 최신600/600 설계 완료 증거가 아니다. 결제 API 호출0, 신규 Payment 연동/임시차단/대체계약 없음. 샘플의 `/v1/product-images/1`은404여서 이미지 fallback을 표시했으며 실제 이미지 제공자 성공으로 계산하지 않는다. 나머지 가격·텍스트·조작과390px 넘침 검사는 통과했다. 이전3b44의 세 실행과 이번 최종축소1건을 구분한다.

## 후속 전환

2026-11-16 새 OrderSheet API 소비자 전환은 [새 주문서 검증](order-sheet-verification.md)으로 이어진다. 위 legacy 실행은 당시 증거이며 현재 e2e:cart-backend는 새 계약을 검증하므로 과거 API 경로로 재실행한 결과로 오인하지 않는다.
