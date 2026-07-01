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
  CheckCircle2, Circle, ExternalLink, Inbox,
} from 'lucide-react'

const empty = { title: '', background: '', content: '', desiredDueDate: '', policyDocUrl: '' }

interface DraftPayload {
  title: string
  dueDate: string
  policyUrl: string
  background: string
  requestContent: string
}

// 선택한 요청들을 다우 기안 양식 필드로 구성.
// 1건이면 각 칸에 그대로, 여러 건이면 요청내용/배경 칸에 번호로 묶어 넣는다(단일칸 정보는 본문에 포함).
function buildDraftPayload(reqs: DevRequest[]): DraftPayload {
  if (reqs.length === 1) {
    const r = reqs[0]
    return {
      title: r.title,
      dueDate: r.desiredDueDate ?? '',
      policyUrl: r.policyDocUrl ?? '',
      background: r.background ?? '',
      requestContent: r.content ?? '',
    }
  }
  const background = reqs
    .map((r, i) => `${i + 1}. ${r.title}\n${r.background || '-'}`)
    .join('\n\n')
  const requestContent = reqs
    .map((r, i) => {
      const meta = [
        r.desiredDueDate ? `희망 완료일: ${r.desiredDueDate}` : '',
        r.policyDocUrl ? `정책문서: ${r.policyDocUrl}` : '',
        `요청자: ${r.createdByName}`,
      ]
        .filter(Boolean)
        .join(' / ')
      return `${i + 1}. ${r.title}\n${r.content || '-'}\n(${meta})`
    })
    .join('\n\n')
  return {
    title: `개발요청 ${reqs.length}건 - ${reqs[0].title} 외 ${reqs.length - 1}건`,
    dueDate: '',
    policyUrl: '',
    background,
    requestContent,
  }
}

export default function DevRequestsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<DevRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DevRequest | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<DevRequest | null>(null)
  const [pwModalOpen, setPwModalOpen] = useState(false)

  const isManager = user?.role === 'admin' || user?.role === 'pm' // 완료 토글
  const canGoHome = user && user.role !== 'staff'                  // 메인 이동(스태프 외)

  async function load() {
    setLoading(true)
    setRequests(await getDevRequests())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setFormOpen(true)
  }
  function openEdit(r: DevRequest) {
    setEditing(r)
    setForm({
      title: r.title, background: r.background, content: r.content,
      desiredDueDate: r.desiredDueDate ?? '', policyDocUrl: r.policyDocUrl ?? '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!user) return
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: '제목과 요청 내용은 필수입니다', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const data = {
        title: form.title.trim(),
        background: form.background.trim(),
        content: form.content.trim(),
        desiredDueDate: form.desiredDueDate.trim(),
        policyDocUrl: form.policyDocUrl.trim(),
      }
      if (editing) {
        await updateDevRequest(editing.id, data)
        toast({ title: '요청 수정 완료' })
      } else {
        await createDevRequest({
          ...data,
          createdBy: user.uid,
          createdByName: user.displayName,
          team: user.team ?? '',
          done: false,
        })
        toast({ title: '요청 추가 완료' })
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

  async function handleSend() {
    const chosen = requests.filter((r) => selected.has(r.id))
    if (chosen.length === 0) return
    // 팝업 차단 방지: 클릭 제스처 내에서 빈 창을 먼저 연 뒤 URL을 채운다
    const win = window.open('', '_blank')
    setSending(true)
    try {
      const payload = buildDraftPayload(chosen)
      const res = await authedFetch('/api/daou-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error || '기안 생성 실패')
      }
      // 그룹웨어 기안 작성 팝업 (로그인된 사용자가 기안자)
      if (win) win.location.href = data.url
      else window.open(data.url, '_blank', 'noopener,noreferrer')
      toast({ title: '기안 작성 창을 열었습니다', description: '그룹웨어에서 결재선 확인 후 상신하세요' })
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
          요청을 작성하고, 여러 건을 선택해 하나의 기안으로 전송하세요.
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <span className="text-sm text-slate-600">{selectedCount}건 선택</span>
          )}
          <Button
            variant="default"
            size="sm"
            disabled={selectedCount === 0 || sending}
            onClick={handleSend}
          >
            <Send className="w-4 h-4" /> {sending ? '전송 중…' : '기안 보내기'}
          </Button>
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4" /> 요청 추가
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
              아직 요청이 없습니다. "요청 추가"로 시작하세요.
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
                    {r.content && (
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{r.content}</p>
                    )}
                    {r.background && (
                      <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">
                        <span className="text-slate-400">배경 · </span>{r.background}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
                      <span>{r.createdByName}{r.team ? ` · ${r.team}` : ''}</span>
                      {r.desiredDueDate && <span>희망완료 {r.desiredDueDate}</span>}
                      {r.policyDocUrl && (
                        <a
                          href={r.policyDocUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sky-600 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> 정책문서
                        </a>
                      )}
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

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '요청 수정' : '요청 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>제목 *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="요청 제목" />
            </div>
            <div>
              <Label>요청 내용 *</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} placeholder="무엇을 개발/수정해야 하나요?" />
            </div>
            <div>
              <Label>요청 배경</Label>
              <Textarea value={form.background} onChange={(e) => setForm({ ...form, background: e.target.value })} rows={2} placeholder="왜 필요한가요? (선택)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>희망 완료일</Label>
                <Input type="date" value={form.desiredDueDate} onChange={(e) => setForm({ ...form, desiredDueDate: e.target.value })} />
              </div>
              <div>
                <Label>정책문서 링크</Label>
                <Input value={form.policyDocUrl} onChange={(e) => setForm({ ...form, policyDocUrl: e.target.value })} placeholder="https://…" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>요청을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.title}" 요청이 삭제됩니다. 되돌릴 수 없습니다.</AlertDialogDescription>
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
