import { useState, useEffect, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { TestCaseForm } from '@/components/TestCaseForm'
import type { JiraFields } from '@/components/TestCaseForm'
import { getProducts, getSuites, getTestCases, createTestCase, updateTestCase, deleteTestCase, getUsers } from '@/lib/firestore'
import { useAuth } from '@/store/auth'
import type { Product, TestSuite, TestCase, TestStatus, ProcessingStatus, UserProfile } from '@/types'
import {
  PRIORITY_LABELS, PRIORITY_COLORS, TEST_STATUS_LABELS, TEST_STATUS_COLORS,
  PROCESSING_STATUS_LABELS, PROCESSING_STATUS_COLORS,
} from '@/lib/constants'
import { toast } from '@/hooks/use-toast'
import { Plus, ChevronLeft, Pencil, Trash2, ExternalLink, Image, ChevronDown, ChevronUp, X, Link, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type FormData = Omit<TestCase, 'id' | 'suiteId' | 'productId' | 'createdAt' | 'updatedAt' | 'order'>

function formatDate(iso: string) {
  if (!iso) return '-'
  return iso.slice(0, 10)
}

export default function TestCasesPage() {
  const { productId, suiteId } = useParams<{ productId: string; suiteId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canEditStatus = user?.role === 'admin' || user?.role === 'developer'
  const [product, setProduct] = useState<Product | null>(null)
  const [suite, setSuite] = useState<TestSuite | null>(null)
  const [cases, setCases] = useState<TestCase[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TestCase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TestCase | null>(null)
  const [deleteJiraToo, setDeleteJiraToo] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState('')
  // 인라인 편집 (관리자)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [inlineForm, setInlineForm] = useState<Partial<TestCase>>({})

  // Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterProcessing, setFilterProcessing] = useState('all')
  const [filterArea, setFilterArea] = useState('all')
  const [filterDeveloper, setFilterDeveloper] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { load() }, [productId, suiteId])

  // ESC 키로 라이트박스 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // URL 해시로 특정 티켓 자동 펼침
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && cases.length > 0) {
      setExpanded((prev) => new Set([...prev, hash]))
      // 어드민은 바로 편집 가능 상태로 열기
      if (isAdmin) {
        const tc = cases.find((c) => c.id === hash)
        if (tc) startInlineEdit(tc)
      }
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
    }
  }, [cases])

  async function load() {
    if (!productId || !suiteId) return
    setLoading(true)
    try {
      const [prods, suitesData, casesData, usersData] = await Promise.all([
        getProducts(), getSuites(productId), getTestCases(suiteId), getUsers(),
      ])
      setProduct(prods.find((p) => p.id === productId) ?? null)
      setSuite(suitesData.find((s) => s.id === suiteId) ?? null)
      setCases(casesData)
      setUsers(usersData)
    } finally {
      setLoading(false)
    }
  }

  const areas = Array.from(new Set(cases.map((c) => c.area).filter(Boolean)))

  const developers = Array.from(new Set(cases.map((c) => c.assignedDeveloper).filter(Boolean)))

  const filtered = cases.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterProcessing !== 'all' && c.processingStatus !== filterProcessing) return false
    if (filterArea !== 'all' && c.area !== filterArea) return false
    if (filterDeveloper !== 'all' && c.assignedDeveloper !== filterDeveloper) return false
    if (dateFrom && c.createdAt.slice(0, 10) < dateFrom) return false
    if (dateTo && c.createdAt.slice(0, 10) > dateTo) return false
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !c.area.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    total: cases.length,
    pass: cases.filter((c) => c.status === 'pass').length,
    fail: cases.filter((c) => c.status === 'fail').length,
    blocked: cases.filter((c) => c.status === 'blocked').length,
    notTested: cases.filter((c) => c.status === 'not_tested').length,
  }

  function toggleExpand(id: string) {
    const willExpand = !expanded.has(id)
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    if (willExpand && isAdmin) {
      const tc = cases.find((c) => c.id === id)
      if (tc) startInlineEdit(tc)
    } else if (!willExpand && inlineEditId === id) {
      setInlineEditId(null)
      setInlineForm({})
    }
  }

  function openCreate() {
    setEditTarget(null)
    setDialogOpen(true)
  }

  function openEdit(tc: TestCase) {
    setEditTarget(tc)
    setDialogOpen(true)
  }

  async function createJiraTicket(data: FormData, jiraFields: JiraFields, issueTrackerUrl?: string): Promise<string | null> {
    const jiraProjectKey = product?.jiraProjectKey
    if (!jiraProjectKey) return null
    try {
      // 요청자: "{팀} {이름}" 문자열
      const reporterName = user
        ? [user.team, user.displayName].filter(Boolean).join(' ')
        : undefined

      // 담당자: 담당개발자 displayName → 이메일 → Jira accountId 자동 조회
      let assigneeAccountId: string | undefined
      if (data.assignedDeveloper) {
        const assigneeUser = users.find((u) => u.displayName === data.assignedDeveloper)
        if (assigneeUser?.email) {
          try {
            const r = await fetch(`/api/jira-users?email=${encodeURIComponent(assigneeUser.email)}`)
            if (r.ok) {
              const d = await r.json()
              if (d?.accountId) assigneeAccountId = d.accountId
            }
          } catch { /* 조회 실패 시 담당자 없이 진행 */ }
        }
      }

      const res = await fetch('/api/jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectKey: jiraProjectKey,
          title: data.title,
          area: data.area,
          priority: data.priority,
          steps: data.steps,
          expectedResult: data.expectedResult,
          actualResult: data.actualResult,
          issueType: jiraFields.issueType,
          assigneeAccountId: assigneeAccountId || null,
          reporterName: reporterName || undefined,
          dueDate: data.dueDate || undefined,
          // 이슈트래커 URL을 기획서링크로 전송
          planningLink: issueTrackerUrl || undefined,
          images: data.images.length > 0 ? data.images : undefined,
        }),
      })
      const resJson = await res.json()
      if (!res.ok) {
        const errMsg = typeof resJson.error === 'string'
          ? resJson.error
          : JSON.stringify(resJson.error ?? resJson)
        toast({ variant: 'destructive', title: 'Jira 티켓 생성 실패', description: errMsg })
        return null
      }
      return resJson.issueUrl
    } catch (e) {
      toast({ variant: 'destructive', title: 'Jira 티켓 생성 실패', description: String(e) })
      return null
    }
  }

  async function handleSave(data: FormData, jiraFields: JiraFields) {
    if (!productId || !suiteId) return
    if (editTarget) {
      await updateTestCase(editTarget.id, data)
      toast({ title: '수정 완료' })
    } else {
      const order = cases.length > 0 ? Math.max(...cases.map((c) => c.order)) + 1 : 0

      // 1. Firestore 이슈 먼저 생성 → ID 확보
      const newId = await createTestCase({
        ...data,
        suiteId, productId, order,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      })

      // 2. 이슈트래커 URL 생성 (이 URL을 Jira 기획서링크로 전송)
      const issueTrackerUrl = `${window.location.origin}/products/${productId}/suites/${suiteId}#${newId}`

      // 3. Jira 티켓 생성
      const jiraUrl = await createJiraTicket(data, jiraFields, issueTrackerUrl)

      // 4. Jira 티켓 URL을 ticketLink로 업데이트
      if (jiraUrl) {
        await updateTestCase(newId, { ticketLink: jiraUrl })
        toast({ title: '추가 완료 · Jira 티켓 생성됨' })
      } else {
        toast({ title: '추가 완료 (Jira 티켓 미생성)' })
      }
    }
    setDialogOpen(false)
    await load()
  }

  function extractJiraKey(ticketLink: string): string | null {
    // https://xxx.atlassian.net/browse/EPC-42 → EPC-42
    const match = ticketLink.match(/\/browse\/([A-Z]+-\d+)/)
    return match ? match[1] : null
  }

  async function handleDelete() {
    if (!deleteTarget) return
    // Jira 티켓도 삭제
    if (deleteJiraToo && deleteTarget.ticketLink) {
      const issueKey = extractJiraKey(deleteTarget.ticketLink)
      if (issueKey) {
        try {
          const r = await fetch('/api/jira-delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issueKey }),
          })
          if (!r.ok) {
            const d = await r.json().catch(() => ({}))
            toast({ variant: 'destructive', title: 'Jira 티켓 삭제 실패', description: JSON.stringify(d.error ?? d) })
          }
        } catch (e) {
          toast({ variant: 'destructive', title: 'Jira 티켓 삭제 실패', description: String(e) })
        }
      }
    }
    await deleteTestCase(deleteTarget.id)
    toast({ title: '삭제됨', variant: 'destructive' })
    setDeleteTarget(null)
    setDeleteJiraToo(false)
    await load()
  }

  async function quickUpdateProcessing(id: string, status: ProcessingStatus) {
    await updateTestCase(id, { processingStatus: status })
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, processingStatus: status } : c))
  }

  async function saveNote(id: string) {
    const original = cases.find((c) => c.id === id)?.developerNote ?? ''
    if (noteValue === original) return
    await updateTestCase(id, { developerNote: noteValue })
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, developerNote: noteValue } : c))
  }

  function startInlineEdit(tc: TestCase) {
    setInlineEditId(tc.id)
    setInlineForm({ ...tc })
  }

  async function saveInlineEdit(id: string) {
    const merged = { ...cases.find((c) => c.id === id)!, ...inlineForm }
    await updateTestCase(id, inlineForm)
    setCases((prev) => prev.map((c) => c.id === id ? merged : c))
    // re-init inlineForm from saved state so isDirty becomes false
    setInlineForm({ ...merged })
    toast({ title: '변경사항이 저장되었습니다' })
  }

  async function quickUpdateStatus(id: string, status: TestStatus) {
    await updateTestCase(id, { status })
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
  }

  async function quickUpdateAssignedDeveloper(id: string, assignedDeveloper: string) {
    await updateTestCase(id, { assignedDeveloper })
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, assignedDeveloper } : c))
  }

  const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-8 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-800">
              <ChevronLeft className="w-4 h-4" /> 목록으로
            </Button>
            <span className="text-slate-300">/</span>
            <h1 className="text-lg font-bold text-slate-800">{suite?.name ?? '...'}</h1>
            {suite?.version && <Badge variant="outline">{suite.version}</Badge>}
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {isAdmin && (
              <DialogTrigger asChild>
                <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> 항목 추가</Button>
              </DialogTrigger>
            )}
            {dialogOpen && (
              <TestCaseForm
                suiteId={suiteId!}
                initial={editTarget ?? undefined}
                users={users}
                jiraProjectKey={editTarget ? undefined : product?.jiraProjectKey}
                currentUserDisplayName={user?.displayName}
                onSave={handleSave}
                onCancel={() => setDialogOpen(false)}
              />
            )}
          </Dialog>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b px-8 py-2.5 shrink-0">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-slate-500">전체 <strong className="text-slate-800">{stats.total}</strong></span>
          <span className="text-green-700">통과 <strong>{stats.pass}</strong></span>
          <span className="text-red-700">실패 <strong>{stats.fail}</strong></span>
          <span className="text-orange-700">블로킹 <strong>{stats.blocked}</strong></span>
          <span className="text-slate-500">미테스트 <strong>{stats.notTested}</strong></span>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-32 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${passRate}%` }} />
            </div>
            <span className="text-slate-600 font-medium text-sm">{passRate}%</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-8 py-2.5 flex gap-2 items-center flex-wrap shrink-0">
        <Input
          placeholder="제목/영역 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-44 h-8 text-sm"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="테스트결과" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="not_tested">미테스트</SelectItem>
            <SelectItem value="pass">통과</SelectItem>
            <SelectItem value="fail">실패</SelectItem>
            <SelectItem value="blocked">블로킹</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProcessing} onValueChange={setFilterProcessing}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="처리상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="pending">미처리</SelectItem>
            <SelectItem value="in_progress">처리중</SelectItem>
            <SelectItem value="resolved">처리완료</SelectItem>
            <SelectItem value="wont_fix">보류</SelectItem>
          </SelectContent>
        </Select>
        {areas.length > 0 && (
          <Select value={filterArea} onValueChange={setFilterArea}>
            <SelectTrigger className="w-32 h-8 text-sm"><SelectValue placeholder="영역" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 영역</SelectItem>
              {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {developers.length > 0 && (
          <Select value={filterDeveloper} onValueChange={setFilterDeveloper}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="담당개발자" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 개발자</SelectItem>
              {developers.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <span className="text-xs">등록일</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 px-2 text-xs border rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-xs">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 px-2 text-xs border rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length}건</span>
      </div>

      {/* Table */}
      <main className="flex-1 overflow-auto px-8 py-5">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-slate-200 rounded animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <p>항목이 없습니다</p>
            {isAdmin && <Button className="mt-4" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> 항목 추가</Button>}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
              <tr className="text-xs text-slate-600 font-semibold whitespace-nowrap">
                <th className="px-4 py-3 text-left w-9">#</th>
                <th className="px-4 py-3 text-left w-24">영역</th>
                <th className="px-4 py-3 text-left w-16">우선순위</th>
                <th className="px-4 py-3 text-left">제목</th>
                <th className="px-4 py-3 text-left w-28">담당개발자</th>
                <th className="px-4 py-3 text-left w-28">테스트결과</th>
                <th className="px-4 py-3 text-left w-28">처리상태</th>
                <th className="px-4 py-3 text-left w-24">등록일</th>
                <th className="px-4 py-3 text-center w-10"></th>
                <th className="px-4 py-3 text-center w-24"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filtered.map((tc, idx) => (
                <Fragment key={tc.id}>
                  {/* Main Row */}
                  <tr
                    id={tc.id}
                    className={cn('hover:bg-slate-50 cursor-pointer transition-colors whitespace-nowrap', expanded.has(tc.id) ? 'bg-sky-50 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent')}
                    onClick={() => toggleExpand(tc.id)}
                  >
                    <td className="px-4 py-2.5 text-xs text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      {tc.area
                        ? <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">{tc.area}</span>
                        : <span className="text-slate-300">-</span>
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('text-xs px-2 py-0.5 rounded font-medium', PRIORITY_COLORS[tc.priority])}>
                        {PRIORITY_LABELS[tc.priority]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <div className="font-medium text-slate-800 truncate">{tc.title}</div>
                      {tc.tester && (
                        <div className="text-xs text-slate-400 mt-0.5">등록자: {tc.tester}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-600 whitespace-nowrap">
                      {tc.assignedDeveloper || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {canEditStatus ? (
                        <Select value={tc.status} onValueChange={(v) => quickUpdateStatus(tc.id, v as TestStatus)}>
                          <SelectTrigger className={cn('w-24 h-7 text-xs border-0 rounded-full font-medium px-2', TEST_STATUS_COLORS[tc.status])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_tested">미테스트</SelectItem>
                            <SelectItem value="pass">통과</SelectItem>
                            <SelectItem value="fail">실패</SelectItem>
                            <SelectItem value="blocked">블로킹</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn('text-xs px-2 py-1 rounded-full font-medium', TEST_STATUS_COLORS[tc.status])}>
                          {TEST_STATUS_LABELS[tc.status]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {isAdmin ? (
                        <Select value={tc.processingStatus} onValueChange={(v) => quickUpdateProcessing(tc.id, v as ProcessingStatus)}>
                          <SelectTrigger className={cn('w-24 h-7 text-xs border-0 rounded-full font-medium px-2', PROCESSING_STATUS_COLORS[tc.processingStatus])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">미처리</SelectItem>
                            <SelectItem value="in_progress">처리중</SelectItem>
                            <SelectItem value="resolved">처리완료</SelectItem>
                            <SelectItem value="wont_fix">보류</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn('text-xs px-2 py-1 rounded-full font-medium', PROCESSING_STATUS_COLORS[tc.processingStatus])}>
                          {PROCESSING_STATUS_LABELS[tc.processingStatus]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{formatDate(tc.createdAt)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {tc.images.length > 0 && (
                        <span className="text-xs text-slate-400 flex items-center justify-center gap-0.5">
                          <Image className="w-3.5 h-3.5" />{tc.images.length}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-slate-400"
                          onClick={() => {
                            const url = `${window.location.origin}${window.location.pathname}#${tc.id}`
                            navigator.clipboard.writeText(url)
                            toast({ title: '링크 복사됨' })
                          }}
                        >
                          <Link className="w-3.5 h-3.5" />
                        </Button>
                        {tc.ticketLink && (
                          <a href={tc.ticketLink} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
                          </a>
                        )}
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tc)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(tc)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => toggleExpand(tc.id)}>
                          {expanded.has(tc.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Detail Row */}
                  {expanded.has(tc.id) && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={10} className="px-8 py-5 bg-sky-50 border-t border-sky-100 border-b-2 border-b-primary/30">
                        {(() => {
                          const isEditing = inlineEditId === tc.id
                          const f = isEditing ? inlineForm : tc
                          const setF = (key: keyof TestCase, val: string) => setInlineForm((p) => ({ ...p, [key]: val }))

                          const isDirty = isEditing && Object.keys(inlineForm).some((k) => {
                            const key = k as keyof TestCase
                            return (inlineForm as unknown as Record<string, unknown>)[key] !== (tc as unknown as Record<string, unknown>)[key]
                          })

                          // textarea 자동 높이 확장
                          const ar = (el: HTMLTextAreaElement | null) => {
                            if (!el) return
                            el.style.height = 'auto'
                            el.style.height = `${el.scrollHeight}px`
                          }

                          // 읽기 전용 텍스트 박스
                          const ReadBox = ({ value }: { value: string }) => (
                            <div className="bg-white rounded-md border px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                              {value || <span className="text-slate-300">—</span>}
                            </div>
                          )

                          // 자동 높이 textarea
                          const AutoArea = ({ fieldKey, placeholder }: { fieldKey: keyof TestCase, placeholder?: string }) => (
                            <textarea
                              ref={ar}
                              className="w-full text-sm bg-white border rounded-md px-3 py-2 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none overflow-hidden min-h-[60px]"
                              placeholder={placeholder}
                              value={(f[fieldKey] as string) ?? ''}
                              onChange={(e) => { setF(fieldKey, e.target.value); ar(e.target) }}
                            />
                          )

                          return (
                          <div className="space-y-3">
                            {/* 헤더 */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">등록일 {formatDate(tc.createdAt)}</span>
                              <Button
                                size="sm"
                                className={cn('h-7 text-xs transition-opacity', isDirty ? 'opacity-100' : 'opacity-0 pointer-events-none')}
                                onClick={() => saveInlineEdit(tc.id)}
                              >
                                <Check className="w-3 h-3 mr-1"/>변경사항 저장
                              </Button>
                            </div>

                            {/* 메인 2패널 */}
                            <div className="grid grid-cols-[200px_1fr] gap-5 items-start">

                              {/* ── 왼쪽: 메타데이터 ── */}
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">영역</p>
                                  {isEditing
                                    ? <Input className="h-8 text-sm" value={f.area ?? ''} onChange={(e) => setF('area', e.target.value)} />
                                    : <p className="text-sm font-medium text-slate-700">{tc.area || <span className="text-slate-300">—</span>}</p>}
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">우선순위</p>
                                  {isEditing ? (
                                    <Select value={f.priority as string} onValueChange={(v) => setF('priority', v)}>
                                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="critical">긴급</SelectItem>
                                        <SelectItem value="high">높음</SelectItem>
                                        <SelectItem value="medium">보통</SelectItem>
                                        <SelectItem value="low">낮음</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : <span className={cn('text-xs px-2 py-0.5 rounded font-medium', PRIORITY_COLORS[tc.priority])}>{PRIORITY_LABELS[tc.priority]}</span>}
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">등록자</p>
                                  {isEditing ? (
                                    <Select value={f.tester || '__none__'} onValueChange={(v) => setF('tester', v === '__none__' ? '' : v)}>
                                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">—</SelectItem>
                                        {users.map((u) => <SelectItem key={u.uid} value={u.displayName}>{u.displayName}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  ) : <p className="text-sm font-medium text-slate-700">{tc.tester || <span className="text-slate-300">—</span>}</p>}
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">담당 개발자</p>
                                  {isEditing ? (
                                    <Select value={f.assignedDeveloper || '__none__'} onValueChange={(v) => setF('assignedDeveloper', v === '__none__' ? '' : v)}>
                                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">—</SelectItem>
                                        {users.map((u) => <SelectItem key={u.uid} value={u.displayName}>{u.displayName}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  ) : canEditStatus ? (
                                    <Select value={tc.assignedDeveloper || '__none__'} onValueChange={(v) => quickUpdateAssignedDeveloper(tc.id, v === '__none__' ? '' : v)}>
                                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">—</SelectItem>
                                        {users.map((u) => <SelectItem key={u.uid} value={u.displayName}>{u.displayName}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  ) : <p className="text-sm font-medium text-slate-700">{tc.assignedDeveloper || <span className="text-slate-300">—</span>}</p>}
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">테스트 결과</p>
                                  {(isAdmin || canEditStatus) ? (
                                    <Select value={(isEditing ? f.status : tc.status) as string} onValueChange={(v) => isEditing ? setF('status', v) : quickUpdateStatus(tc.id, v as TestStatus)}>
                                      <SelectTrigger className={cn('h-8 text-xs border-0 rounded-full font-medium', TEST_STATUS_COLORS[(isEditing ? f.status : tc.status) as TestStatus])}><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="not_tested">미테스트</SelectItem>
                                        <SelectItem value="pass">통과</SelectItem>
                                        <SelectItem value="fail">실패</SelectItem>
                                        <SelectItem value="blocked">블로킹</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : <span className={cn('text-xs px-2 py-1 rounded-full font-medium', TEST_STATUS_COLORS[tc.status])}>{TEST_STATUS_LABELS[tc.status]}</span>}
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">처리 상태</p>
                                  {isAdmin ? (
                                    <Select value={(isEditing ? f.processingStatus : tc.processingStatus) as string} onValueChange={(v) => isEditing ? setF('processingStatus', v) : quickUpdateProcessing(tc.id, v as ProcessingStatus)}>
                                      <SelectTrigger className={cn('h-8 text-xs border-0 rounded-full font-medium', PROCESSING_STATUS_COLORS[(isEditing ? f.processingStatus : tc.processingStatus) as ProcessingStatus])}><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">미처리</SelectItem>
                                        <SelectItem value="in_progress">처리중</SelectItem>
                                        <SelectItem value="resolved">처리완료</SelectItem>
                                        <SelectItem value="wont_fix">보류</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : <span className={cn('text-xs px-2 py-1 rounded-full font-medium', PROCESSING_STATUS_COLORS[tc.processingStatus])}>{PROCESSING_STATUS_LABELS[tc.processingStatus]}</span>}
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">티켓 링크</p>
                                  {isEditing
                                    ? <div className="flex items-center gap-1">
                                        <Input className="h-8 text-sm min-w-0" placeholder="https://..." value={f.ticketLink ?? ''} onChange={(e) => setF('ticketLink', e.target.value)} />
                                        {f.ticketLink && <a href={f.ticketLink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-slate-400 hover:text-primary"><ExternalLink className="w-4 h-4" /></a>}
                                      </div>
                                    : tc.ticketLink
                                      ? <a href={tc.ticketLink} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1 text-sm hover:underline break-all"><ExternalLink className="w-3 h-3 shrink-0"/>{tc.ticketLink}</a>
                                      : <span className="text-slate-300 text-sm">—</span>}
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">기한</p>
                                  {isEditing
                                    ? <input
                                        type="date"
                                        value={f.dueDate ?? ''}
                                        onChange={(e) => setF('dueDate', e.target.value)}
                                        className="h-8 w-full px-2 text-sm border rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                      />
                                    : tc.dueDate
                                      ? <p className="text-sm font-medium text-slate-700">{tc.dueDate}</p>
                                      : <span className="text-slate-300 text-sm">—</span>}
                                </div>
                              </div>

                              {/* ── 오른쪽: 테스트 내용 ── */}
                              <div className="space-y-3">
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">테스트 절차</p>
                                  {isEditing
                                    ? <AutoArea fieldKey="steps" placeholder={"1. 앱 실행\n2. 버튼 클릭"} />
                                    : <ReadBox value={tc.steps} />}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1">기대 결과</p>
                                    {isEditing
                                      ? <AutoArea fieldKey="expectedResult" />
                                      : <ReadBox value={tc.expectedResult} />}
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1">실제 결과</p>
                                    {isEditing
                                      ? <AutoArea fieldKey="actualResult" />
                                      : <ReadBox value={tc.actualResult} />}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs text-blue-500 font-medium mb-1">개발자 코멘트</p>
                                  {isEditing ? (
                                    <AutoArea fieldKey="developerNote" placeholder="처리 내용, 수정 사항 등" />
                                  ) : canEditStatus ? (
                                    <textarea
                                      ref={ar}
                                      className="w-full text-sm text-slate-700 bg-white border rounded-md px-3 py-2 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[60px]"
                                      placeholder="코멘트를 입력하세요..."
                                      value={editingNoteId === tc.id ? noteValue : tc.developerNote}
                                      onFocus={(e) => { setEditingNoteId(tc.id); setNoteValue(tc.developerNote); ar(e.target) }}
                                      onChange={(e) => { setNoteValue(e.target.value); ar(e.target) }}
                                      onBlur={() => { if (editingNoteId === tc.id) saveNote(tc.id) }}
                                    />
                                  ) : (
                                    <ReadBox value={tc.developerNote} />
                                  )}
                                </div>
                                {tc.images.length > 0 && (
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1">첨부 이미지 ({tc.images.length})</p>
                                    <div className="flex flex-wrap gap-2">
                                      {tc.images.map((url) => (
                                        <img key={url} src={url}
                                          className="w-24 h-24 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity shadow-sm"
                                          onClick={() => setLightbox(url)} alt="" />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          )
                        })()}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </main>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteJiraToo(false) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>항목 삭제</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.title}"을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget?.ticketLink && extractJiraKey(deleteTarget.ticketLink) && (
            <label className="flex items-center gap-2 px-1 py-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deleteJiraToo}
                onChange={(e) => setDeleteJiraToo(e.target.checked)}
                className="w-4 h-4 accent-destructive"
              />
              <span className="text-sm text-slate-700">
                Jira 티켓 <span className="font-mono text-xs text-slate-500">{extractJiraKey(deleteTarget.ticketLink!)}</span>도 함께 삭제
              </span>
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-[90vw] max-h-[90vh] object-contain rounded" alt="" />
          <button className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2" onClick={() => setLightbox(null)}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
