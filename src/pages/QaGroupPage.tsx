import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import {
  getQaGroups, getQaChecks, createQaCheck, updateQaCheck, deleteQaCheck,
} from '@/lib/firestore'
import type { QaGroup, QaCheck, QaStatus } from '@/types'
import { QA_STATUS_LABELS, QA_STATUS_COLORS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ChevronLeft, Plus, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function QaGroupPage() {
  const { productId, groupId } = useParams<{ productId: string; groupId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'pm' || user?.role === 'developer'

  const [group, setGroup] = useState<QaGroup | null>(null)
  const [checks, setChecks] = useState<QaCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<QaCheck | null>(null)

  useEffect(() => { load() }, [productId, groupId])

  async function load() {
    if (!productId || !groupId) return
    setLoading(true)
    try {
      const [groups, checksData] = await Promise.all([getQaGroups(productId), getQaChecks(groupId)])
      setGroup(groups.find((g) => g.id === groupId) ?? null)
      setChecks(checksData)
    } finally {
      setLoading(false)
    }
  }

  async function addCheck() {
    if (!productId || !groupId) return
    setAdding(true)
    try {
      const id = await createQaCheck({ groupId, productId, title: '', asIs: '', toBe: '', status: 'pending', order: checks.length })
      setChecks((prev) => [...prev, { id, groupId, productId, title: '', asIs: '', toBe: '', status: 'pending', order: prev.length, createdAt: new Date().toISOString() }])
    } finally {
      setAdding(false)
    }
  }

  // 로컬 상태 갱신(입력 중) — 저장은 blur/select에서
  function setField(id: string, key: 'title' | 'asIs' | 'toBe', value: string) {
    setChecks((prev) => prev.map((c) => c.id === id ? { ...c, [key]: value } : c))
  }
  async function saveField(id: string, key: 'title' | 'asIs' | 'toBe', value: string) {
    await updateQaCheck(id, { [key]: value })
  }
  async function setStatus(id: string, status: QaStatus) {
    setChecks((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
    await updateQaCheck(id, { status })
  }
  async function handleDelete() {
    if (!deleteTarget) return
    await deleteQaCheck(deleteTarget.id)
    setChecks((prev) => prev.filter((c) => c.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const total = checks.length
  const pass = checks.filter((c) => c.status === 'pass').length
  const block = checks.filter((c) => c.status === 'block').length
  const pending = checks.filter((c) => c.status === 'pending').length
  const passRate = total > 0 ? Math.round((pass / total) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-8 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-800">
              <ChevronLeft className="w-4 h-4" /> 목록으로
            </Button>
            <span className="text-slate-300">/</span>
            <span className="text-xs px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 font-medium">QA 테스트</span>
            <h1 className="text-lg font-bold text-slate-800 truncate">{group?.name ?? '...'}</h1>
            {group?.deployDate && <span className="text-xs text-slate-400">· {group.deployDate}</span>}
          </div>
          <Button variant="ghost" size="sm" onClick={load} className="text-slate-400 hover:text-slate-600" title="새로고침">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="bg-white border-b px-8 py-2.5 shrink-0">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-slate-500">전체 <strong className="text-slate-800">{total}</strong></span>
          <span className="text-green-700">통과 <strong>{pass}</strong></span>
          <span className="text-red-700">블록 <strong>{block}</strong></span>
          <span className="text-slate-500">미확인 <strong>{pending}</strong></span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-32 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${passRate}%` }} />
            </div>
            <span className="text-slate-600 font-medium text-sm">{passRate}%</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <main className="flex-1 overflow-auto px-8 py-5">
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-200 rounded animate-pulse" />)}</div>
        ) : !group ? (
          <div className="text-center py-24 text-slate-400">QA 테스트를 찾을 수 없습니다.</div>
        ) : (
          <div className="rounded-lg border border-slate-200 shadow-sm overflow-hidden bg-white">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr className="text-xs text-slate-600 font-semibold">
                  <th className="px-4 py-3 text-left w-10">#</th>
                  <th className="px-4 py-3 text-left w-56">항목명</th>
                  <th className="px-4 py-3 text-left">AS-IS</th>
                  <th className="px-4 py-3 text-left">TO-BE</th>
                  <th className="px-4 py-3 text-left w-28">상태</th>
                  {canEdit && <th className="px-4 py-3 text-center w-12"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {checks.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50 align-top">
                    <td className="px-4 py-2.5 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      {canEdit
                        ? <Input className="h-8 text-xs" placeholder="항목명" value={c.title}
                            onChange={(e) => setField(c.id, 'title', e.target.value)} onBlur={(e) => saveField(c.id, 'title', e.target.value)} />
                        : <span className="text-sm text-slate-700">{c.title || <span className="text-slate-300">—</span>}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {canEdit
                        ? <textarea className="w-full text-xs border rounded-md px-2 py-1.5 min-h-[36px] resize-y focus:outline-none focus:ring-1 focus:ring-primary" placeholder="현재(AS-IS)" value={c.asIs}
                            onChange={(e) => setField(c.id, 'asIs', e.target.value)} onBlur={(e) => saveField(c.id, 'asIs', e.target.value)} />
                        : <span className="text-sm text-slate-700 whitespace-pre-wrap">{c.asIs || <span className="text-slate-300">—</span>}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {canEdit
                        ? <textarea className="w-full text-xs border rounded-md px-2 py-1.5 min-h-[36px] resize-y focus:outline-none focus:ring-1 focus:ring-primary" placeholder="변경(TO-BE)" value={c.toBe}
                            onChange={(e) => setField(c.id, 'toBe', e.target.value)} onBlur={(e) => saveField(c.id, 'toBe', e.target.value)} />
                        : <span className="text-sm text-slate-700 whitespace-pre-wrap">{c.toBe || <span className="text-slate-300">—</span>}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {canEdit ? (
                        <Select value={c.status} onValueChange={(v) => setStatus(c.id, v as QaStatus)}>
                          <SelectTrigger className={cn('w-24 h-7 text-xs border-0 rounded-full font-medium px-2', QA_STATUS_COLORS[c.status])}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">미확인</SelectItem>
                            <SelectItem value="pass">통과</SelectItem>
                            <SelectItem value="block">블록</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn('text-xs px-2 py-1 rounded-full font-medium', QA_STATUS_COLORS[c.status])}>{QA_STATUS_LABELS[c.status]}</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2.5 text-center">
                        <button className="text-slate-300 hover:text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="w-4 h-4" /></button>
                      </td>
                    )}
                  </tr>
                ))}
                {checks.length === 0 && (
                  <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-10 text-center text-slate-400 text-sm">항목이 없습니다</td></tr>
                )}
              </tbody>
            </table>
            {canEdit && (
              <div className="border-t border-slate-200 p-3">
                <Button variant="outline" size="sm" className="w-full border-dashed text-slate-500" onClick={addCheck} disabled={adding}>
                  {adding ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} 항목 추가
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>항목 삭제</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.title || '(제목 없음)'}" 항목을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
