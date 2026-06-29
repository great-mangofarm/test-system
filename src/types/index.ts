export type UserRole = 'admin' | 'pm' | 'developer' | 'staff'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  team: string
  jiraDisplayName?: string  // Jira에서 표시되는 이름 (다를 경우 매핑용)
  createdAt: string
}

export type SuiteType = 'qa' | 'dev'

export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type TestStatus = 'pass' | 'fail' | 'blocked' | 'not_tested'
export type ProcessingStatus = 'pending' | 'in_progress' | 'dev_deploy_waiting' | 'dev_deployed' | 'resolved' | 'wont_fix'

export interface Product {
  id: string
  name: string
  description: string
  jiraProjectKey: string
  areas: string[]
  order: number
  createdAt: string
  // 역할별 노출 제어: undefined = 전체 공개(하위호환). 배열이면 해당 역할만 조회 가능
  // (admin/developer는 항상 조회 가능)
  visibleRoles?: UserRole[]
}

export type DeployBatchStatus = 'planned' | 'deployed'

// QA 테스트 (배포예정 기능별 가벼운 체크) — 테스트케이스/운영이슈와 별개
export type QaStatus = 'pass' | 'block' | 'pending'

// 테스트케이스(qa) 묶음 내부의 티켓 단위 그룹
export interface CaseGroup {
  id: string
  suiteId: string
  productId: string
  jiraKey: string      // 예: APP-720
  title: string        // 티켓 제목
  ticketLink: string   // 전체 URL
  order: number
  createdAt: string
}

export interface QaGroup {
  id: string
  productId: string
  name: string
  deployDate?: string
  order: number
  createdAt: string
}

export interface QaCheck {
  id: string
  groupId: string
  productId: string
  title: string
  asIs: string
  toBe: string
  status: QaStatus
  order: number
  createdAt: string
}

export interface DeployBatch {
  id: string
  suiteId: string
  name: string
  deployDate: string   // YYYY-MM-DD (예정/배포일)
  status: DeployBatchStatus
  order: number
  createdAt: string
}

export interface TestSuite {
  id: string
  productId: string
  name: string
  version: string
  type: SuiteType
  order: number
  createdAt: string
  // 역할별 노출 제어: undefined = 전체 공개(하위호환). 배열이면 해당 역할만 조회 가능
  // (admin/developer는 항상 조회 가능)
  visibleRoles?: UserRole[]
}

export interface TestCase {
  id: string
  suiteId: string
  productId: string
  area: string
  title: string
  steps: string
  expectedResult: string
  actualResult: string
  status: TestStatus
  processingStatus: ProcessingStatus
  ticketLink: string
  developerNote: string
  images: string[]
  resultNote: string
  resultImages: string[]
  tester: string
  assignedDeveloper: string
  priority: Priority
  startDate: string
  dueDate: string
  planningLink: string
  order: number
  createdAt: string
  updatedAt: string
  // 이슈(개발요청) 전용 필드
  recordType?: 'testcase' | 'issue'  // undefined = testcase (하위호환)
  background?: string       // 개요 (프로젝트 배경/개발목적)
  requirements?: string     // 범위 및 요구사항
  figmaLink?: string        // 피그마 링크
  featureSpec?: string      // 기능/화면 정의
  devChangelog?: string     // 개발 변경 내역 (개발자 작성)
  testChecklist?: Array<{ text: string; checked: boolean }> // 테스트 체크리스트
  testProgressNote?: string // 테스트 진행사항
  deployBatchId?: string    // 배포묶음 ID (운영이슈 전용)
  groupId?: string          // 티켓 그룹 ID (테스트케이스 전용)
}
