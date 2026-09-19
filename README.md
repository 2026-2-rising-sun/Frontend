# Frontend

2026-하반기프로젝트-a팀 FE 레포지토리입니다. React 19 + TypeScript + Vite, 반응형(모바일 우선 → 태블릿 → PC).

> **`mocking-branch`**: 백엔드가 준비되기 전에 프론트만으로 동작하도록 mock 데이터를 붙인 브랜치입니다.
> 실제 코드와 mock 을 **폴더·의존성 양쪽에서 분리**해서, 나중에 mock 만 깔끔하게 걷어낼 수 있게 만들었습니다.

## 실행

```bash
npm install
npm run dev        # mock 모드 (백엔드 없이 동작, .env.development)
npm run dev:api    # 실제 백엔드 모드 (.env.api, /api 로 요청)
npm run lint       # oxlint + mock 경계 검사 (CI 에서도 실행)
npm run build      # production (mock 코드는 번들에 포함되지 않음)
```

mock 모드에서는 화면 우측 아래 **MOCK** 버튼으로 시연용 패널을 열 수 있습니다.

| 설정 | 용도 |
|---|---|
| Mock 결제 시나리오 | 즉시 성공 / 즉시 실패 / 지연 후 성공 / 지연 후 실패 |
| 지연 확정 시간, 네트워크 지연 | "결제 확인 중"과 로딩 화면 확인 |
| 상품·방송 조회 실패시키기 | 오류 화면과 "다시 시도" 확인 |
| 미결제 주문 만료 | 결제를 시작하지 않은 주문의 결제 기한(기본 꺼짐 — 명세상 시간은 팀 합의 사항) |
| 결제 시작 요청 실패시키기 | 주문은 만들어졌지만 결제를 시작하지 못한 "결제 전" 화면과 만료 카운트다운 확인 |
| 데이터 초기화 | 재고·주문·관리 화면에서 바꾼 데이터를 시드 상태로 되돌림 |

## 배포 (Vercel, 수동)

CI/CD 없이 CLI 로 직접 배포합니다. (`vercel.json` 에 빌드·SPA 라우팅 설정이 있음)

```bash
npx vercel login          # 최초 1회 (브라우저 인증)
npx vercel --prod         # 프로덕션 배포. 첫 실행 시 프로젝트를 연결(link)한다
```

- `vercel.json` 의 `buildCommand` 가 `VITE_USE_MOCK=true` 로 빌드하므로 **배포본은 mock 모드**로 동작합니다.
  (백엔드가 없는데 production 기본값(`false`)으로 빌드하면 `/api` 호출이 실패해 화면이 비어 보입니다.)
- 백엔드가 준비되면 `buildCommand` 를 `npm run build` 로 바꾸고, mock 제거 절차를 진행하세요.
- `/products/1` 같은 경로로 새로고침해도 404 가 나지 않도록 모든 경로를 `index.html` 로 rewrite 합니다.

## 구조: 화면은 "계약"만 안다

```
src/
├─ domain/            ← 계약. 타입(types) · 오류(errors) · API 인터페이스(ports). 어떤 구현도 import 하지 않음
├─ api/http/          ← 실제 백엔드 어댑터 (fetch)          ┐ 같은 domain/ports 를
├─ mocks/             ← mock 어댑터 + 시드 데이터 + 시연 패널 ┘ 구현하는 두 개의 구현체
├─ bootstrap/
│  └─ createApi.ts    ← 실제/mock 중 무엇을 쓸지 정하는 "유일한" 곳
├─ app/               ← App, 라우팅, 레이아웃(Header · BottomNav), ApiContext
├─ features/          ← 화면. shopping · live · commerce · home
├─ components/ui/     ← 재사용 UI (Figma Components 와 1:1)
├─ styles/            ← 디자인 토큰(tokens.css), 타이포, 기본 스타일
└─ hooks/ lib/        ← useAsync, 포맷 유틸
```

```
 features/*  ──useApi()──▶  domain/ports (Api)  ◀── api/http   (실제)
                                    ▲
                                    └──────────── mocks        (mock)
                bootstrap/createApi.ts 가 둘 중 하나를 골라 주입
```

- 화면(`features/*`)은 `useApi()` 로 `Api` 인터페이스만 받습니다. 실제인지 mock 인지 **모릅니다**.
- mock 은 `import('../mocks')` **동적 import** 라서 production 번들에 들어가지 않습니다 (`.env.production` 의 `VITE_USE_MOCK=false`).
- `scripts/check-mock-boundary.mjs` 가 아래 규칙을 자동 검사합니다 (`npm run lint` → CI).

| # | 규칙 | 이유 |
|---|---|---|
| 1 | `src/mocks` 는 `src/bootstrap` 만 import 할 수 있다 | mock 을 지울 곳이 한 곳뿐 |
| 2 | `src/mocks` 는 `domain` 과 자기 자신만 import 한다 | mock 이 화면·실제 API 를 알면 안 됨 |
| 3 | `src/api/http` 는 `bootstrap` 과 `api` 안에서만 import 한다 | 화면이 실제 구현에 묶이지 않게 |
| 4 | `src/domain` 은 다른 계층을 import 하지 않는다 | 계약은 가장 안쪽 |

## 백엔드가 준비되면 (mock 제거)

1. `src/mocks/` 폴더 삭제
2. `src/bootstrap/createApi.ts` 의 `if (import.meta.env.VITE_USE_MOCK === 'true') { … }` 블록 삭제
3. `.env.development` 의 `VITE_USE_MOCK=true` 를 `false` 로 (또는 파일 삭제)
4. `src/api/http/index.ts` 의 **엔드포인트 경로·응답 모양**을 백엔드 OpenAPI 에 맞게 조정

화면 코드는 한 줄도 바꾸지 않습니다. (`npm run lint` 가 통과하면 경계가 깨지지 않은 것)

> ⚠️ `src/api/http` 의 경로(`/shopping/products`, `/commerce/orders` …)는 백엔드 스펙(`Backend/contracts/api`)이 아직 없어
> 프론트가 **가정**한 값입니다. 실제 서버와는 아직 붙여본 적이 없습니다.

## 화면 (Figma "Live Commerce Design System" 기준)

| 경로 | 화면 | 반응형 |
|---|---|---|
| `/` | 쇼핑 홈 (방송 배너 · 방송 · 상품 목록/검색/필터/정렬) | 상품 2열 → 3열 → 4열 |
| `/products/:id` | 상품 상세 | 모바일: 하단 고정 구매 바 / PC: 2열 |
| `/lives` | 방송 목록 (진행 중 · 예정 · 종료) | 1열 → 2열 → 3열 |
| `/lives/:id` | 방송 시청 + 방송 상품 | 모바일: 세로 / PC: 영상(좌) + 상품(우) |
| `/checkout` | 주문서 | 모바일: 세로 / PC: 폼(좌) + 결제 금액(우) |
| `/orders/:no` | 주문 결과 (결제 전 · 확인 중 · 완료 · 실패 · 취소) | 좁은 중앙 정렬 |
| `/orders/lookup` | 주문 조회 (주문번호 + 조회 비밀번호) | 좁은 중앙 정렬 |
| `/admin/products` `/admin/products/new` `/admin/products/:id` | **관리** 상품 목록 · 등록 · 수정 (판매 설정·재고·판매 상태) | 모바일: 상단 메뉴 / PC: 사이드바 |
| `/admin/lives` `/admin/lives/new` `/admin/lives/:id` | **관리** 방송 목록 · 등록 · 편집 (상품 연결·순서·시작·종료) | 〃 |

> 관리 화면은 로그인·역할이 없는 P1 의 **개발·시연용**입니다. 공개 화면 하단 푸터의 링크로 들어가며, 실제 배포 환경에서는 접근 범위를 팀이 정해야 합니다.

- 반응형 기준: 모바일 `< 768px`, 태블릿 `≥ 768px`, PC `≥ 1024px` (콘텐츠 최대 폭 1200px).
- 모바일은 하단 탭(쇼핑·방송·주문 조회), 태블릿 이상은 상단 내비게이션.
- 디자인 토큰은 Figma 변수와 1:1 (`brand/default` → `--brand-default`).

## 명세 반영 사항 (P1)

- 방송 없이도 상품 조회·구매 가능. 방송 영역과 상품 영역은 **각각 조회**해서 한쪽 실패가 다른 쪽에 번지지 않음.
- 로딩 · 오류 · 결과 없음 · 성공을 항상 구분 (`AsyncView`, `ResultState`). 조회 실패를 품절로 표시하지 않음.
- 주문서에서 본 가격과 서버 가격이 다르면 `PRICE_CHANGED` 로 거절되고, 새 금액을 다시 확인받음.
- 주문 생성 시 재고 차감, 실패·취소 시 **한 번만** 복구. 반복 조회·재요청에도 중복 반영 없음.
- 결제 결과가 미확정이면 "결제 확인 중"으로 두고 자동 갱신 (실패로 단정하지 않음).
- 주문번호만으로는 주문을 볼 수 없음 (조회 비밀번호 필요, 존재 여부도 노출하지 않음).

## 관리 화면이 지키는 규칙 (P1 명세)

- 상품: 등록(기본정보만 = `DRAFT`) → 판매 설정(가격·최초 재고 = 판매 준비) → 판매 시작(이미지·재고 필요) → 비공개/공개 재개. 삭제 대신 비공개.
- 판매 설정 재요청으로 재고가 초기값으로 되돌아가지 않음. 재고 수정은 화면이 본 재고와 다르면 `CONFLICT`. 기본정보 수정은 `version` 이 다르면 `CONFLICT` (조용히 덮어쓰지 않음).
- 가격 변경은 새 주문부터 적용되고 기존 주문 금액은 유지. 상품명이 바뀌어도 기존 주문의 상품명은 유지.
- 방송: 준비 중 = 전체 편집·상품 연결/해제 / 진행 중 = 노출 순서만 / 종료 = 조회만. 상품 없이도 준비 중으로 저장 가능, 시작하려면 시청 연결 정보 + 판매 가능한 연결 상품 1개 이상.
- 방송을 종료해도 상품 판매 상태·기존 주문·이후 구매는 그대로.

## 팀 합의 전 임시값 (한 곳에서만 바꾸면 됨)

| 값 | 위치 | 현재 |
|---|---|---|
| 입력 제약(글자 수, 이미지 형식·용량) | `src/domain/constraints.ts` | 상품명 100자, 설명 2000자, JPG/PNG/WEBP 2MB |
| 한 번에 가져오는 목록 수 | `HomePage`(상품), `LiveListPage`(방송), 관리 목록 | 12 / 6 / 20 |
| 방송 상품 자동 갱신 주기 | `LiveWatchPage.tsx` `PRODUCT_REFRESH_MS` | 15초 |
| 미결제 주문 만료 시간 | MOCK 패널 (`mocks/control.ts`) | 사용 안 함 |

## 아직 없는 것 / 화면만 있는 것

- **이미지 등록**: 파일 선택·형식/용량 검증·미리보기까지만 동작합니다. 실제 저장(업로드)은 하지 않고 mock 은 "등록됨"만 기록합니다.
- **IVS 연결**: 방송 등록 화면의 "시청 연결 정보" 입력(형식 검증)까지만 있습니다. 실제 IVS 연결·재생은 없고, 공개 방송 시청의 `LivePlayer` 는 재생 URL 이 있으면 `<video>` 로 재생하고 없으면 자리 표시를 보여줍니다.
- 로그인·장바구니(P2), 채팅·알림(P3), Mock 결제 시나리오 관리 화면.
- 자동화 테스트 프레임워크 (`tests/README.md` 참고: 미결정).
