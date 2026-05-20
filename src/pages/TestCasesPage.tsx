import { useState, useEffect } from 'react'
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
import { getProducts, getSuites, getTestCases, createTestCase, updateTestCase, deleteTestCase } from '@/lib/firestore'
import { useAuth } from '@/store/auth'
import type { Product, TestSuite, TestCase, TestStatus, ProcessingStatus } from '@/types'
import {
  PRIORITY_LABELS, PRIORITY_COLORS, TEST_STATUS_COLORS,
  PROCESSING_STATUS_COLORS,
} from '@/lib/constants'
import { toast } from '@/hooks/use-toast'
import { Plus, ChevronLeft, Pencil, Trash2, ExternalLink, Image, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type FormData = Omit<TestCase, 'id' | 'suiteId' | 'productId' | 'createdAt' | 'updatedAt' | 'order'>

export default function TestCasesPage() {
  const { productId, suiteId } = useParams<{ productId: string; suiteId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const canEditStatus = user?.role === 'admin' || user?.role === 'developer'
  const [_product, setProduct] = useState<Product | null>(null)
  const [suite, setSuite] = useState<TestSuite | null>(null)
  const [cases, setCases] = useState<TestCase[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TestCase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TestCase | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<string | null>(null)

  // Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterProcessing, setFilterProcessing] = useState('all')
  const [filterArea, setFilterArea] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [productId, suiteId])

  async function load() {
    if (!productId || !suiteId) return
    setLoading(true)
    try {
      const [prods, suitesData, casesData] = await Promise.all([
        getProducts(), getSuites(productId), getTestCases(suiteId),
      ])
      setProduct(prods.find((p) => p.id === productId) ?? null)
      setSuite(suitesData.find((s) => s.id === suiteId) ?? null)
      setCases(casesData)
    } finally {
      setLoading(false)
    }
  }

  const areas = Array.from(new Set(cases.map((c) => c.area).filter(Boolean)))

  const filtered = cases.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterProcessing !== 'all' && c.processingStatus !== filterProcessing) return false
    if (filterArea !== 'all' && c.area !== filterArea) return false
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
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openCreate() {
    setEditTarget(null)
    setDialogOpen(true)
  }

  function openEdit(tc: TestCase) {
    setEditTarget(tc)
    setDialogOpen(true)
  }

  async function handleSave(data: FormData) {
    if (!productId || !suiteId) return
    if (editTarget) {
      await updateTestCase(editTarget.id, data)
      toast({ title: '테스트 케이스 수정 완료' })
    } else {
      const order = cases.length > 0 ? Math.max(...cases.map((c) => c.order)) + 1 : 0
      await createTestCase({
        ...data, suiteId, productId, order,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      })
      toast({ title: '테스트 케이스 추가 완료' })
    }
    setDialogOpen(false)
    await load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteTestCase(deleteTarget.id)
    toast({ title: '테스트 케이스 삭제됨', variant: 'destructive' })
    setDeleteTarget(null)
    await load()
  }

  async function quickUpdateProcessing(id: string, status: ProcessingStatus) {
    await updateTestCase(id, { processingStatus: status })
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, processingStatus: status } : c))
  }

  async function quickUpdateStatus(id: string, status: TestStatus) {
    await updateTestCase(id, { status })
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
  }

  const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/products/${productId}/suites`)} className="text-slate-500 hover:text-slate-800">
              <ChevronLeft className="w-4 h-4" /> 테스트 묶음
            </Button>
            <span className="text-slate-300">/</span>
            <h1 className="text-lg font-bold text-slate-800">{suite?.name ?? '...'}</h1>
            {suite?.version && <Badge variant="outline">{suite.version}</Badge>}
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {isAdmin && (
              <DialogTrigger asChild>
                <Button onClick={openCreate} size="sm"><Plus /> 테스트 케이스 추가</Button>
              </DialogTrigger>
            )}
            {dialogOpen && (
              <TestCaseForm
                suiteId={suiteId!}
                initial={editTarget ?? undefined}
                onSave={handleSave}
                onCancel={() => setDialogOpen(false)}
              />
            )}
          </Dialog>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b px-6 py-3">
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
            <span className="text-slate-600 font-medium">{passRate}%</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3 flex gap-3 items-center flex-wrap">
        <Input
          placeholder="제목/영역 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 h-8 text-sm"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="테스트 결과" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="not_tested">미테스트</SelectItem>
            <SelectItem value="pass">통과</SelectItem>
            <SelectItem value="fail">실패</SelectItem>
            <SelectItem value="blocked">블로킹</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProcessing} onValueChange={setFilterProcessing}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="처리 상태" /></SelectTrigger>
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
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="영역" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 영역</SelectItem>
              {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length}건</span>
      </div>

      {/* Test Cases */}
      <main className="max-w-6xl mx-auto px-4 py-4 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-200 rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p>테스트 케이스가 없습니다</p>
            {isAdmin && <Button className="mt-4" onClick={openCreate}><Plus /> 테스트 케이스 추가</Button>}
          </div>
        ) : (
          filtered.map((tc, idx) => (
            <div key={tc.id} className="bg-white border rounded-lg overflow-hidden shadow-sm">
              {/* Row Header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xs text-slate-400 w-6 shrink-0">{idx + 1}</span>

                {tc.area && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">{tc.area}</span>
                )}

                <span
                  className={cn('text-xs px-2 py-0.5 rounded font-medium shrink-0', PRIORITY_COLORS[tc.priority])}
                >
                  {PRIORITY_LABELS[tc.priority]}
                </span>

                <button
                  className="text-sm font-medium text-slate-800 text-left flex-1 hover:text-primary transition-colors"
                  onClick={() => toggleExpand(tc.id)}
                >
                  {tc.title}
                </button>

                {tc.images.length > 0 && (
                  <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                    <Image className="w-3.5 h-3.5" /> {tc.images.length}
                  </span>
                )}

                {/* Test Status Selector - admin + developer */}
                {canEditStatus ? (
                  <Select value={tc.status} onValueChange={(v) => quickUpdateStatus(tc.id, v as TestStatus)}>
                    <SelectTrigger className={cn('w-24 h-7 text-xs border-0 rounded-full font-medium', TEST_STATUS_COLORS[tc.status])}>
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
                    {tc.status === 'not_tested' ? '미테스트' : tc.status === 'pass' ? '통과' : tc.status === 'fail' ? '실패' : '블로킹'}
                  </span>
                )}

                {/* Processing Status Selector - admin only */}
                {isAdmin ? (
                  <Select value={tc.processingStatus} onValueChange={(v) => quickUpdateProcessing(tc.id, v as ProcessingStatus)}>
                    <SelectTrigger className={cn('w-24 h-7 text-xs border-0 rounded-full font-medium', PROCESSING_STATUS_COLORS[tc.processingStatus])}>
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
                    {tc.processingStatus === 'pending' ? '미처리' : tc.processingStatus === 'in_progress' ? '처리중' : tc.processingStatus === 'resolved' ? '처리완료' : '보류'}
                  </span>
                )}

                <div className="flex gap-1 shrink-0">
                  {tc.ticketLink && (
                    <a href={tc.ticketLink} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
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
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleExpand(tc.id)}>
                    {expanded.has(tc.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Expanded Detail */}
              {expanded.has(tc.id) && (
                <div className="border-t px-4 py-4 bg-slate-50 grid grid-cols-2 gap-4 text-sm">
                  {tc.steps && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">테스트 절차</p>
                      <p className="text-slate-700 whitespace-pre-wrap">{tc.steps}</p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {tc.expectedResult && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">기대 결과</p>
                        <p className="text-slate-700 whitespace-pre-wrap">{tc.expectedResult}</p>
                      </div>
                    )}
                    {tc.actualResult && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">실제 결과</p>
                        <p className="text-slate-700 whitespace-pre-wrap">{tc.actualResult}</p>
                      </div>
                    )}
                  </div>
                  {(tc.tester || tc.assignedDeveloper) && (
                    <div className="flex gap-4 col-span-2">
                      {tc.tester && <span className="text-xs text-slate-500">테스터: <strong className="text-slate-700">{tc.tester}</strong></span>}
                      {tc.assignedDeveloper && <span className="text-xs text-slate-500">담당 개발자: <strong className="text-slate-700">{tc.assignedDeveloper}</strong></span>}
                    </div>
                  )}
                  {tc.developerNote && (
                    <div className="col-span-2 bg-blue-50 rounded p-3">
                      <p className="text-xs font-semibold text-blue-600 mb-1">개발자 메모</p>
                      <p className="text-slate-700 whitespace-pre-wrap text-sm">{tc.developerNote}</p>
                    </div>
                  )}
                  {tc.images.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-slate-500 mb-2">첨부 이미지</p>
                      <div className="flex flex-wrap gap-2">
                        {tc.images.map((url) => (
                          <img
                            key={url}
                            src={url}
                            className="w-24 h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setLightbox(url)}
                            alt=""
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>테스트 케이스 삭제</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.title}"을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
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
        </div>
      )}
    </div>
  )
}
