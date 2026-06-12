import type { Priority, TestStatus, ProcessingStatus } from '@/types'

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
