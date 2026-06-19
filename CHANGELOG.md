# 변경 이력 (CHANGELOG)

이슈트래커의 버전별 변경 내용과, **다음 작업 때 확인해야 할 것**을 정리한 문서입니다.
(배포는 `git push` → Vercel 자동. 버전 문자열은 `src/main.tsx`의 console.log)

---

## 🔭 다음에 볼 때 — 미해결 / 확인 사항

작업 재개 시 여기부터 확인하세요.

### 확인 필요 (검증 안 된 가정)
- [ ] **Jira 우선순위 "높음"** — `api/jira.ts`의 `PRIORITY_MAP`에서 `high: 'High'`로 매핑함(가정). 실제로 높음 이슈 등록 후 Jira에서 **High로 뜨는지 확인**. 다르면 그 한 줄만 조정. (긴급=Hotfix, 보통=Medium, 낮음=Low는 검증됨)

### 선택적 보안 강화
- [ ] **`JIRA_WEBHOOK_SECRET`** — 설정하면 webhook 위조 차단. Vercel 환경변수 추가 + Jira webhook URL에 `?token=...` 추가 시 적용. 미설정 시 현재처럼 동작(안 깨짐). 코드는 `api/jira-webhook.ts`에 이미 반영됨.
- [ ] **Firestore 규칙 게시 습관** — `firestore.rules`는 저장소 기록용. **변경 시 Firebase 콘솔 → Firestore → 규칙에 붙여넣고 게시**해야 실제 적용됨 (Vercel 배포로는 반영 안 됨).

### 코드리뷰 잔여 (낮은 우선순위, 급하지 않음)
- [ ] 리스트 `key={idx}`/`key={i}` → 안정 key로 (체크리스트·이미지 삭제 시 DOM 오매칭)
- [ ] `getSuiteStats`가 `getTestCases`와 같은 컬렉션 2번 읽음 → 한 번 읽어 계산
- [ ] `getTestCases` 정렬 `a.order - b.order` → `(a.order ?? 0)` 가드
- [ ] `register()`가 `team` 미기록인데 타입은 필수 → `team?:` 또는 `team:''`
- [ ] `testcases`/`users` 페이지네이션 없음 (수백건 누적 시 부담)
- [ ] `deleteAccountOpen` 다이얼로그는 트리거 버튼 없음(데드 UI) — 의도 확인

### 큰 미완 과제
- [ ] **다우오피스 전자결재 연동** (스태프 개발요청서 자동 기안) — **유료 옵션**이라 결정 대기. 자세한 조사 내용:
  - 엔드포인트 `POST https://api.daouoffice.com/public/v4/approval/document/popup` (multipart, clientId/secret 직접 전달)
  - 양식 "소프트웨어 개발 요청서" formId = `1508678637233328128` (code 비어있음 → 숫자 id 사용)
  - 외부 API 기안 가능 양식은 다우 측에서 별도 활성화 필요(유료)
  - 본문 자동삽입은 popup API(유료) 외 무료 우회 불가
  - 미정: formId vs formCode 파라미터명, 팀별 고정결재선 처리, 이미지(본문 URL vs attaches)

---

## 버전 이력

### v1.0.35 — 정리
생성폼(IssueForm/TestCaseForm) 처리상태에 개발배포대기·개발배포 옵션 추가 · TestCasesPage 도달 불가 코드 250줄 삭제 · 문서(CLAUDE/README/CHANGELOG) 갱신.

### v1.0.34 — 에디터 이미지 + 등록 시 배포묶음
`RichTextEditor` 이미지 붙여넣기/드래그/버튼 업로드(Cloudinary, `@tiptap/extension-image`) · 이슈 등록 폼에서 배포묶음 선택.

### v1.0.33 — Jira 우선순위 수정
`high`가 `critical`과 같이 'Hotfix'로 가던 버그 → 'High'.

### v1.0.32 — API 인증 가드
모든 `/api/jira*`에 Firebase ID 토큰 검증 + admin·developer role 가드(`api/lib/auth.ts`) · 프론트 `authedFetch`(`src/lib/api.ts`) · `jira-fields.ts` 삭제 · webhook 시크릿 옵션. (프리뷰 검증 후 배포)

### v1.0.31 — 자동갱신/쓰기 안정화
편집 중(인라인/드로어)엔 60초 자동갱신·포커스갱신 스킵 → 입력 덮어쓰기 방지 · 인터벌은 testcases/deployBatches만 갱신 · `ignoreUndefinedProperties`.

### v1.0.30 — 등록 폼 레이아웃
IssueForm 좌/우 컬럼 `min-w-0` · RichTextEditor `break-words` → 긴 링크에 레이아웃 깨짐/가로스크롤 수정.

### v1.0.29 — 개발배포대기 추가
처리상태에 `dev_deploy_waiting`(처리중↔개발배포 사이).

### v1.0.28 — 배포묶음(Deploy Batch)
`deployBatches` 컬렉션 · 운영이슈를 배포 단위로 그룹핑 · 목록 그룹 헤더 · 상태(예정/완료) 토글.

### v1.0.27 — 개발 변경 내역 저장
타이핑마다 저장+60초 갱신 race로 되돌아가던 문제 → blur 시 1회 저장(`RichTextEditor` onBlur).

### v1.0.26 — 에디터 IME 회귀 수정
`value` 동기화가 한글 조합 중 setContent를 호출해 자음 씹힘/중복 → `editor.isFocused`면 동기화 스킵.

### v1.0.25 — 운영이슈 통계 처리완료 기준
dev 묶음은 통과율이 아닌 **처리완료(resolved)** 기준으로 도넛/진행바/영역 계산 (목록·상세 모두).

### v1.0.24 — 프로덕트 관리 admin 전용
HomePage 프로덕트 생성/수정/삭제/정렬도 admin 전용(`canManageProduct`) · `firestore.rules` 저장소 기록.

### v1.0.23 — 사용자관리 버튼 admin 전용
헤더 "사용자 관리"를 `role==='admin'`에서만 노출(기존 developer에게도 보였음).

### v1.0.22 — 권한/UI 개선
묶음 생성/수정/삭제/정렬 admin 전용(`canManageSuite`) · 묶음 카드 처리 아이콘 상시 노출 · 숨김 표시를 실제 토글 스위치로 · 등록 안내 '뷰어'→'스태프' · 로그인 유지 체크박스 커스텀화.

### v1.0.21 — viewer 폐지 + 개인 숨김
`UserRole`에서 viewer 제거(staff 통합, AdminPage에서 자동 이관) · 묶음 사용자별 숨김(localStorage).

### v1.0.20 — 역할별 노출 제어
Product/TestSuite에 `visibleRoles` · 수정 다이얼로그 노출 권한 · HomePage 필터 + 딥링크 가드.

### v1.0.19 — 처리상태/권한 개편 (이전 작업)
`dev_deployed` 추가 · `staff` 역할 신설(기본 가입) · developer=admin급(AdminPage 제외) · 완료이슈 숨기기 조건 · CLAUDE.md 추가.

### 보안 (별도 커밋)
- Firestore `users` 규칙에서 본인 `role/uid/email` 변경 차단(권한 승격 방지) — **콘솔 게시 완료**.
