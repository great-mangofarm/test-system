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
| 배포 | Vercel (`npx vercel --prod`) |

---

## 현재 버전

**v1.0.18** (배포 완료)
> v1.0.19는 아직 미배포 — `개발배포` 처리상태 추가 + 권한 개편 변경이 로컬에 있음

---

## 프로젝트 구조

```
src/
  pages/
    HomePage.tsx         # 제품/테스트묶음 목록
    TestCasesPage.tsx    # 테스트케이스 & 운영이슈 목록 (핵심 파일, 1800줄+)
    AdminPage.tsx        # 사용자 권한 관리 (admin만 접근)
    LoginPage.tsx
    RegisterPage.tsx
  components/
    IssueForm.tsx        # 운영이슈 등록 폼 (dev suite용)
    TestCaseForm.tsx     # 테스트케이스 등록 폼 (qa suite용)
    RichTextEditor.tsx   # Tiptap 기반 리치텍스트 에디터
    ui/
      sheet.tsx          # 커스텀 사이드 드로어 컴포넌트
      checkbox.tsx       # 커스텀 체크박스 (onChange prop, onCheckedChange 아님)
  lib/
    firestore.ts         # Firestore CRUD + uploadImage
    constants.ts         # 레이블/색상 상수 (PRIORITY, TEST_STATUS, PROCESSING_STATUS)
    firebase.ts          # Firebase 초기화
  store/
    auth.tsx             # 인증 상태, 가입 시 기본 role = 'staff'
  types/
    index.ts             # 모든 TypeScript 타입 정의

api/                     # Vercel 서버리스 함수
  jira.ts                # Jira 티켓 생성 (ADF 형식)
  jira-delete.ts         # Jira 티켓 삭제
  jira-update-assignee.ts
  jira-users.ts
  jira-webhook.ts
  jira-fields.ts
```

---

## 핵심 타입 (`src/types/index.ts`)

```typescript
type UserRole = 'admin' | 'developer' | 'staff' | 'viewer'
type SuiteType = 'qa' | 'dev'
type Priority = 'critical' | 'high' | 'medium' | 'low'
type TestStatus = 'pass' | 'fail' | 'blocked' | 'not_tested'
type ProcessingStatus = 'pending' | 'in_progress' | 'dev_deployed' | 'resolved' | 'wont_fix'

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
}
```

---

## 권한 구조

| Role | 설명 | 주요 권한 |
|------|------|----------|
| `admin` | 관리자 | 모든 권한 + 사용자 관리 (AdminPage 접근) |
| `developer` | 개발자 | admin과 동일, **AdminPage 접근 불가** |
| `staff` | 스태프 (기본 가입 role) | 조회 + 처리상태 변경 |
| `viewer` | 뷰어 (레거시) | 조회만 |

**코드 내 권한 체크 패턴:**
```typescript
// TestCasesPage, HomePage
const isAdmin = user?.role === 'admin' || user?.role === 'developer'
const canEditStatus = user?.role === 'admin' || user?.role === 'developer'

// App.tsx — AdminPage 라우트 가드
if (user.role !== 'admin') return <Navigate to="/" replace />
```

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
pending → in_progress → dev_deployed → resolved
                                     → wont_fix
```

| 값 | 한국어 | 색상 |
|----|--------|------|
| `pending` | 미처리 | slate |
| `in_progress` | 처리중 | blue |
| `dev_deployed` | 개발배포 | violet |
| `resolved` | 처리완료 | emerald |
| `wont_fix` | 보류 | slate-400 |

---

## Firestore 컬렉션

- `products` — 제품 목록
- `suites` — 테스트 묶음 (productId로 필터)
- `testcases` — 테스트케이스 + 운영이슈 (suiteId로 필터)
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

## 현재 미배포 변경사항 (v1.0.19 예정)

1. **처리상태 `dev_deployed`(개발배포) 추가**
   - `src/types/index.ts` — ProcessingStatus 타입에 추가
   - `src/lib/constants.ts` — 레이블/색상 추가
   - `src/pages/TestCasesPage.tsx` — 모든 처리상태 Select에 옵션 추가 (5곳)

2. **권한 개편**
   - `UserRole`에 `staff` 추가
   - 가입 기본 role: `viewer` → `staff`
   - `developer` = admin과 동일 권한 (AdminPage 제외)
   - `AdminPage.tsx` — staff role 레이블/배지/선택지 추가
