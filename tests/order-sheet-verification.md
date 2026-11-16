# 새 주문서 호출자 전환 검증

## 범위와 계약

이 작업은 기존 `fix/cart-product-group-compat` / Draft PR81의 후속이다. 시작 Frontend는2d30c7ec50f5253bfaaf20ebe701fc0245ddd095이며 Backend 기준은cf79be0a2766964075f0e6cef67ebcd8a0841cee의 `contracts/api/commercecore-service.yaml`와 `OrderPaymentRelayController`/`PaymentRelayService`다. Backend는 읽기 전용으로 두고 공유 계약이나 Payment 원본을 수정하지 않는다. Backend의 신규active와 단건견적skuId 계약 후속은 검증된 SHA를 별도 기록한다.

신규 주문은 `/v1/order-sheets`로 생성하고 `/payment`로 준비를 복구하며 `/payment/checkouts`로 결제창을 연다. 인증 결과의 `orderId`는 pgOrderId로 매핑하고 실제 인증 결과가 온 뒤에만 `/payment/approval`을 호출한다. 조회는 `/v1/order-sheets/{number}`, PENDING 취소는 `/cancel`이다. 기존 주문·결제묶음 조회/진행 중 결제/환불 화면은 그대로 남는다.

Cart itemId/version, skuId, productId를 구별한다. 신규 Cart 요청은 cartItems 원본버전을 보낸다. 쿠폰은 사용자가 적용 상품을 선택하고 그 상품의 견적으로 할인액을 확인한 뒤 couponSkuId와 할인후expectedAmount를 보낸다. 단건은 기존 구매자견적 응답의 명시적skuId를 사용한다. 상품ID를SKU로 추정하거나 몰래Cart를 만들지 않는다. 공개 다중SKU/옵션/#340·동시수량환불#345는 확장하지 않는다. 새 계약의 양수 금액 제약은 표시하며 기존legacy0원 경로의 계약은 변경하지 않는다.

## 상태와 복구

준비 PENDING은 서버expiresAt, 승인 접수 뒤 PROCESSING은 서버processingExpiresAt을 따로 표시한다. 클라이언트가 기한을 연장하지 않는다. 준비·결제창 열기·인증취소만으로 승인을 요청하지 않는다. 같은 인증결과/키를 탭의 회원별sessionStorage로 보존한다. 응답 유실·15초HTTP시간초과·202·UNKNOWN에서 새 결제나 실패를 합성하지 않고 같은 주문을 조회한다. 자동조회는2초 간격 최대30회이며 언마운트시예약을정리하고 이후사용자가같은주문을다시조회할수있다. 기한이 지난 인증 결과는 GET으로상태를확인해추가승인을보내지않는다.

생성 전/응답 유실/재진입에 새active와legacyactive를 종류별로 조회한다. 한 경로의204를다른종류의주문부재로해석하지않는다. 최근새주문번호는회원별로보존하며기존주문목록에서재진입할수있다. PAID/확정FAILED/EXPIRED/CANCELLED와늦은승인환불REQUESTED/SUCCEEDED/FAILED를구분하고요청/Kafka전달만으로환불완료라표시하지않는다.

## 인증 설정 경계

현재 저장소에는 실SDK 패키지·clientKey/customerKey·운영 returnURL 설정이 없다. 인증 포트는 이 공백을 숨기지 않으며 설정 없는 앱에서 승인을 시작하지 않는다. 팀원계약의Core값은pgOrderId/amount/expiresAt뿐이다. 실제SDK연동이나실PG·실계좌검증완료를주장하지않는다.

개발환경에서만 `VITE_PG_AUTH_DOUBLE_URL=http://127.0.0.1:57040`을 명시하면 Backend담당이소유한 인증대역을쓴다. UI에도실PG가아닌테스트인증대역임을표시한다. 입력POST `/fixture/authentications`의outcome과scenario는명시적개발검증용이며운영승인성공을합성하는정책이아니다. 취소/인증실패는Core승인을호출하지않는다. 브라우저에내부Payment API·서비스토큰을노출하지않는다.

## 독립 검증

단위/HTTP소비자계약: `npm test`. UI fixture: `npm run e2e:checkout-ui`. `npm run lint`/`npm run build`도영향검사한다. 기존legacy조회/0원결제최종반영·환불회귀를유지하면서새Cart버전/생성응답유실/인증후승인/재진입·인증취소/인증실패/기한후인증/늦은환불/단건SKU·쿠폰경계를확인한다. fixture브라우저는실Core/Payment/Kafka증거가아니다.

## 실API 검증 준비

전용Vite5379가Core57038·JWT세션/알림대역57041로proxy한다. Backend담당은PostgreSQL57036·Kafka57037·팀원Payment57039·PG대역57040을소유한다. 검증은고정실행SHA/seed/JWTmanifest인계후수행한다. Member대역/PG대역·실서비스·실SDK의범위를각각기록하고Backend소유자원은직접변경하지않는다.

`e2e:cart-backend`는현재새주문서실응답을사용하며 Core응답을intercept하지않는다. CART_E2E_BACKEND_SHA/FRONTEND_SHA/PRODUCT_IDS/COUPON_ID/COUPON_DISCOUNT와격리로그인입력이필수다. 개인정보·JWT·실paymentKey를로그/첨부에남기지않고생성한Cart만정리한다. PAID주문은의미없이취소/환불하지않는다. 이전3b44/d588의legacy검증은[이전기록](cart-backend-verification.md)에당시증거로보존한다.

2026-11-16 독립 체크포인트: 단위·소비자계약94건, fixture브라우저12건 실패/오류/스킵0, lint/build 통과다. Vite의기존500KB번들안내는빌드실패가아니다. 단건가격변경중오래된견적주문차단·Cart버전과선택·생성/승인응답유실·202/UNKNOWN·인증취소/실패/기한후인증·환불요청/실패/성공·legacy조회와0원확정반영을검사했다. 실제API환경은아직준비중이며이결과를실서비스연계성공으로세지않는다.

## 실제 Cart 승인 체크포인트

Core `7a64bbbd11cc37f2960854886de18f4750241cf0`, 수정 없는 팀원 Payment `2c6aa250c106ce471b0335e3ad0ec8bdcc3a3dd9`, Frontend 앱 `50f129cbfd7e34c407fd81e054bda3b952342e14`에서 실제 Cart 브라우저1건이24.4초(전체25.6초)에 통과했다. 당시 하네스에는 로그인 복원이 끝난 Cart 화면을 기다리는1줄의미커밋수정이있었고앱소스는clean이었다. 첫 실행은Cart진입즉시reload로로그인화면에돌아가합계미표시로실패했으며주문/승인0·본인Cart정리완료다. 회전refreshToken대역의세션복원구간을별도probe로확인한뒤화면준비를기다려재실행했다. 첫실패를숨기거나금액/수량검사를약화하지않았다.

상품73001/SKU93001·단가4000, 상품73002/SKU93002·단가3000과별도CartID를실제응답에서추적했다. 수량3+1의총액15000·선택SKU쿠폰2000·예상실결제13000을전달했다. 준비PENDING/processing기한null,실승인202/PROCESSING,새로고침후PAID·승인1회·쿠폰USED를확인했다. 승인전변경한Cart는수량4/다음version으로보존됐고같은version의다른Cart는삭제됐다. 본인잔여Cart만삭제했다.

PaymentApproved `e1ba6f1c-f1d1-413a-baa9-050bd22906d3`, 실제topic `payment.execution-results.v1` partition0/offset0,Core그룹`commercecore-payment-results-v1` committedoffset1을Backend담당이보존했다. 이환경은HTTP복구조회도켜져있어최초PAID전이가Kafka만의결과라고단정하지않는다. 원증거는 `/tmp/order331-followup-browser/kafka-PG-f8f8eba6-739d-4e45-be84-1de0c14250b4.json` 및동일폴더cart-pending-outbox/DB/delivery이고브라우저증거는 `/tmp/frontend-order-sheet-20261116/cart-pending/`에인증정보없이보존했다. 명시적Member/Notification/인증/PG대역이며실SDK/실PG가아니다.

단건 첫 실API 실행은 SKU93001/쿠폰2000/실지불6000·인증취소/실패 후 PENDING 및 원래기한유지·서로다른결제창3개·승인202후PAID/승인1회까지확인했으나추가주문취소UI에서5초안에CANCELLED가표시되지않아테스트전체는실패다. 추가주문은finally에서본인PENDING만취소했고실GET CANCELLED/newactive204를확인했다. 처음에는취소HTTP이벤트를보존하지못해원인을단정하지않으며HTTP204/후속GET/화면을동시에기록하는별도검사를추가했다. 기존USED쿠폰을되돌리지않고Backend담당이새로발급한재검증쿠폰만사용한다. 실패화면/첫PAID화면은 `/tmp/frontend-order-sheet-20261116/direct-first-failed/`에보존했다.

legacy전용계정재진입실API1건은8.0초(전체8.9초)에통과했다. 새active204/기존active200을구분하고기존번호와기한을유지했으며신규order-sheets POST0/결제실행0이다. 기존주문은취소하거나연장하지않았다. 최신독립회귀는단위94/fixture브라우저13·lint/build통과다.
