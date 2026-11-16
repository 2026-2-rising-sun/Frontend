# 새 주문서 호출자 전환 검증

## 변경과 계약

작업 브랜치는 `fix/cart-product-group-compat`, 시작 SHA는 `2d30c7ec50f5253bfaaf20ebe701fc0245ddd095`다. 기존 Draft PR81에서 Cart 그룹 응답 호환과 새 주문서 전환을 함께 검토한다. Backend Cart/Order와 Payment 원본은 수정하지 않았다.

최초 계약은 Core `cf79be0a2766964075f0e6cef67ebcd8a0841cee`의 OpenAPI와 `OrderPaymentRelayController`다. 단건 견적의 명시적 `skuId`와 새 active 조회는 `7a64bbbd11cc37f2960854886de18f4750241cf0`에서 추가됐다. 새 active의 과거 policy2 미연결 주문 누락은 Backend 담당이 별도 수정했으며, 아래 실행 SHA와 구분한다.

| 작업 | 호출과 보존 값 |
|---|---|
| 새 주문 | POST `/v1/order-sheets`, SKU/수량 또는 Cart ID/version, 구매자 정보, 쿠폰 적용 SKU, 할인 후 expectedAmount, 생성 요청키 |
| 준비 복구 | POST `/{number}/payment`. 승인 요청이 아니다 |
| 결제창 | POST `/{number}/payment/checkouts`. 새로 받은 pgOrderId만 사용한다 |
| 인증 후 승인 | POST `/{number}/payment/approval`, 인증 paymentKey/orderId→pgOrderId/amount와 별도 고정 요청키 |
| 상태·취소 | GET `/{number}`, PENDING의 POST `/{number}/cancel` |
| 재진입 | GET `/v1/order-sheets/active`와 기존 payment-groups/active를 종류별로 확인 |

위 `/{number}` 경로의 접두어는 `/v1/order-sheets`다. 성공 응답은 raw `{order,payment}` 또는 payment 객체이며 HTTP200 자체를 결제 성공으로 해석하지 않는다.

Cart의 productId/skuId/itemId/version을 구별하고 현재 가격을 Catalog 값으로 덮지 않는다. 쿠폰은 사용자가 적용 상품을 선택하고 그 상품의 견적 할인액을 확인한 뒤 couponSkuId/실결제액을 보낸다. 단건은 Core 견적이 알려 준 skuId를 사용한다. 상품ID를 SKU로 추정하거나 몰래 Cart를 생성하지 않는다. 공개 다중SKU·대표가·옵션/#340과 동시수량환불#345는 확대하지 않았다. 새 계약의 양수 금액 제약은 표시하며 기존 legacy0원 조회/결제 계약은 유지한다.

## 기한·재시도·복구

- PENDING의 expiresAt와 PROCESSING의 processingExpiresAt을 따로 표시한다. 준비·창 열기는 PROCESSING을 시작하거나 기한을 연장하지 않는다.
- 응답 유실·15초 HTTP 시간초과·202·UNKNOWN은 실패나 새 결제로 바꾸지 않는다. 같은 주문/인증 원문/요청키를 보존해 조회·복구한다. 생성 전에도 새 active와 legacy active를 각각 확인한다. 새 active409는 주문 부재나 legacy 우회로 해석하지 않는다.
- 자동 상태 조회는 2초 간격 최대30회다. 화면을 떠나면 예약을 정리하고, 사용자가 같은 주문을 다시 조회할 수 있다. 종료된 주문의 UNKNOWN/APPROVING과 늦은 환불 REQUESTED도 한정된 조회 대상으로 유지한다.
- 인증 취소·실패는 승인/주문취소를 보내지 않는다. 인증 후에도 서버 상태·현재 창·금액을 확인하며 기한이 지난 주문에 새 승인을 보내지 않는다.
- PAID/확정FAILED/EXPIRED/CANCELLED와 늦은 승인 환불 REQUESTED/SUCCEEDED/FAILED를 구별한다. 요청이나 Kafka 전달만으로 환불 완료라 표시하지 않는다.
- 요청키와 인증 결과는 탭의 회원별 sessionStorage에 보존하고 종료 상태에서 정리한다. 최근 새 주문번호로 재진입할 수 있으며 기존 주문목록/진행 중 결제/환불 화면은 유지한다.

## 실제 SDK 연결 코드와 설정 공백

공식 `@tosspayments/tosspayments-sdk`를 현재 지원 v2의 `2.10.0`으로 고정했다. `tossWidgetAuthentication`의 기본 loader는 실제 `loadTossPayments`다. widgets(customerKey) → setAmount → 결제수단/약관 렌더 → 사용자가 requestPayment를 누르는 Redirect 방식이며 모바일에서도 Promise 방식에 의존하지 않는다. SDK UI 자원과 중단 신호를 정리한다.

`bootstrap({ paymentWidgetConfiguration })`는 인증된 회원별 설정 공급자를 받아 실제 provider를 주입한다. 공급자는 위젯 clientKey와 안정적인 불투명 customerKey를 반환해야 한다. 현재 프로젝트에는 이 공급자·실제 상점 공개키/고객키 설정이 없다. 회원ID/전화번호를 customerKey로 추정하거나 새 키를 발급하지 않는다. 공급자가 없는 기본 앱은 인증을 시작하지 않고 설정 미완료를 표시한다. 실제 SDK 네트워크 실행·상점 키 세트·실 PG/실계좌는 검증하지 않았다.

앱 콜백은 `/order-sheets/{number}/payment-return`이다. 창을 열 때 회원/주문/pgOrderId/금액과 임의 nonce(고객키가 아님)를 저장한다. successUrl의 paymentKey/orderId/amount를 이 값과 비교하고, 로그인 복원 HTTP보다 먼저 주소에서 인증키를 제거한다. failUrl에 orderId가 없는 인증취소도 nonce로 원래 주문에 연결한다. 중복 콜백은 같은 원문/키로 Core만 호출하며 인증 성공만으로 성공 화면을 표시하지 않는다.

공식 원문은 [v2 위젯 가이드](https://docs.tosspayments.com/guides/v2/payment-widget/integration), [SDK 초기화](https://docs.tosspayments.com/sdk/v2/js/environment), [위젯 메서드](https://docs.tosspayments.com/sdk/v2/js/payment-widget), [키 종류](https://docs.tosspayments.com/reference/using-api/api-keys), [Core API](https://docs.tosspayments.com/reference)다. 팀원 Payment design.html980~1022/2603~2627과 대조했다. 공식 orderId 조회는 gsk가 아닌 sk 전용이다. Backend 담당은 현재 팀원 코드가 confirm/paymentKey조회/cancel만 사용하고 PG orderId 조회를 호출하지 않는다고 확인했다. 현재 호출 집합에서 직접 충돌은 미발견이지만 실제 상점 client/secret 동일 세트 검증으로 확대하지 않는다. API 개별 키를 섞거나 Payment 구현을 수정하지 않았다.

개발용 `VITE_PG_AUTH_DOUBLE_URL`은 로컬 인증 대역만 연결하고 화면에도 대역임을 표시한다. SDK provider 검사는 별도의 SDK 인터페이스 대역을 주입한다. 실제 provider 소스의 호출 순서와 콜백 처리를 검사하되 공식 SDK 원격 구현을 실행한 것으로 세지 않는다.

## 독립 검사

`npm test`, `npm run e2e:checkout-ui`, `npm run lint`, `npm run build`를 사용한다. SDK 추가 후 단위·소비자계약98건, fixture 브라우저15건이 실패/오류/스킵0으로 통과했다. 기존 legacy/0원 확정 반영·환불 회귀를 유지하고 새 Cart 버전/단건 SKU·쿠폰/응답 유실/인증 취소·실패/기한 후 인증/환불 표시/SDK 인터페이스·URL 콜백을 검사했다. 이 결과는 실 Core/Payment/Kafka 증거가 아니다. 기존 Vite500KB 번들 안내는 빌드 실패가 아니다.

npm install 뒤 audit는 개발 도구 계열13건을 보고했다. lock 변경은 SDK1개 추가이며 기존 패키지 버전은 바뀌지 않았다. SDK 항목의 취약점 보고는 없고 무관한 강제 업그레이드는 수행하지 않았다.

## 실제 공유 환경

| 구분 | 기준 |
|---|---|
| 최초 Core |7a64bbbd11cc37f2960854886de18f4750241cf0 불변 jar |
| Payment |수정 없는 팀원2c6aa250c106ce471b0335e3ad0ec8bdcc3a3dd9 불변 jar |
| 포트 |Vite5379, Core57038, Payment57039, PostgreSQL57036, Kafka57037 |
| 명시적 대역 |PG/인증57040, Member·Notification57041 |
| 자원 소유 |Backend 담당이 서버/DB/Kafka/대역을 소유하고 제어한다. Frontend는 HTTP/UI만 조작하고 자체 Vite만 정리한다 |

실행 manifest는 `/tmp/order331-followup-browser/manifest.json`, 브라우저 증거는 `/tmp/frontend-order-sheet-20261116/`이다. Core 응답을 intercept하지 않는다. 인증 헤더/JWT/실 paymentKey를 보고서에 넣지 않는다. 아래 성공과 실패를 각각 보존한다.

| 실행 | 결과와 범위 |
|---|---|
| Cart 최초 |화면 준비 전 연속 진입/reload 뒤 로그인 화면으로 돌아가 합계 미표시로 실패. 주문/승인0, 본인 Cart 정리. 회전 refreshToken 대역의 복원 구간을 별도 probe로 확인했고 화면 준비를 기다려 재실행 |
| Cart 재검증 |Frontend 앱50f129cbfd7e34c407fd81e054bda3b952342e14, 하네스의 화면준비 wait1줄 미커밋 차이. 1건24.4초(전체25.6초) 통과. 실제 Product73001/SKU93001/4000원과73002/93002/3000원, 수량3+1 총15000/쿠폰2000/실지불13000. PENDING 준비→202/PROCESSING→새로고침PAID·승인1회·쿠폰USED. 변경 Cart는수량4/새version으로보존, 같은version의다른Cart삭제. 본인잔여Cart만삭제 |
| 단건 최초 |Frontend303e7b5f022c30e1f474bd59f711348733f66a2a. SKU/쿠폰/인증취소·실패/서로다른창3개/202→PAID까지 확인했으나 후속 별도 주문 취소UI가5초안에확인되지않아 테스트전체실패. finally 본인PENDING취소204 뒤GET CANCELLED/newactive204 확인. 취소HTTP를처음에는보존하지못해최초원인은단정하지않음 |
| 취소 관측기 최초 |응답 observer가204/탐색중 body를JSON으로읽어검사중단. 주문생성전실패. 상태관측기는200 body만안전하게읽도록수정 |
| 취소 관측 재검증 |Frontend0097f418fad6ed542106fcbd272decaae3c00973. 1건13.1초(전체14.2초) 통과. 취소HTTP204→GET CANCELLED→UI표시를함께확인 |
| 단건 재검증 |Frontend0097f418fad6ed542106fcbd272decaae3c00973. 새쿠폰으로1건46.8초(전체47.7초) 통과. 첫USED쿠폰을되돌리지않음. SKU93001/쿠폰2000/실지불6000, 취소/실패인증은PENDING·원래기한유지/승인0, 새창3개→승인202/기한→PAID·재진입/승인1회, 후속본인PENDING취소204/UI CANCELLED/newactive204 |
| legacy 재진입 |Frontend303e7b5f022c30e1f474bd59f711348733f66a2a. 1건8.0초(전체8.9초) 통과. newactive204/legacyactive200, 기존번호/기한유지. 신규주문POST0/결제실행0. 원래주문취소/연장없음 |
| 늦은 승인 |Frontend0097f418fad6ed542106fcbd272decaae3c00973, 같은Core jar를복구조회false로재기동한별도환경. 1건통과. Backend소유자가해당처리기한만앞당겨EXPIRED를확인한뒤PG대역해제. 실제Kafka뒤EXPIRED유지/환불REQUESTED/재진입표시/승인버튼없음. 실제환불완료아님 |

Cart PG-f8f8eba6-739d-4e45-be84-1de0c14250b4/paymentId1의 PaymentApproved는 eventId e1ba6f1c-f1d1-413a-baa9-050bd22906d3, topic payment.execution-results.v1 partition0/offset0, Core committedoffset1이다. 발행·소비는 확인했지만 HTTP 복구 조회도 켜져 있어 최초 PAID가 Kafka만의 결과라고 단정하지 않는다.

늦은 PG-2a320399-7399-45b2-b0ec-68f2ec3bb6c6/paymentId10은 복구 조회를 끈 뒤 검증했다. PaymentApproved bb952ae1-7a4a-46b2-b8a6-c5b4eed34941은같은topic partition0/offset3/Core committed4, RefundRequested 1c8313ed-636e-49ba-819c-1f2913407a81은commerce.refund-requests.v1 partition0/offset0이다. Core REQUESTED1/completed_atNULL·outboxpublished1/원주문EXPIRED와재고보존을Backend담당이보존했다. 실제환불소비/완료는미구현으로남는다.

샘플 이미지1은404로fallback표시했고실제이미지제공자성공으로세지않는다. 과거3b44/d588의legacy증거는 [이전 기록](cart-backend-verification.md)에 보존하며 새 흐름의 결과로 재사용하지 않는다.

## 재현 명령과 남은 검증

`e2e:cart-backend`는 CART_E2E_BACKEND_SHA/FRONTEND_SHA/PRODUCT_IDS/COUPON_ID/COUPON_DISCOUNT와격리로그인입력을요구한다. `e2e:order-sheet-backend`는 ORDER_SHEET_E2E_BACKEND_SHA/FRONTEND_SHA/EMAIL/PASSWORD/PRODUCT_ID/SKU_ID와선택된시나리오의COUPON_ID/COUPON_DISCOUNT/LEGACY_GROUP/LATE_SIGNAL_FILE을요구한다. late는Backend소유자와협의해정확그주문만제어하며일반브라우저에제어API/token을노출하지않는다.

최신 Backend 고정 SHA의 SDK 인터페이스 대역 Redirect 콜백→실 Core 승인 검증 결과는 아래에 기록했다. 이 검사는 실제 SDK 원격 구현·실 PG·실 환불 완료를 입증하지 않는다. 고객키 공급원과 상점 설정은 별도 제공이 필요하다. merge/ready/배포는 하지 않는다.


## 최신 SDK 콜백 실API 결과와 최종 인계

Core `4e99a0f5f86fb7f302aa8c2eb09bf02040f8650c` + Frontend `94b1bee1f78ec7c5a624f374a8f5bcedccfe9c5c`에서 콜백 실API1건이30.2초(전체31.4초)에 실패·스킵0으로 통과했다. 이 Core는 policy1/2 미연결active409 보완을 포함한 불변 jar이며 Payment는 위2c6aa250 그대로다. HTTP복구조회는false였다. 이전7a64검증이과거policy2까지포함했다고확대하지않는다.

주문PG-6bcecdcb-c7d9-4acb-8639-ad4a6ef962c2/paymentId11, SKU93002 수량2/실지불6000이다. 실제provider소스에SDK인터페이스대역을주입해setAmount/결제수단·약관렌더/requestPayment순서를확인하고, PG_AUTH_DOUBLE이준인증결과를실제successUrl로전달했다. 콜백은nonce/창/금액을대조한뒤Core승인202→PAID/처리기한불변/새로고침·승인1회를확인했다. 원격TossSDK요청은0이며실제SDK원격구현의실행성공이아니다. 인증키가주소와후속API Referer에남지않는것도검사했다. 원증거와390px/desktop화면은 `/tmp/frontend-order-sheet-20261116/widget-callback/`에보존했다.

최종선택실API시나리오는Cart·단건·독립취소·legacy재진입·late·SDK인터페이스콜백의6건이각각통과했다. 앞선3회의실패(세션준비전reload,취소UI5초미확인,204진단body파싱)는삭제하지않고위와같이구분한다. 최종콜백뒤추가실API호출은멈췄고자체Vite와이전세션fixture의남은프로세스0을확인했다. Backend소유자에게정확주문번호를전달해마지막DB/Kafka를보존한뒤본인환경만정리하도록인계했다.

실제상점의client/secret키세트, 회원별customerKey공급원, 그공급자를기본main.tsx의bootstrap에연결하는운영설정은아직없다. provider/콜백코드가존재하는것과현재배포앱의실인증이활성화된것을구분한다. 이PR은그공급원HTTP계약을새로만들거나고객키/자격증명을발급하지않는다. 실SDK원격실행·실PG/실계좌·늦은승인실환불완료는미검증/후속이다. 전체Order요구수용·merge가능·ready·배포완료로보고하지않는다.

PR작성자는Frontend담당이다. 2026-11-16 Backend writing.md의쉬운설명/PR작성절을읽고PR81의base dev·실제HEAD/diff를확인해제목/본문을전환범위로다시작성했다. 게시후본문전체를읽어과거“SDK패키지없음/실API대기”문구가현재구현/검증결과와모순되지않게고쳤다. 코디네이터에게최종설명검토를요청하고별도감독결과와구분한다. 후속기록커밋은검증한앱/계약/SDK코드를바꾸지않는다.
