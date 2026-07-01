import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { ChangePasswordModal } from '@/components/ChangePasswordModal'
import {
  getDevRequests, createDevRequest, updateDevRequest, deleteDevRequest,
} from '@/lib/firestore'
import { authedFetch } from '@/lib/api'
import { useAuth, logout } from '@/store/auth'
import { toast } from '@/hooks/use-toast'
import type { DevRequest } from '@/types'
import {
  Plus, Send, Pencil, Trash2, LogOut, KeyRound, ChevronDown, ArrowLeft,
  CheckCircle2, Circle, Inbox, ArrowRight,
} from 'lucide-react'

const emptyItem = { title: '', asIs: '', toBe: '' }
const emptySend = { title: '', dueDate: '', background: '', docUrl: '' }

// 선택 항목들을 기안 요청내용 텍스트로 구성 (다우 쪽에서 개행→<br>, URL→링크 처리됨)
function buildRequestContent(items: DevRequest[]): string {
  return items
    .map((it, i) => `${i + 1}. ${it.title}\n[AS-IS] ${it.asIs || '-'}\n[TO-BE] ${it.toBe || '-'}`)
    .join('\n\n')
}

export default function DevRequestsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<DevRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DevRequest | null>(null)
  const [form, setForm] = useState(emptyItem)
  const [saving, setSaving] = useState(false)

  const [sendOpen, setSendOpen] = useState(false)
  const [sendForm, setSendForm] = useState(emptySend)
  const [sending, setSending] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<DevRequest | null>(null)
  const [pwModalOpen, setPwModalOpen] = useState(false)

  const isManager = user?.role === 'admin' || user?.role === 'pm' // 완료 토글
  const canGoHome = user && user.role !== 'staff'

  async function load() {
    setLoading(true)
    setRequests(await getDevRequests())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm(emptyItem)
    setFormOpen(true)
  }
  function openEdit(r: DevRequest) {
    setEditing(r)
    setForm({ title: r.title, asIs: r.asIs, toBe: r.toBe })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!user) return
    if (!form.title.trim() || !form.toBe.trim()) {
      toast({ title: '제목과 TO-BE(요청 내용)는 필수입니다', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const data = { title: form.title.trim(), asIs: form.asIs.trim(), toBe: form.toBe.trim() }
      if (editing) {
        await updateDevRequest(editing.id, data)
        toast({ title: '항목 수정 완료' })
      } else {
        await createDevRequest({
          ...data,
          createdBy: user.uid,
          createdByName: user.displayName,
          team: user.team ?? '',
          done: false,
        })
        toast({ title: '항목 추가 완료' })
      }
      setFormOpen(false)
      await load()
    } catch (e) {
      toast({ title: '저장 실패', description: String((e as Error).message), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteDevRequest(deleteTarget.id)
    setSelected((s) => { const n = new Set(s); n.delete(deleteTarget.id); return n })
    setDeleteTarget(null)
    toast({ title: '삭제됨', variant: 'destructive' })
    await load()
  }

  async function toggleDone(r: DevRequest, done: boolean) {
    await updateDevRequest(r.id, { done })
    setRequests((rs) => rs.map((x) => (x.id === r.id ? { ...x, done } : x)))
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function openSend() {
    const count = selected.size
    if (count === 0) return
    setSendForm({ ...emptySend, title: `개발 요청 ${count}건` })
    setSendOpen(true)
  }

  async function confirmSend() {
    const chosen = requests.filter((r) => selected.has(r.id))
    if (chosen.length === 0) return
    if (!sendForm.title.trim()) {
      toast({ title: '기안 제목을 입력하세요', variant: 'destructive' })
      return
    }
    // 팝업 차단 방지: 클릭 제스처 내에서 빈 창 먼저 오픈
    const win = window.open('', '_blank')
    setSending(true)
    try {
      const payload = {
        title: sendForm.title.trim(),
        dueDate: sendForm.dueDate.trim(),
        policyUrl: sendForm.docUrl.trim(),
        background: sendForm.background.trim(),
        requestContent: buildRequestContent(chosen),
      }
      const res = await authedFetch('/api/daou-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || '기안 생성 실패')
      if (win) win.location.href = data.url
      else window.open(data.url, '_blank', 'noopener,noreferrer')
      toast({ title: '기안 작성 창을 열었습니다', description: '그룹웨어에서 결재선 확인 후 상신하세요' })
      setSendOpen(false)
      setSelected(new Set())
    } catch (e) {
      if (win) win.close()
      toast({ title: '기안 전송 실패', description: String((e as Error).message), variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const selectedCount = selected.size

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {canGoHome && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" /> 메인
            </Button>
          )}
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Inbox className="w-5 h-5 text-sky-600" /> 개발요청
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {user?.displayName} <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPwModalOpen(true)}>
                <KeyRound className="w-4 h-4" /> 비밀번호 변경
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} className="text-destructive">
                <LogOut className="w-4 h-4" /> 로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="text-sm text-slate-500">
          개발 요청 항목(AS-IS → TO-BE)을 쌓아두고, 여러 개를 선택해 하나의 기안으로 전송하세요.
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && <span className="text-sm text-slate-600">{selectedCount}건 선택</span>}
          <Button variant="default" size="sm" disabled={selectedCount === 0} onClick={openSend}>
            <Send className="w-4 h-4" /> 기안 보내기
          </Button>
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4" /> 항목 추가
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {loading ? (
            <div className="text-center text-slate-400 py-20">불러오는 중…</div>
          ) : requests.length === 0 ? (
            <div className="text-center text-slate-400 py-20">
              아직 항목이 없습니다. "항목 추가"로 시작하세요.
            </div>
          ) : (
            requests.map((r) => {
              const canEdit = user && (r.createdBy === user.uid || isManager)
              return (
                <div
                  key={r.id}
                  className={`bg-white border rounded-lg p-4 flex gap-3 ${r.done ? 'opacity-70' : ''}`}
                >
                  <div className="pt-1">
                    <Checkbox checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.done && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 개발완료
                        </span>
                      )}
                      <span className="font-semibold text-slate-800">{r.title}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm">
                      <div className="flex gap-2">
                        <span className="shrink-0 text-xs font-semibold text-slate-400 mt-0.5 w-12">AS-IS</span>
                        <span className="text-slate-600 whitespace-pre-wrap">{r.asIs || '-'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="shrink-0 text-xs font-semibold text-sky-500 mt-0.5 w-12 inline-flex items-center gap-0.5"><ArrowRight className="w-3 h-3" />TO-BE</span>
                        <span className="text-slate-800 whitespace-pre-wrap">{r.toBe || '-'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                      <span>{r.createdByName}{r.team ? ` · ${r.team}` : ''}</span>
                      <span>{new Date(r.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {isManager && (
                      <label className="flex items-center gap-1.5 text-xs text-slate-500">
                        {r.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Circle className="w-3.5 h-3.5" />}
                        <Switch checked={r.done} onChange={(v) => toggleDone(r, v)} aria-label="개발완료 토글" />
                      </label>
                    )}
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(r)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 항목 추가/수정 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '항목 수정' : '항목 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>제목 *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 법인회원 카드 발급 자동화" />
            </div>
            <div>
              <Label>AS-IS (현재)</Label>
              <Textarea value={form.asIs} onChange={(e) => setForm({ ...form, asIs: e.target.value })} rows={2} placeholder="현재 어떻게 동작/처리되는지" />
            </div>
            <div>
              <Label>TO-BE (요청 내용) *</Label>
              <Textarea value={form.toBe} onChange={(e) => setForm({ ...form, toBe: e.target.value })} rows={3} placeholder="어떻게 바뀌어야 하는지" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 기안 보내기 */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>기안 보내기 ({selectedCount}건)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>기안 제목 *</Label>
              <Input value={sendForm.title} onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>희망 완료일</Label>
                <Input type="date" value={sendForm.dueDate} onChange={(e) => setSendForm({ ...sendForm, dueDate: e.target.value })} />
              </div>
              <div>
                <Label>요청 문서 URL</Label>
                <Input value={sendForm.docUrl} onChange={(e) => setSendForm({ ...sendForm, docUrl: e.target.value })} placeholder="https://…" />
              </div>
            </div>
            <div>
              <Label>요청 배경</Label>
              <Textarea value={sendForm.background} onChange={(e) => setSendForm({ ...sendForm, background: e.target.value })} rows={2} placeholder="이번 요청들의 공통 배경 (선택)" />
            </div>
            <div className="rounded-md bg-slate-50 border p-2 text-xs text-slate-500 max-h-32 overflow-auto whitespace-pre-wrap">
              {buildRequestContent(requests.filter((r) => selected.has(r.id)))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>취소</Button>
            <Button onClick={confirmSend} disabled={sending}>{sending ? '전송 중…' : '기안 작성 창 열기'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>항목을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.title}" 항목이 삭제됩니다. 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pwModalOpen && <ChangePasswordModal onClose={() => setPwModalOpen(false)} />}
    </div>
  )
}
