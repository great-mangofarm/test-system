import type { Priority, TestStatus, ProcessingStatus, UserRole } from '@/types'

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  developer: '개발자',
  staff: '스태프',
  viewer: '뷰어',
}

// 노출 제어 대상 역할 (admin/developer는 항상 조회 가능하므로 제외)
export const VIEW_CONTROL_ROLES: UserRole[] = ['staff', 'viewer']

// 주어진 visibleRoles 설정에서 해당 역할이 항목을 볼 수 있는지 판단
// - admin/developer: 항상 true (관리·편집 목적)
// - visibleRoles 미설정(undefined): 전체 공개 (하위호환)
// - 그 외: 배열에 역할이 포함될 때만 true
export function canViewByRole(visibleRoles: UserRole[] | undefined, role: UserRole | undefined): boolean {
  if (role === 'admin' || role === 'developer') return true
  if (!visibleRoles) return true
  if (!role) return false
  return visibleRoles.includes(role)
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: '긴급',
  high: '높음',
  medium: '보통',
  low: '낮음',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-400 text-yellow-900',
  low: 'bg-slate-200 text-slate-600',
}

export const TEST_STATUS_LABELS: Record<TestStatus, string> = {
  pass: '통과',
  fail: '실패',
  blocked: '블로킹',
  not_tested: '미테스트',
}

export const TEST_STATUS_COLORS: Record<TestStatus, string> = {
  pass: 'bg-green-600 text-white',
  fail: 'bg-red-600 text-white',
  blocked: 'bg-orange-500 text-white',
  not_tested: 'bg-slate-200 text-slate-600',
}

export const PROCESSING_STATUS_LABELS: Record<ProcessingStatus, string> = {
  pending: '미처리',
  in_progress: '처리중',
  dev_deployed: '개발배포',
  resolved: '처리완료',
  wont_fix: '보류',
}

export const PROCESSING_STATUS_COLORS: Record<ProcessingStatus, string> = {
  pending: 'bg-slate-200 text-slate-600',
  in_progress: 'bg-blue-600 text-white',
  dev_deployed: 'bg-violet-500 text-white',
  resolved: 'bg-emerald-600 text-white',
  wont_fix: 'bg-slate-400 text-white',
}
