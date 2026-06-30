import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import {
  getProducts, getQaGroups, getQaTicketGroups, createQaTicketGroup, deleteQaTicketGroup,
  getQaChecks, createQaCheck, updateQaCheck, deleteQaCheck,
} from '@/lib/firestore'
import { authedFetch } from '@/lib/api'
import type { Product, QaGroup, QaTicketGroup, QaCheck, QaStatus } from '@/types'
import { QA_STATUS_LABELS, QA_STATUS_COLORS, ticketStatusesFor } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ChevronLeft, Plus, Trash2, RefreshCw, Loader2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

export default function QaGroupPage() {
  const { productId, groupId } = useParams<{ productId: string; groupId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'pm' || user?.role === 'developer'

  const [product, setProduct] = useState<Product | null>(null)
  const [group, setGroup] = useState<QaGroup | null>(null)
  const [ticketGroups, setTicketGroups] = useState<QaTicketGroup[]>([])
  const [checks, setChecks] = useState<QaCheck[]>([])
  const [loading, setLoading] = useState(true)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketOptions, setTicketOptions] = useState<Array<{ key: string; summary: string; status: string; url: string }>>([])
  const [ticketSelected, setTicketSelected] = useState<Set<string>>(new Set())
  const [ticketError, setTicketError] = useState('')

  const [deleteTG, setDeleteTG] = useState<QaTicketGroup | null>(null)
  const [deleteCheckTarget, setDeleteCheckTarget] = useState<QaCheck | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleCollapse = (id: string) => setCollapsed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  useEffect(() => { load() }, [productId, groupId])

  async function load() {
    if (!productId || !groupId) return
    setLoading(true)
    try {
      const [prods, groups, tgs, checksData] = await Promise.all([
        getProducts(), getQaGroups(productId), getQaTicketGroups(groupId), getQaChecks(groupId),
      ])
      setProduct(prods.find((p) => p.id === productId) ?? null)
      setGroup(groups.find((g) => g.id === groupId) ?? null)
      setTicketGroups(tgs)
      setChecks(checksData)
    } finally {
      setLoading(false)
    }
  }

  // --- 그룹(티켓) 추가 ---
  async function openPicker() {
    setPickerOpen(true)
    setTicketSelected(new Set())
    setTicketError('')
    if (!product?.jiraProjectKey) { setTicketError('이 프로덕트에 Jira 프로젝트 키가 없습니다.'); setTicketOptions([]); return }
    setTicketLoading(true)
    try {
      const statuses = ticketStatusesFor(product.jiraProjectKey)
      const res = await authedFetch(`/api/jira-issues?projectKey=${encodeURIComponent(product.jiraProjectKey)}&statuses=${encodeURIComponent(statuses.join(','))}`)
      const data = await res.json()
      if (!res.ok) { setTicketError('티켓을 불러오지 못했습니다: ' + JSON.stringify(data.error ?? data)); setTicketOptions([]) }
      else setTicketOptions(data.issues ?? [])
    } catch (e) {
      setTicketError('티켓 조회 실패: ' + String(e)); setTicketOptions([])
    } finally {
      setTicketLoading(false)
    }
  }
  async function createGroup() {
    if (!productId || !groupId) return
    const chosen = ticketOptions.filter((t) => ticketSelected.has(t.key))
    await createQaTicketGroup({
      qaGroupId: groupId, productId,
      tickets: chosen.map((t) => ({ jiraKey: t.key, title: t.summary, url: t.url })),
      order: ticketGroups.length,
    })
    setTicketGroups(await getQaTicketGroups(groupId))
    setPickerOpen(false)
    toast({ title: `그룹 생성됨 (티켓 ${chosen.length}개)` })
  }
  async function handleDeleteTG() {
    if (!deleteTG) return
    await deleteQaTicketGroup(deleteTG.id)
    setTicketGroups((prev) => prev.filter((g) => g.id !== deleteTG.id))
    setChecks((prev) => prev.filter((c) => c.ticketGroupId !== deleteTG.id))
    setDeleteTG(null)
  }

  // --- 케이스 ---
  async function addCheck(ticketGroupId: string) {
    if (!productId || !groupId) return
    const order = checks.filter((c) => c.ticketGroupId === ticketGroupId).length
    const id = await createQaCheck({ qaGroupId: groupId, ticketGroupId, productId, title: '', asIs: '', toBe: '', status: 'pending', order })
    setChecks((prev) => [...prev, { id, qaGroupId: groupId, ticketGroupId, productId, title: '', asIs: '', toBe: '', status: 'pending', order, createdAt: new Date().toISOString() }])
  }
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
  async function handleDeleteCheck() {
    if (!deleteCheckTarget) return
    await deleteQaCheck(deleteCheckTarget.id)
    setChecks((prev) => prev.filter((c) => c.id !== deleteCheckTarget.id))
    setDeleteCheckTarget(null)
  }

  // 전체 진행도
  const total = checks.length
  const pass = checks.filter((c) => c.status === 'pass').length
  const block = checks.filter((c) => c.status === 'block').length
  const pending = checks.filter((c) => c.status === 'pending').length
  const passRate = total > 0 ? Math.round((pass / total) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
          <div className="flex items-center gap-2">
            {canEdit && <Button size="sm" onClick={openPicker}><Plus className="w-4 h-4 mr-1" /> 그룹 추가</Button>}
            <Button variant="ghost" size="sm" onClick={load} className="text-slate-400 hover:text-slate-600" title="새로고침"><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      {/* 진행도 */}
      <div className="bg-white border-b px-8 py-2.5 shrink-0">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-slate-500">전체 <strong className="text-slate-800">{total}</strong></span>
          <span className="text-green-700">통과 <strong>{pass}</strong></span>
          <span className="text-red-700">블록 <strong>{block}</strong></span>
          <span className="text-slate-500">미확인 <strong>{pending}</strong></span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-32 h-2 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-green-500 transition-all" style={{ width: `${passRate}%` }} /></div>
            <span className="text-slate-600 font-medium text-sm">{passRate}%</span>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-auto px-8 py-5 space-y-5">
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-24 bg-slate-200 rounded animate-pulse" />)}</div>
        ) : !group ? (
          <div className="text-center py-24 text-slate-400">QA 테스트를 찾을 수 없습니다.</div>
        ) : ticketGroups.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-sm">그룹이 없습니다. 티켓을 골라 그룹을 만들어보세요.</p>
            {canEdit && <Button className="mt-3" size="sm" onClick={openPicker}><Plus className="w-4 h-4 mr-1" /> 그룹 추가</Button>}
          </div>
        ) : (
          ticketGroups.map((tg) => {
            const groupChecks = checks.filter((c) => c.ticketGroupId === tg.id).sort((a, b) => a.order - b.order)
            const gTotal = groupChecks.length
            const gPass = groupChecks.filter((c) => c.status === 'pass').length
            const gBlock = groupChecks.filter((c) => c.status === 'block').length
            const gPending = groupChecks.filter((c) => c.status === 'pending').length
            const gDone = gTotal > 0 ? Math.round(((gPass + gBlock) / gTotal) * 100) : 0
            const isCollapsed = collapsed.has(tg.id)
            return (
              <div key={tg.id} className="rounded-lg border border-slate-200 shadow-sm overflow-hidden bg-white">
                {/* 그룹 헤더: 접기 + 티켓 + 통계 */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <button className="text-slate-400 hover:text-slate-700 mt-0.5 shrink-0" onClick={() => toggleCollapse(tg.id)}>
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className="flex flex-col gap-2 min-w-0 flex-1 cursor-pointer" onClick={() => toggleCollapse(tg.id)}>
                      {tg.tickets.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {tg.tickets.map((t) => (
                            <a key={t.jiraKey} href={t.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:border-primary/50">
                              <span className="font-mono font-semibold text-primary shrink-0">{t.jiraKey}</span>
                              <span className="text-slate-700">{t.title}</span>
                              <ExternalLink className="w-3 h-3 text-slate-300 shrink-0" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">티켓 미연결 그룹</span>
                      )}
                      {/* 그룹별 통계 */}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-green-700">통과 <strong>{gPass}</strong></span>
                        <span className="text-red-700">블록 <strong>{gBlock}</strong></span>
                        <span className="text-slate-500">미확인 <strong>{gPending}</strong></span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">완료 <strong>{gDone}%</strong></span>
                        <span className="text-slate-300">({gTotal}건)</span>
                      </div>
                    </div>
                    {canEdit && (
                      <button className="text-slate-300 hover:text-destructive shrink-0 mt-0.5" onClick={() => setDeleteTG(tg)} title="그룹 삭제"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
                {/* 케이스 표 (접힘 시 숨김) */}
                {!isCollapsed && (
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-white border-b border-slate-100">
                    <tr className="text-xs text-slate-500">
                      <th className="px-4 py-2 text-left w-10">#</th>
                      <th className="px-4 py-2 text-left w-52">항목명</th>
                      <th className="px-4 py-2 text-left">AS-IS</th>
                      <th className="px-4 py-2 text-left">TO-BE</th>
                      <th className="px-4 py-2 text-left w-28">상태</th>
                      {canEdit && <th className="px-4 py-2 text-center w-12"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupChecks.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-slate-50 align-top">
                        <td className="px-4 py-2 text-xs text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2">
                          {canEdit
                            ? <Input className="h-8 text-xs" placeholder="항목명" value={c.title} onChange={(e) => setField(c.id, 'title', e.target.value)} onBlur={(e) => saveField(c.id, 'title', e.target.value)} />
                            : <span className="text-sm text-slate-700">{c.title || <span className="text-slate-300">—</span>}</span>}
                        </td>
                        <td className="px-4 py-2">
                          {canEdit
                            ? <textarea className="w-full text-xs border rounded-md px-2 py-1.5 min-h-[34px] resize-y focus:outline-none focus:ring-1 focus:ring-primary" placeholder="현재(AS-IS)" value={c.asIs} onChange={(e) => setField(c.id, 'asIs', e.target.value)} onBlur={(e) => saveField(c.id, 'asIs', e.target.value)} />
                            : <span className="text-sm text-slate-700 whitespace-pre-wrap">{c.asIs || <span className="text-slate-300">—</span>}</span>}
                        </td>
                        <td className="px-4 py-2">
                          {canEdit
                            ? <textarea className="w-full text-xs border rounded-md px-2 py-1.5 min-h-[34px] resize-y focus:outline-none focus:ring-1 focus:ring-primary" placeholder="변경(TO-BE)" value={c.toBe} onChange={(e) => setField(c.id, 'toBe', e.target.value)} onBlur={(e) => saveField(c.id, 'toBe', e.target.value)} />
                            : <span className="text-sm text-slate-700 whitespace-pre-wrap">{c.toBe || <span className="text-slate-300">—</span>}</span>}
                        </td>
                        <td className="px-4 py-2">
                          {canEdit ? (
                            <Select value={c.status} onValueChange={(v) => setStatus(c.id, v as QaStatus)}>
                              <SelectTrigger className={cn('w-24 h-7 text-xs border-0 rounded-full font-medium px-2', QA_STATUS_COLORS[c.status])}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">미확인</SelectItem>
                                <SelectItem value="pass">통과</SelectItem>
                                <SelectItem value="block">블록</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : <span className={cn('text-xs px-2 py-1 rounded-full font-medium', QA_STATUS_COLORS[c.status])}>{QA_STATUS_LABELS[c.status]}</span>}
                        </td>
                        {canEdit && <td className="px-4 py-2 text-center"><button className="text-slate-300 hover:text-destructive" onClick={() => setDeleteCheckTarget(c)}><Trash2 className="w-4 h-4" /></button></td>}
                      </tr>
                    ))}
                    {groupChecks.length === 0 && (
                      <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-6 text-center text-slate-300 text-sm">케이스 없음</td></tr>
                    )}
                  </tbody>
                </table>
                )}
                {!isCollapsed && canEdit && (
                  <div className="border-t border-slate-100 p-2">
                    <Button variant="ghost" size="sm" className="w-full text-slate-500 text-xs" onClick={() => addCheck(tg.id)}><Plus className="w-3.5 h-3.5 mr-1" /> 케이스 추가</Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </main>

      {/* 티켓 선택 다이얼로그 */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>그룹 추가 — 티켓 선택</DialogTitle></DialogHeader>
          <div className="py-1">
            <p className="text-xs text-slate-400 mb-2">
              {product?.jiraProjectKey ? <>프로젝트 <strong>{product.jiraProjectKey}</strong> · 상태: {ticketStatusesFor(product.jiraProjectKey).join(', ')}</> : 'Jira 프로젝트 키 없음'}
            </p>
            {ticketError && <p className="text-sm text-destructive mb-2">{ticketError}</p>}
            <div className="max-h-[50vh] overflow-y-auto border rounded-md divide-y">
              {ticketLoading ? (
                <div className="py-10 text-center text-slate-400 text-sm"><Loader2 className="w-5 h-5 animate-spin inline" /> 불러오는 중...</div>
              ) : ticketOptions.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">불러온 티켓이 없습니다</div>
              ) : (
                ticketOptions.map((t) => (
                  <label key={t.key} className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50">
                    <Checkbox checked={ticketSelected.has(t.key)} onChange={(c) => setTicketSelected((prev) => { const n = new Set(prev); if (c) n.add(t.key); else n.delete(t.key); return n })} className="mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-slate-500">{t.key}</span>
                      <span className="text-xs text-slate-400 ml-1.5">{t.status}</span>
                      <p className="text-sm text-slate-700 break-words">{t.summary}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>취소</Button>
            <Button onClick={createGroup}>{ticketSelected.size > 0 ? `티켓 ${ticketSelected.size}개로 그룹 생성` : '티켓 없이 그룹 생성'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTG} onOpenChange={(o) => { if (!o) setDeleteTG(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>그룹 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 그룹과 그 안의 모든 케이스를 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTG} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteCheckTarget} onOpenChange={(o) => { if (!o) setDeleteCheckTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>케이스 삭제</AlertDialogTitle>
            <AlertDialogDescription>"{deleteCheckTarget?.title || '(제목 없음)'}" 케이스를 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCheck} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
