import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { uploadImage } from '@/lib/firestore'
import type { TestCase, Priority, TestStatus, ProcessingStatus, UserProfile } from '@/types'
import { ImagePlus, X, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type FormData = Omit<TestCase, 'id' | 'suiteId' | 'productId' | 'createdAt' | 'updatedAt' | 'order'>

export type JiraFields = {
  issueType: string
  assigneeAccountId: string
}

interface Props {
  suiteId: string
  initial?: Partial<FormData>
  users?: UserProfile[]
  jiraProjectKey?: string
  currentUserEmail?: string
  onSave: (data: FormData, jiraFields: JiraFields) => Promise<void>
  onCancel: () => void
}

const defaultForm: FormData = {
  area: '',
  title: '',
  steps: '',
  expectedResult: '',
  actualResult: '',
  status: 'not_tested',
  processingStatus: 'pending',
  ticketLink: '',
  developerNote: '',
  images: [],
  tester: '',
  assignedDeveloper: '',
  priority: 'medium',
  dueDate: '',
  planningLink: '',
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{children}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  )
}

export function TestCaseForm({ suiteId, initial, users = [], jiraProjectKey, onSave, onCancel }: Props) {
  const [form, setForm] = useState<FormData>({ ...defaultForm, ...initial })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Jira-only state (not persisted to FormData)
  const [jiraIssueType, setJiraIssueType] = useState('버그')
  const [jiraAssigneeAccountId, setJiraAssigneeAccountId] = useState('')
  const [jiraUsers, setJiraUsers] = useState<{ accountId: string; displayName: string }[]>([])

  useEffect(() => {
    if (jiraProjectKey) {
      fetch(`/api/jira-users?projectKey=${encodeURIComponent(jiraProjectKey)}`)
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setJiraUsers(Array.isArray(data) ? data : []))
        .catch(() => setJiraUsers([]))
    }
  }, [jiraProjectKey])

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    await uploadFiles(files)
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeImage(url: string) {
    set('images', form.images.filter((u) => u !== url))
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return
    setUploading(true)
    try {
      const urls = await Promise.all(files.map((f) => uploadImage(f)))
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }))
    } catch (e) {
      toast({ variant: 'destructive', title: '이미지 업로드 실패', description: String(e) })
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageFiles = items
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null)
      if (imageFiles.length) {
        e.preventDefault()
        uploadFiles(imageFiles)
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [suiteId])

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave(form, {
        issueType: jiraIssueType,
        assigneeAccountId: jiraAssigneeAccountId,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.title ? '테스트 케이스 수정' : '새 테스트 케이스'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* ── 기본 정보 ── */}
          <SectionHeader>기본 정보</SectionHeader>

          <div className="space-y-1.5">
            <Label>테스트 항목 제목 <span className="text-destructive">*</span></Label>
            <Input
              placeholder="예: 이메일 로그인 정상 동작 확인"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>영역 / 기능</Label>
              <Input
                placeholder="예: 로그인, 결제"
                value={form.area}
                onChange={(e) => set('area', e.target.value)}
              />
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
              <Label>티켓 링크</Label>
              <Input
                placeholder="https://..."
                value={form.ticketLink}
                onChange={(e) => set('ticketLink', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>테스터</Label>
              {users.length > 0 ? (
                <Select value={form.tester || '__none__'} onValueChange={(v) => set('tester', v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {users.map((u) => <SelectItem key={u.uid} value={u.displayName}>{u.displayName}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="이름" value={form.tester} onChange={(e) => set('tester', e.target.value)} />
              )}
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

          {/* ── 기한 ── */}
          <SectionHeader>기한</SectionHeader>

          <div className="space-y-1.5">
            <Label>기한</Label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
              className="h-9 w-full px-3 text-sm border rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* ── 테스트 내용 ── */}
          <SectionHeader>테스트 내용</SectionHeader>

          <div className="space-y-1.5">
            <Label>테스트 절차</Label>
            <Textarea
              placeholder={"1. 앱 실행\n2. 이메일/비밀번호 입력\n3. 로그인 버튼 클릭"}
              value={form.steps}
              onChange={(e) => set('steps', e.target.value)}
              rows={4}
              className="resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>기대 결과</Label>
              <Textarea
                placeholder="정상 로그인되어 홈 화면으로 이동"
                value={form.expectedResult}
                onChange={(e) => set('expectedResult', e.target.value)}
                rows={3}
                className="resize-y"
              />
            </div>
            <div className="space-y-1.5">
              <Label>실제 결과</Label>
              <Textarea
                placeholder="발생한 실제 동작 또는 버그 설명"
                value={form.actualResult}
                onChange={(e) => set('actualResult', e.target.value)}
                rows={3}
                className="resize-y"
              />
            </div>
          </div>

          {/* ── 상태 ── */}
          <SectionHeader>상태</SectionHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>테스트 결과</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v as TestStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_tested">미테스트</SelectItem>
                  <SelectItem value="pass">통과</SelectItem>
                  <SelectItem value="fail">실패</SelectItem>
                  <SelectItem value="blocked">블로킹</SelectItem>
                </SelectContent>
              </Select>
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
          </div>

          <div className="space-y-1.5">
            <Label>개발자 메모</Label>
            <Textarea
              placeholder="처리 내용, 수정 사항 등"
              value={form.developerNote}
              onChange={(e) => set('developerNote', e.target.value)}
              rows={2}
              className="resize-y"
            />
          </div>

          {/* ── Jira 연동 ── */}
          {jiraProjectKey && (
            <>
              <SectionHeader>Jira 연동</SectionHeader>
              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-1.5">
                  <Label>담당자</Label>
                  <Select value={jiraAssigneeAccountId || '__none__'} onValueChange={(v) => setJiraAssigneeAccountId(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="선택 안함" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">선택 안함</SelectItem>
                      {jiraUsers.map((u) => (
                        <SelectItem key={u.accountId} value={u.accountId}>{u.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* ── 이미지 ── */}
          <SectionHeader>이미지 첨부</SectionHeader>

          <div>
            <p className="text-xs text-slate-400 mb-2">클릭하여 선택하거나 Ctrl+V로 붙여넣기</p>
            <div className="flex flex-wrap gap-2">
              {form.images.map((url) => (
                <div key={url} className="relative group">
                  <img
                    src={url}
                    className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                    onClick={() => setLightbox(url)}
                    alt=""
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-20 h-20 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                <span className="text-xs mt-1">{uploading ? '업로드중' : '추가'}</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>취소</Button>
          <Button onClick={handleSave} disabled={!form.title.trim() || saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} className="max-w-[90vw] max-h-[90vh] object-contain rounded" alt="" />
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  )
}
