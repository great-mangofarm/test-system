import type { Priority, TestStatus, ProcessingStatus } from '@/types'

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: '긴급',
  high: '높음',
  medium: '보통',
  low: '낮음',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-slate-100 text-slate-600',
}

export const TEST_STATUS_LABELS: Record<TestStatus, string> = {
  pass: '통과',
  fail: '실패',
  blocked: '블로킹',
  not_tested: '미테스트',
}

export const TEST_STATUS_COLORS: Record<TestStatus, string> = {
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
  blocked: 'bg-orange-100 text-orange-800',
  not_tested: 'bg-slate-100 text-slate-500',
}

export const PROCESSING_STATUS_LABELS: Record<ProcessingStatus, string> = {
  pending: '미처리',
  in_progress: '처리중',
  resolved: '처리완료',
  wont_fix: '보류',
}

export const PROCESSING_STATUS_COLORS: Record<ProcessingStatus, string> = {
  pending: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  wont_fix: 'bg-gray-100 text-gray-500',
}
