# ShoppingLive Frontend

React·TypeScript·Vite 프론트엔드. `mocking-branch`에서 현재 백엔드 API에 연동하며 앱 내부 mock 데이터와 결과 조작 패널을 제거했습니다.

```sh
npm ci
npm run dev
npm run lint
npm run test
npm run build
```

로컬 개발은 Member 8081, Shopping 8082, Commerce 8083, Live 8084로 연결합니다. `MEMBER_URL`, `SHOPPING_URL`, `COMMERCE_URL`, `LIVE_URL` 환경변수로 대상 주소를 바꿀 수 있습니다. 요청 경로는 `/api/<service>/v1/...`이며 개발 프록시와 실제 Ingress의 계약이 같습니다. Vercel은 API reverse proxy 또는 `VITE_API_BASE_URL`의 실제 서버 연결 설정이 추가로 필요합니다.

kind 수동 환경은 `npm run local:kind` → `npm run local:frontend`로 실행합니다. http://localhost:5174 에서 `user/user`, `seller/seller`로 로그인합니다. `local:kind`는 JDK 21·Docker·kind·kubectl과 옆의 Backend 저장소가 필요합니다.

[연동 체크리스트·3단계 진행 상태·구현 갭·Prism/kind 테스트·수동 확인](docs/api-integration.md)
