# ShoppingLive Frontend

React·TypeScript·Vite 프론트엔드. `mocking-branch`에서 현재 백엔드 API에 연동하며 앱 내부 mock 데이터와 결과 조작 패널을 제거했습니다.

```sh
npm ci
npm run dev
npm run lint
npm run test
npm run build
```

로컬 개발은 Member 8081, Catalog 8082, CommerceCore 8083, Live 8084, Notification 8085로 연결합니다. `MEMBER_URL`, `CATALOG_URL`, `COMMERCECORE_URL`, `LIVE_URL`, `NOTIFICATION_URL` 환경변수로 대상 주소를 바꿀 수 있습니다. 서비스 포트는 `scripts/services.ts`에서 명시적으로 관리하며 Payment의 내부 포트는 8086입니다. 브라우저는 Payment를 직접 호출하지 않고 CommerceCore의 기존 결제·환불 facade를 사용합니다.

공개 상품 목록·상세·purchase-check·상품 쿠폰은 `/api/catalog/v1/...`, 판매자 상품·이미지·판매·주문·장바구니·쿠폰 발급/관리·결제·환불은 `/api/commercecore/v1/...`로 요청합니다. 판매자 등록 직후에는 Core 원본을 조회하고, 공개 화면은 Catalog 사본 반영 후 노출됩니다. 이미지 URL은 Core가 제공한 값을 그대로 표시하며, 결제 완료는 Core 주문/묶음 상태로 판단합니다.

개발 프록시는 `/api/<service>`를 제거하여 서비스의 `/v1/...`로 전달합니다. Infra/실제 Ingress 라우팅은 별도 반영이 필요하며 이 저장소의 변경만으로 배포 경로가 바뀌지는 않습니다. Vercel은 API reverse proxy 또는 `VITE_API_BASE_URL`의 실제 서버 연결 설정이 추가로 필요합니다.

kind 수동 환경은 `npm run local:kind` → `npm run local:frontend`로 실행합니다. http://localhost:5174 에서 `user/user`, `seller/seller`로 로그인합니다. `local:kind`는 JDK 21·Docker·kind·kubectl과 옆의 Backend 저장소가 필요합니다.
