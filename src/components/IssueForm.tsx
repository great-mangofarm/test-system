import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RichTextEditor } from '@/components/RichTextEditor'
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, X } from 'lucide-react'
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
  testChecklistItems: string[]
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
  testChecklistItems: [],
  testProgressNote: '',
}

export function IssueForm({ initial, users = [], areas, jiraProjectKey, onSave, onCancel }: Props) {
  const [form, setForm] = useState<IssueFormData>({ ...defaultForm, ...initial })
  const [saving, setSaving] = useState(false)
  const [jiraIssueType, setJiraIssueType] = useState('스토리')
  const addBtnRef = useRef<HTMLButtonElement>(null)

  function set<K extends keyof IssueFormData>(key: K, value: IssueFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function addChecklistItem() {
    set('testChecklistItems', [...form.testChecklistItems, ''])
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('[data-checklist-item]')
      inputs[inputs.length - 1]?.focus()
    }, 50)
  }

  function updateChecklistItem(idx: number, value: string) {
    set('testChecklistItems', form.testChecklistItems.map((item, i) => (i === idx ? value : item)))
  }

  function removeChecklistItem(idx: number) {
    set('testChecklistItems', form.testChecklistItems.filter((_, i) => i !== idx))
  }

  function handleChecklistKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const updated = [...form.testChecklistItems]
      updated.splice(idx + 1, 0, '')
      set('testChecklistItems', updated)
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('[data-checklist-item]')
        inputs[idx + 1]?.focus()
      }, 50)
    }
    if (e.key === 'Backspace' && form.testChecklistItems[idx] === '' && form.testChecklistItems.length > 1) {
      e.preventDefault()
      removeChecklistItem(idx)
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('[data-checklist-item]')
        inputs[Math.max(0, idx - 1)]?.focus()
      }, 50)
    }
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
    <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial?.title ? '개발요청 수정' : '새 개발요청 (운영 이슈)'}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-2">

        {/* 상단 메타 — 4컬럼 그리드 */}
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>제목 <span className="text-destructive">*</span></Label>
            <Input
              placeholder="예: 로그인 화면 UI 개선 요청"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>
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
              <Input placeholder="예: 로그인, 결제" value={form.area} onChange={(e) => set('area', e.target.value)} />
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
          <div className="space-y-1.5">
            <Label>처리 상태</Label>
            <Select value={form.processingStatus} onValueChange={(v) => set('processingStatus', v as ProcessingStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">미처리</SelectItem>
                <SelectItem value="in_progress">처리중</SelectItem>
                <SelectItem value="resolved">처리완료</SelectItem>
                <SelectItem value="wont_fix">보류</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

        {/* 하단 콘텐츠 — 좌/우 독립 컬럼 */}
        <div className="flex gap-6 items-start">

          {/* 왼쪽: 개요 + 기능/화면 정의 */}
          <div className="flex-1 space-y-4">
            <div className="space-y-1.5">
              <Label>개요 (프로젝트 배경 / 개발 목적)</Label>
              <RichTextEditor
                value={form.background}
                onChange={(v) => set('background', v)}
                placeholder="프로젝트 배경 및 이 요청의 목적을 설명해주세요"
                className="[&_.tiptap]:min-h-[160px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>기능 / 화면 정의</Label>
              <RichTextEditor
                value={form.featureSpec}
                onChange={(v) => set('featureSpec', v)}
                placeholder="화면 구성 및 기능 상세 정의를 입력해주세요"
                className="[&_.tiptap]:min-h-[200px]"
              />
            </div>
          </div>

          {/* 오른쪽: 범위및요구사항 + 체크리스트 */}
          <div className="flex-1 space-y-4">
            <div className="space-y-1.5">
              <Label>범위 및 요구사항</Label>
              <RichTextEditor
                value={form.requirements}
                onChange={(v) => set('requirements', v)}
                placeholder="요구사항과 범위를 입력하세요 (목록 사용 가능)"
                className="[&_.tiptap]:min-h-[160px]"
              />
            </div>
            <div className="space-y-2">
              <Label>테스트 체크리스트</Label>
              {form.testChecklistItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-slate-300 text-sm select-none w-5 text-right shrink-0">{idx + 1}.</span>
                  <Input
                    data-checklist-item
                    className="h-8 text-sm flex-1"
                    placeholder="테스트 항목 입력"
                    value={item}
                    onChange={(e) => updateChecklistItem(idx, e.target.value)}
                    onKeyDown={(e) => handleChecklistKeyDown(e, idx)}
                  />
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(idx)}
                    className="shrink-0 text-slate-300 hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs text-slate-500 border-dashed w-full"
                onClick={addChecklistItem}
                ref={addBtnRef}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />항목 추가
              </Button>
              {form.testChecklistItems.length > 0 && (
                <p className="text-xs text-slate-400">Enter로 다음 항목 · 빈 항목에서 Backspace로 삭제</p>
              )}
            </div>
          </div>

        </div>

        {/* 하단: 피그마링크 | Jira 업무유형 */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label>피그마 링크</Label>
            <Input
              placeholder="https://www.figma.com/..."
              value={form.figmaLink}
              onChange={(e) => set('figmaLink', e.target.value)}
            />
          </div>
          {jiraProjectKey ? (
            <div className="space-y-1.5">
              <Label>Jira 업무유형</Label>
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
              <p className="text-xs text-slate-400 pt-0.5">담당자는 담당개발자 계정으로 자동 연결됩니다</p>
            </div>
          ) : <div />}
        </div>

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
