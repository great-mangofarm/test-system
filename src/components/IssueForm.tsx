import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RichTextEditor } from '@/components/RichTextEditor'
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Priority, ProcessingStatus, UserProfile } from '@/types'

export type IssueFormData = {
  area: string
  title: string
  priority: Priority
  assignedDeveloper: string
  processingStatus: ProcessingStatus
  ticketLink: string
  startDate: string
  dueDate: string
  background: string
  requirements: string
  figmaLink: string
  featureSpec: string
  devChangelog: string
  testProgressNote: string
}

interface Props {
  suiteId: string
  initial?: Partial<IssueFormData>
  users?: UserProfile[]
  areas?: string[]
  jiraProjectKey?: string
  currentUserDisplayName?: string
  onSave: (data: IssueFormData, jiraFields: { issueType: string }) => Promise<void>
  onCancel: () => void
}

const defaultForm: IssueFormData = {
  area: '',
  title: '',
  priority: 'medium',
  assignedDeveloper: '',
  processingStatus: 'pending',
  ticketLink: '',
  startDate: '',
  dueDate: '',
  background: '',
  requirements: '',
  figmaLink: '',
  featureSpec: '',
  devChangelog: '',
  testProgressNote: '',
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  )
}

export function IssueForm({ initial, users = [], areas, jiraProjectKey, onSave, onCancel }: Props) {
  const [form, setForm] = useState<IssueFormData>({ ...defaultForm, ...initial })
  const [saving, setSaving] = useState(false)
  const [jiraIssueType, setJiraIssueType] = useState('스토리')

  function set<K extends keyof IssueFormData>(key: K, value: IssueFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave(form, { issueType: jiraIssueType })
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial?.title ? '개발요청 수정' : '새 개발요청 (운영 이슈)'}</DialogTitle>
      </DialogHeader>

      <div className="space-y-5 py-2">

        {/* ── 기본 정보 ── */}
        <SectionHeader>기본 정보</SectionHeader>

        <div className="space-y-1.5">
          <Label>제목 <span className="text-destructive">*</span></Label>
          <Input
            placeholder="예: 로그인 화면 UI 개선 요청"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>영역 / 기능</Label>
            {areas && areas.length > 0 ? (
              <Select value={form.area || '__none__'} onValueChange={(v) => set('area', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="예: 로그인, 결제"
                value={form.area}
                onChange={(e) => set('area', e.target.value)}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>우선순위</Label>
            <Select value={form.priority} onValueChange={(v) => set('priority', v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">긴급</SelectItem>
                <SelectItem value="high">높음</SelectItem>
                <SelectItem value="medium">보통</SelectItem>
                <SelectItem value="low">낮음</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>담당 개발자</Label>
            {users.length > 0 ? (
              <Select value={form.assignedDeveloper || '__none__'} onValueChange={(v) => set('assignedDeveloper', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {users.map((u) => <SelectItem key={u.uid} value={u.displayName}>{u.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input placeholder="이름" value={form.assignedDeveloper} onChange={(e) => set('assignedDeveloper', e.target.value)} />
            )}
          </div>
        </div>

        {/* ── 일정 ── */}
        <SectionHeader>일정</SectionHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>시작일</Label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
              className="h-9 w-full px-3 text-sm border rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label>기한</Label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
              className="h-9 w-full px-3 text-sm border rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* ── 개요 ── */}
        <SectionHeader>개요</SectionHeader>

        <div className="space-y-1.5">
          <Label>개요 (프로젝트 배경 / 개발 목적)</Label>
          <RichTextEditor
            value={form.background}
            onChange={(v) => set('background', v)}
            placeholder="프로젝트 배경 및 이 요청의 목적을 설명해주세요"
          />
        </div>

        {/* ── 범위 및 요구사항 ── */}
        <SectionHeader>범위 및 요구사항</SectionHeader>

        <div className="space-y-1.5">
          <Label>범위 및 요구사항</Label>
          <RichTextEditor
            value={form.requirements}
            onChange={(v) => set('requirements', v)}
            placeholder="요구사항과 범위를 입력하세요 (목록 사용 가능)"
          />
        </div>

        {/* ── 기능/화면 정의 ── */}
        <SectionHeader>기능 / 화면 정의</SectionHeader>

        <div className="space-y-1.5">
          <Label>피그마 링크</Label>
          <Input
            placeholder="https://www.figma.com/..."
            value={form.figmaLink}
            onChange={(e) => set('figmaLink', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>기능 / 화면 정의</Label>
          <RichTextEditor
            value={form.featureSpec}
            onChange={(v) => set('featureSpec', v)}
            placeholder="화면 구성 및 기능 상세 정의를 입력해주세요"
          />
        </div>

        {/* ── Jira 연동 ── */}
        {jiraProjectKey && (
          <>
            <SectionHeader>Jira 연동</SectionHeader>
            <div className="space-y-1.5">
              <Label>업무유형</Label>
              <Select value={jiraIssueType} onValueChange={setJiraIssueType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="버그">버그</SelectItem>
                  <SelectItem value="에픽">에픽</SelectItem>
                  <SelectItem value="스토리">스토리</SelectItem>
                  <SelectItem value="작업">작업</SelectItem>
                  <SelectItem value="하위 작업">하위 작업</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-slate-400">담당자는 담당개발자 계정으로 자동 연결됩니다</p>
          </>
        )}

      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>취소</Button>
        <Button onClick={handleSave} disabled={!form.title.trim() || saving}>
          {saving ? '저장 중...' : '등록'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
