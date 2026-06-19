# 이슈트래커 — Claude Code 인수인계 문서

> 이 문서를 먼저 읽고 작업을 시작하세요. 프로젝트의 구조, 규칙, 현재 상태가 모두 담겨 있습니다.

---

## 필수 규칙 (반드시 지킬 것)

- **배포 전 반드시 버전 먼저 말하기** — "v1.0.XX로 배포하겠습니다" 확인 후 진행
- **배포 전 항상 버전 bump** — `src/main.tsx`의 console.log 버전 문자열 수정
- **`.env.local` 절대 커밋 금지** — Firebase 설정, 서비스 계정 키, 앱 인증 정보 포함
- **배포 명령어**: `git push git@github-new:great-mangofarm/test-system.git main`
- **앱 이름**: 이슈트래커

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | Vite + React 19 + TypeScript |
| 스타일 | Tailwind CSS v4 + shadcn/ui (Radix UI) |
| DB | Firebase Firestore (client SDK) |
| 인증 | Firebase Auth |
| 이미지 | Cloudinary (`uploadImage` from `@/lib/firestore`) |
| 서버리스 | Vercel API Routes (`/api/*.ts`) |
| 이슈 연동 | Jira REST API + ADF (Atlassian Document Format) |
| 에디터 | Tiptap (`@tiptap/react`, `@tiptap/starter-kit`) |
| 배포 | Vercel — `git push`로 자동 배포(GitHub 연동). 프리뷰는 브랜치 push |

---

## 현재 버전

**v1.0.34** (배포 완료)

> 배포/환경 관련 주의: 시크릿(`FIREBASE_SERVICE_ACCOUNT`, `JIRA_*`)은 Vercel **Production·Preview 스코프에만** 있음(Development 없음) → `vercel dev`로는 `/api/*` 함수가 안 돔. **API 변경 테스트는 브랜치 push → Vercel 프리뷰**로. 프로덕션 도메인: `issue.datasystem.app`.

---

## 프로젝트 구조

```
src/
  pages/
    HomePage.tsx         # 제품/테스트묶음 목록
    TestCasesPage.tsx    # 테스트케이스 & 운영이슈 목록 (핵심 파일, 1700줄+)
    AdminPage.tsx        # 사용자 권한 관리 (admin만 접근)
    LoginPage.tsx
    RegisterPage.tsx
  components/
    IssueForm.tsx        # 운영이슈 등록 폼 (dev suite용)
    TestCaseForm.tsx     # 테스트케이스 등록 폼 (qa suite용)
    RichTextEditor.tsx   # Tiptap 에디터 (이미지 붙여넣기/드롭/업로드 지원)
    ui/
      sheet.tsx          # 커스텀 사이드 드로어 컴포넌트
      checkbox.tsx       # 커스텀 체크박스 (onChange prop, onCheckedChange 아님)
      switch.tsx         # 커스텀 토글 스위치 (onChange prop)
  lib/
    firestore.ts         # Firestore CRUD + uploadImage + deployBatches CRUD
    constants.ts         # 레이블/색상 + ROLE_LABELS, VIEW_CONTROL_ROLES, canViewByRole
    firebase.ts          # Firebase 초기화 (ignoreUndefinedProperties)
    api.ts               # authedFetch — /api 호출 시 Firebase ID 토큰 자동 첨부
  store/
    auth.tsx             # 인증 상태, 가입 시 기본 role = 'staff'
  types/
    index.ts             # 모든 TypeScript 타입 정의

api/                     # Vercel 서버리스 함수 (모두 Firebase 토큰 인증 필요)
  lib/
    admin.ts             # firebase-admin 초기화 (FIREBASE_SERVICE_ACCOUNT)
    auth.ts              # requireAuth — Bearer 토큰 검증 + role 가드
  jira.ts                # Jira 티켓 생성 (ADF 형식)
  jira-delete.ts         # Jira 티켓 삭제
  jira-update-assignee.ts
  jira-users.ts
  jira-webhook.ts        # JIRA_WEBHOOK_SECRET 설정 시 ?token= 검증

firestore.rules          # 보안 규칙 원본 (Vercel 배포 X → 콘솔에서 게시 필요)
```

---

## 핵심 타입 (`src/types/index.ts`)

```typescript
type UserRole = 'admin' | 'developer' | 'staff'   // viewer 폐지(staff로 통합)
type SuiteType = 'qa' | 'dev'
type Priority = 'critical' | 'high' | 'medium' | 'low'
type TestStatus = 'pass' | 'fail' | 'blocked' | 'not_tested'
type ProcessingStatus = 'pending' | 'in_progress' | 'dev_deploy_waiting' | 'dev_deployed' | 'resolved' | 'wont_fix'
type DeployBatchStatus = 'planned' | 'deployed'

interface Product   { /* ... */ visibleRoles?: UserRole[] }   // 역할별 노출 제어
interface TestSuite { /* ... */ visibleRoles?: UserRole[] }

interface DeployBatch {   // 배포묶음 (suite 단위)
  id, suiteId, name, deployDate, status: DeployBatchStatus, order, createdAt
}

interface TestCase {
  // 공통 필드
  id, suiteId, productId, area, title, priority
  processingStatus, ticketLink, assignedDeveloper
  startDate, dueDate, order, createdAt, updatedAt
  images: string[]

  // 테스트케이스 전용
  status: TestStatus
  steps, expectedResult, actualResult, resultNote, tester
  resultImages: string[]

  // 운영이슈(recordType='issue') 전용
  recordType?: 'testcase' | 'issue'
  background?        // 개요
  requirements?      // 범위 및 요구사항
  figmaLink?
  featureSpec?       // 기능/화면 정의
  devChangelog?      // 개발 변경 내역
  testChecklist?: Array<{ text: string; checked: boolean }>
  testProgressNote?
  deployBatchId?     // 배포묶음 ID
}
```

---

## 권한 구조

| Role | 설명 | 주요 권한 |
|------|------|----------|
| `admin` | 관리자 | 모든 권한 + 프로덕트/묶음 관리 + 사용자 관리 |
| `developer` | 개발자 | 이슈/테스트케이스 등록·수정·삭제 + Jira. **프로덕트/묶음 관리 X, AdminPage X** |
| `staff` | 스태프 (기본 가입 role) | 조회 위주 (현재 편집 권한 없음) |

> `viewer`는 폐지됨 — AdminPage 진입 시 기존 viewer 계정은 자동으로 staff로 이관.

**코드 내 권한 체크 패턴:**
```typescript
// 이슈/테스트케이스 편집 (admin + developer)
const isAdmin = user?.role === 'admin' || user?.role === 'developer'
const canEditStatus = user?.role === 'admin' || user?.role === 'developer'

// 프로덕트/묶음 구조 관리 (admin 전용) — HomePage
const canManageProduct = user?.role === 'admin'
const canManageSuite = user?.role === 'admin'

// App.tsx — AdminPage 라우트 가드 / 헤더 사용자관리 버튼도 admin 전용
if (user.role !== 'admin') return <Navigate to="/" replace />
```

> **권한은 Firestore 보안 규칙(`firestore.rules`)으로 서버에서 강제** — 클라이언트 체크는 UI 가림일 뿐. 규칙 변경 시 Firebase 콘솔에서 게시해야 적용됨.

---

## Suite 타입과 UI 분기

- `suite.type === 'qa'` → **테스트케이스** 목록, 아코디언 상세 확장
- `suite.type === 'dev'` → **운영이슈** 목록, 행 클릭 시 **사이드 드로어** 오픈

```typescript
const isIssueSuite = suite?.type === 'dev'
```

---

## 완료 이슈 숨기기 조건

```typescript
if (hideCompleted) {
  if (isIssueSuite && c.processingStatus === 'resolved') return false        // 운영이슈
  if (!isIssueSuite && c.status === 'pass' && c.processingStatus === 'resolved') return false  // 테스트케이스
}
```

---

## 사이드 드로어 (`src/components/ui/sheet.tsx`)

- 커스텀 구현 (shadcn Sheet 아님)
- `Sheet`, `SheetHeader`, `SheetBody`, `SheetFooter` export
- 오버레이: `bg-black/20` (블러 없음)
- ESC 키로 닫기, body 스크롤 잠금

---

## Jira ADF 주의사항

ADF text 노드에 `\n` 포함 불가 → 줄바꿈은 별도 paragraph 노드로 분리해야 함

```typescript
// api/jira.ts
function htmlToADFParagraphs(html: string): unknown[]
// stripHtml → split('\n') → 각 줄을 { type: 'paragraph', content: [...] }
```

---

## RichTextEditor 리스트 표시

Tailwind reset이 list-style 제거 → 명시적 CSS 필요:
```typescript
// RichTextEditor.tsx EditorContent className에 포함됨
'[&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ul]:my-1',
'[&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_ol]:my-1',
```

---

## 처리 상태 (`ProcessingStatus`)

```
pending → in_progress → dev_deploy_waiting → dev_deployed → resolved
                                                          → wont_fix
```

| 값 | 한국어 | 색상 |
|----|--------|------|
| `pending` | 미처리 | slate |
| `in_progress` | 처리중 | blue |
| `dev_deploy_waiting` | 개발배포대기 | indigo |
| `dev_deployed` | 개발배포 | violet |
| `resolved` | 처리완료 | emerald |
| `wont_fix` | 보류 | slate-400 |

> 처리상태 Select는 TestCasesPage 5곳 + IssueForm + TestCaseForm에 있음 — 추가 시 전부 반영.

---

## Firestore 컬렉션

- `products` — 제품 목록 (`visibleRoles`로 역할별 노출 제어)
- `suites` — 테스트 묶음 (productId로 필터, `visibleRoles`)
- `testcases` — 테스트케이스 + 운영이슈 (suiteId로 필터)
- `deployBatches` — 배포묶음 (suiteId로 필터)
- `users` — 사용자 프로필

---

## 이미지 업로드

```typescript
import { uploadImage } from '@/lib/firestore'
const url = await uploadImage(file)  // Cloudinary 업로드 → URL 반환
```

---

## 버전 bump 위치

```
src/main.tsx
console.log('%c 이슈트래커 v1.0.XX ', ...)
```

---

## 주요 기능 (최근 추가)

### 역할별 노출 제어 (`visibleRoles`)
- 프로덕트/묶음 수정 다이얼로그에서 staff에게 노출 여부 설정 (admin·developer는 항상 조회)
- `canViewByRole(visibleRoles, role)` (`lib/constants.ts`): undefined=전체공개. HomePage 목록 필터 + TestCasesPage 딥링크 가드
- ⚠️ 클라이언트 필터일 뿐 — 민감 데이터면 규칙으로도 막아야 함

### 묶음 개인 숨김 (사용자별·기기별)
- 각 묶음 카드 눈 아이콘으로 숨김, 상단 토글 스위치로 표시/해제
- `localStorage` 키 `hiddenSuites:{uid}` — 백엔드 무관

### 배포묶음 (Deploy Batch)
- 운영이슈(dev) 묶음에서 "이번 배포에 포함되는 이슈" 그룹핑 (suite 단위)
- 필터바 `+ 배포묶음` 생성(이름+예정일), 이슈 목록을 배포묶음별 그룹 헤더로 표시, 상태 토글(예정/완료)
- 이슈 등록 폼·드로어에서 `deployBatchId` 배정. 컬렉션 `deployBatches`

### API 인증 (v1.0.32~)
- 모든 `/api/jira*`는 `Authorization: Bearer <Firebase ID토큰>` 필요 (`api/lib/auth.ts`의 `requireAuth`, admin·developer만)
- 프론트는 `src/lib/api.ts`의 `authedFetch` 사용 (토큰 자동 첨부)

### Jira 우선순위 매핑 (`api/jira.ts` PRIORITY_MAP)
- 긴급→Hotfix, 높음→High, 보통→Medium, 낮음→Low

### 에디터 이미지
- `RichTextEditor`: 붙여넣기/드래그/툴바 버튼 → Cloudinary 업로드 후 본문 삽입 (`@tiptap/extension-image`)

---

## 문서 안내

- **`README.md`** — 프로덕트 소개(무슨 앱인지, 기능, 역할, 화면, 실행/배포)
- **`CHANGELOG.md`** — 버전별 변경 이력 + **다음에 볼 때 확인할 미해결 항목** (작업 재개 시 최상단 "🔭 다음에 볼 때" 먼저 확인)
- **이 문서(CLAUDE.md)** — 구조·규칙·권한·주의사항(인수인계용)

---

## 다음에 볼 때 (요약 — 상세는 CHANGELOG의 "🔭 다음에 볼 때")

작업 재개 전 빠른 체크:

1. **Jira 우선순위 검증** — `api/jira.ts` `PRIORITY_MAP`의 `high: 'High'`가 실제 Jira와 맞는지(가정 상태). 높음 이슈 만들어 확인.
2. **규칙 변경 시 콘솔 게시** — `firestore.rules`는 저장소 기록용. Firebase 콘솔에서 게시해야 적용.
3. **API/서버 작업 시** — `vercel dev`는 시크릿이 없어 안 됨(Production/Preview 스코프에만 존재). **브랜치 push → Vercel 프리뷰**로 테스트. 프리뷰는 Vercel SSO 벽이 있으나 브라우저 로그인으로 통과.
4. **큰 미완 과제** — 다우오피스 전자결재 연동(스태프 개발요청서 자동 기안)은 **유료 옵션 결정 대기**. 조사 내용은 CHANGELOG 참고.
5. **코드리뷰 잔여** — index key, stats 중복읽기, 페이지네이션 등 낮은 우선순위 항목들이 CHANGELOG에 정리돼 있음.

---

## 작업 시 주의 (이번 정비에서 확인된 것)

- **처리상태 Select는 7곳** — TestCasesPage 5곳 + IssueForm + TestCaseForm. 상태 추가 시 전부 반영.
- **권한 플래그 구분** — 이슈 편집은 `isAdmin`(admin+dev), 구조 관리는 `canManageProduct`/`canManageSuite`(admin only). Firestore 규칙과 항상 일치시킬 것.
- **운영이슈 통계는 `resolved` 기준** (qa는 `pass` 기준) — 통계 코드 수정 시 `isIssueSuite` 분기 유지.
- **에디터 value 동기화는 `editor.isFocused`일 때 건너뜀** — 한글 IME 보호. 이 가드 건드리지 말 것.
