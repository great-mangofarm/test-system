import { useState, useEffect, useRef, Fragment } from 'react'
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
import { IssueForm } from '@/components/IssueForm'
import { RichTextEditor } from '@/components/RichTextEditor'
import type { IssueFormData } from '@/components/IssueForm'
import { Checkbox } from '@/components/ui/checkbox'
import { Sheet, SheetHeader, SheetBody, SheetFooter } from '@/components/ui/sheet'
import { getProducts, getSuites, getTestCase, getTestCases, createTestCase, updateTestCase, deleteTestCase, getUsers } from '@/lib/firestore'
import { canViewByRole } from '@/lib/constants'
import { useAuth } from '@/store/auth'
import type { Product, TestSuite, TestCase, TestStatus, ProcessingStatus, UserProfile } from '@/types'
import {
  PRIORITY_LABELS, PRIORITY_COLORS, TEST_STATUS_LABELS, TEST_STATUS_COLORS,
  PROCESSING_STATUS_LABELS, PROCESSING_STATUS_COLORS,
} from '@/lib/constants'
import { toast, useToast } from '@/hooks/use-toast'
import { Plus, ChevronLeft, Pencil, Trash2, ExternalLink, Image, ChevronDown, ChevronUp, X, Link, Check, ImagePlus, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadImage } from '@/lib/firestore'

type FormData = Omit<TestCase, 'id' | 'suiteId' | 'productId' | 'createdAt' | 'updatedAt' | 'order'>

function ResultFeedback({
  tc, onLightbox, onUpdate,
}: {
  tc: TestCase
  onLightbox: (url: string) => void
  onUpdate: (patch: Partial<TestCase>) => void
}) {
  const [uploading, setUploading] = useState(false)
  const resultImages = tc.resultImages ?? []
  const resultNote = tc.resultNote ?? ''
  const { toast } = useToast()
  const areaRef = useRef<HTMLTextAreaElement>(null)

  async function uploadFiles(files: File[]) {
    if (!files.length) return
    setUploading(true)
    try {
      const urls = await Promise.all(files.map((f) => uploadImage(f)))
      const newImages = [...(tc.resultImages ?? []), ...urls]
      await updateTestCase(tc.id, { resultImages: newImages })
      onUpdate({ resultImages: newImages })
    } catch {
      toast({ variant: 'destructive', title: '이미지 업로드 실패' })
    } finally {
      setUploading(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    await uploadFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  // 붙여넣기 이미지 지원
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    function onPaste(e: ClipboardEvent) {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageFiles = items
        .filter((i) => i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null)
      if (imageFiles.length) {
        e.preventDefault()
        uploadFiles(imageFiles)
      }
    }
    el.addEventListener('paste', onPaste)
    return () => el.removeEventListener('paste', onPaste)
  }, [tc.resultImages])

  async function removeImage(url: string) {
    const newImages = (tc.resultImages ?? []).filter((u) => u !== url)
    await updateTestCase(tc.id, { resultImages: newImages })
    onUpdate({ resultImages: newImages })
  }

  async function handleBlur(e: React.FocusEvent<HTMLTextAreaElement>) {
    if (e.target.value !== resultNote) {
      await updateTestCase(tc.id, { resultNote: e.target.value })
      onUpdate({ resultNote: e.target.value })
      toast({ title: '피드백이 저장되었습니다' })
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div>
      <p className="text-xs text-amber-500 font-medium mb-1">테스트 결과 피드백</p>
      <textarea
        ref={areaRef}
        className="w-full text-sm text-slate-700 bg-white border rounded-md px-3 py-2 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[60px]"
        placeholder="테스트 결과에 대한 피드백을 입력하세요... (Ctrl+V로 이미지 붙여넣기 가능)"
        defaultValue={resultNote}
        onFocus={(e) => autoResize(e.target)}
        onChange={(e) => autoResize(e.target)}
        onBlur={handleBlur}
      />
      <div className="flex flex-wrap gap-2 mt-2">
        {resultImages.map((url) => (
          <div key={url} className="relative group">
            <img src={url}
              className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
              onClick={() => onLightbox(url)} alt="" />
            <button
              type="button"
              onClick={() => removeImage(url)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex"
            ><X className="w-3 h-3" /></button>
          </div>
        ))}
        <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-colors cursor-pointer">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
          <span className="text-xs mt-1">{uploading ? '업로드중' : '추가'}</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
    </div>
  )
}

// 인라인 편집용 자동 높이 textarea — IIFE 밖에 정의해야 React가 동일 컴포넌트로 인식, 포커스 유지
function InlineAutoArea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (val: string) => void
  placeholder?: string
}) {
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  return (
    <textarea
      ref={(el) => { if (el) autoResize(el) }}
      className="w-full text-sm bg-white border rounded-md px-3 py-2 leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none overflow-hidden min-h-[60px]"
      placeholder={placeholder}
      value={value}
      onChange={(e) => { onChange(e.target.value); autoResize(e.target) }}
    />
  )
}

function formatDate(iso: string) {
  if (!iso) return '-'
  return iso.slice(0, 10)
}

export default function TestCasesPage() {
  const { productId, suiteId } = useParams<{ productId: string; suiteId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'developer'
  const canEditStatus = user?.role === 'admin' || user?.role === 'developer'
  const [product, setProduct] = useState<Product | null>(null)
  const [suite, setSuite] = useState<TestSuite | null>(null)
  const [cases, setCases] = useState<TestCase[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TestCase | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TestCase | null>(null)
  const [deleteJiraToo, setDeleteJiraToo] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<string | null>(null)
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
  const [hideCompleted, setHideCompleted] = useState(true)

  useEffect(() => { load() }, [productId, suiteId])

  // 탭 포커스 시 자동 갱신
  useEffect(() => {
    function onFocus() { load() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [productId, suiteId])

  // 60초마다 로딩 표시 없이 조용히 목록 갱신
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!productId || !suiteId) return
      try {
        const [prods, suitesData, casesData, usersData] = await Promise.all([
          getProducts(), getSuites(productId), getTestCases(suiteId), getUsers(),
        ])
        setProduct(prods.find((p) => p.id === productId) ?? null)
        setSuite(suitesData.find((s) => s.id === suiteId) ?? null)
        setCases(casesData)
        setUsers(usersData)
      } catch { /* 백그라운드 실패는 무시 */ }
    }, 60000)
    return () => clearInterval(timer)
  }, [productId, suiteId])


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

  // 역할 노출 제어: 권한 없는 사용자가 URL로 직접 접근하면 홈으로 차단
  useEffect(() => {
    if (loading || !user) return
    if (!product && !suite) return
    const allowed = canViewByRole(product?.visibleRoles, user.role) && canViewByRole(suite?.visibleRoles, user.role)
    if (!allowed) navigate('/', { replace: true })
  }, [loading, user, product, suite, navigate])

  const isIssueSuite = suite?.type === 'dev'

  const areas = Array.from(new Set(cases.map((c) => c.area).filter(Boolean)))

  const developers = Array.from(new Set(cases.map((c) => c.assignedDeveloper).filter(Boolean)))

  const filtered = cases.filter((c) => {
    if (hideCompleted) {
      if (isIssueSuite && c.processingStatus === 'resolved') return false
      if (!isIssueSuite && c.status === 'pass' && c.processingStatus === 'resolved') return false
    }
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
    resolved: cases.filter((c) => c.processingStatus === 'resolved').length,
  }

  function toggleExpand(id: string) {
    const willExpand = !expanded.has(id)
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    if (willExpand) {
      // 아코디언 열 때 해당 항목 최신 데이터 조회
      getTestCase(id).then((latest) => {
        if (latest) {
          setCases((prev) => prev.map((c) => c.id === id ? latest : c))
          if (isAdmin) startInlineEdit(latest)
        } else {
          if (isAdmin) {
            const tc = cases.find((c) => c.id === id)
            if (tc) startInlineEdit(tc)
          }
        }
      }).catch(() => {
        if (isAdmin) {
          const tc = cases.find((c) => c.id === id)
          if (tc) startInlineEdit(tc)
        }
      })
    } else if (inlineEditId === id) {
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
          reporterEmail: user?.email || undefined,
          startDate: data.startDate || undefined,
          dueDate: data.dueDate || undefined,
          // 이슈트래커 URL을 기획서링크로 전송
          planningLink: issueTrackerUrl || undefined,
          images: data.images && data.images.length > 0 ? data.images : undefined,
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
        resultNote: '',
        resultImages: [],
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

  async function handleIssueSave(data: IssueFormData, jiraFields: { issueType: string }) {
    if (!productId || !suiteId) return
    const order = cases.length > 0 ? Math.max(...cases.map((c) => c.order)) + 1 : 0

    // 1. Firestore 이슈 먼저 생성 → ID 확보
    const newId = await createTestCase({
      recordType: 'issue',
      area: data.area,
      title: data.title,
      priority: data.priority,
      assignedDeveloper: data.assignedDeveloper,
      processingStatus: data.processingStatus,
      ticketLink: data.ticketLink,
      background: data.background,
      requirements: data.requirements,
      figmaLink: data.figmaLink,
      featureSpec: data.featureSpec,
      devChangelog: '',
      testChecklist: data.testChecklistItems
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((text) => ({ text, checked: false })),
      testProgressNote: '',
      startDate: data.startDate,
      dueDate: data.dueDate,
      // 테스트케이스 필드 빈값
      status: 'not_tested',
      steps: data.background,
      expectedResult: '',
      actualResult: '',
      developerNote: '',
      tester: '',
      images: [],
      resultNote: '',
      resultImages: [],
      planningLink: '',
      suiteId,
      productId,
      order,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // 2. 이슈트래커 URL 생성
    const issueTrackerUrl = `${window.location.origin}/products/${productId}/suites/${suiteId}#${newId}`

    // 3. Jira 티켓 생성 (개발요청 전용 필드로 직접 호출)
    const jiraProjectKey = product?.jiraProjectKey
    let jiraUrl: string | null = null
    if (jiraProjectKey) {
      try {
        const reporterName = user ? [user.team, user.displayName].filter(Boolean).join(' ') : undefined
        let assigneeAccountId: string | undefined
        if (data.assignedDeveloper) {
          const assigneeUser = users.find((u) => u.displayName === data.assignedDeveloper)
          if (assigneeUser?.email) {
            const r = await fetch(`/api/jira-users?email=${encodeURIComponent(assigneeUser.email)}`)
            if (r.ok) {
              const d = await r.json()
              if (d?.accountId) assigneeAccountId = d.accountId
            }
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
            issueType: jiraFields.issueType,
            assigneeAccountId: assigneeAccountId || null,
            reporterName: reporterName || undefined,
            reporterEmail: user?.email || undefined,
            startDate: data.startDate || undefined,
            dueDate: data.dueDate || undefined,
            planningLink: issueTrackerUrl || undefined,
            recordType: 'issue',
            background: data.background,
            requirements: data.requirements,
            figmaLink: data.figmaLink,
            featureSpec: data.featureSpec,
          }),
        })
        const resJson = await res.json()
        if (res.ok) jiraUrl = resJson.issueUrl
        else toast({ variant: 'destructive', title: 'Jira 티켓 생성 실패', description: JSON.stringify(resJson.error ?? resJson) })
      } catch (e) {
        toast({ variant: 'destructive', title: 'Jira 티켓 생성 실패', description: String(e) })
      }
    }

    // 4. Jira 티켓 URL 업데이트
    if (jiraUrl) {
      await updateTestCase(newId, { ticketLink: jiraUrl })
      toast({ title: '등록 완료 · Jira 티켓 생성됨' })
    } else {
      toast({ title: '등록 완료 (Jira 티켓 미생성)' })
    }

    setDialogOpen(false)
    await load()
  }

  function extractJiraKey(ticketLink: string): string | null {
    // https://xxx.atlassian.net/browse/EPC-42 → EPC-42
    const match = ticketLink.match(/\/browse\/([A-Z]+-\d+)/)
    return match ? match[1] : null
  }

  const [jiraRetrying, setJiraRetrying] = useState<string | null>(null)
  const [issueImageUploading, setIssueImageUploading] = useState<string | null>(null)
  const [drawerTcId, setDrawerTcId] = useState<string | null>(null)
  const drawerTc = cases.find((c) => c.id === drawerTcId) ?? null

  function openDrawer(id: string) {
    setDrawerTcId(id)
    getTestCase(id).then((latest) => {
      if (latest) {
        setCases((prev) => prev.map((c) => c.id === id ? latest : c))
        startInlineEdit(latest)
      } else {
        const tc = cases.find((c) => c.id === id)
        if (tc) startInlineEdit(tc)
      }
    }).catch(() => {
      const tc = cases.find((c) => c.id === id)
      if (tc) startInlineEdit(tc)
    })
  }

  function closeDrawer() {
    setDrawerTcId(null)
    setInlineEditId(null)
    setInlineForm({})
  }

  async function retryCreateJira(tc: TestCase) {
    if (!product?.jiraProjectKey) return
    setJiraRetrying(tc.id)
    try {
      const issueTrackerUrl = `${window.location.origin}/products/${productId}/suites/${suiteId}#${tc.id}`
      let assigneeAccountId: string | undefined
      if (tc.assignedDeveloper) {
        const assigneeUser = users.find((u) => u.displayName === tc.assignedDeveloper)
        if (assigneeUser?.email) {
          const r = await fetch(`/api/jira-users?email=${encodeURIComponent(assigneeUser.email)}`)
          if (r.ok) { const d = await r.json(); if (d?.accountId) assigneeAccountId = d.accountId }
        }
      }
      const reporterName = user ? [user.team, user.displayName].filter(Boolean).join(' ') : undefined
      const res = await fetch('/api/jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectKey: product.jiraProjectKey,
          title: tc.title,
          area: tc.area,
          priority: tc.priority,
          issueType: '버그',
          assigneeAccountId: assigneeAccountId || null,
          reporterName: reporterName || undefined,
          reporterEmail: user?.email || undefined,
          startDate: tc.startDate || undefined,
          dueDate: tc.dueDate || undefined,
          planningLink: issueTrackerUrl,
          recordType: tc.recordType ?? 'testcase',
          // 이슈 전용
          background: tc.background,
          requirements: tc.requirements,
          figmaLink: tc.figmaLink,
          featureSpec: tc.featureSpec,
          // 테스트케이스 전용
          steps: tc.steps,
          expectedResult: tc.expectedResult,
          actualResult: tc.actualResult,
        }),
      })
      const data = await res.json()
      if (res.ok && data.issueUrl) {
        await updateTestCase(tc.id, { ticketLink: data.issueUrl })
        setCases((prev) => prev.map((c) => c.id === tc.id ? { ...c, ticketLink: data.issueUrl } : c))
        toast({ title: 'Jira 티켓 생성됨', description: data.issueUrl })
      } else {
        toast({ variant: 'destructive', title: 'Jira 티켓 생성 실패', description: JSON.stringify(data.error ?? data) })
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Jira 티켓 생성 실패', description: String(e) })
    } finally {
      setJiraRetrying(null)
    }
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
    if (inlineEditId === id) setInlineForm((f) => ({ ...f, processingStatus: status }))
  }


  function startInlineEdit(tc: TestCase) {
    setInlineEditId(tc.id)
    setInlineForm({ ...tc })
  }

  async function saveInlineEdit(id: string) {
    const original = cases.find((c) => c.id === id)!
    const merged = { ...original, ...inlineForm }
    await updateTestCase(id, inlineForm)
    setCases((prev) => prev.map((c) => c.id === id ? merged : c))
    setInlineForm({ ...merged })
    toast({ title: '변경사항이 저장되었습니다' })

    // 담당자가 변경됐으면 Jira에도 반영
    if (inlineForm.assignedDeveloper !== undefined && inlineForm.assignedDeveloper !== original.assignedDeveloper && original.ticketLink) {
      const issueKey = extractJiraKey(original.ticketLink)
      const dev = users.find((u) => u.displayName === inlineForm.assignedDeveloper)
      if (issueKey && dev) {
        fetch('/api/jira-update-assignee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueKey, developerEmail: dev.email, jiraDisplayName: dev.jiraDisplayName ?? dev.displayName }),
        }).catch(() => {})
      }
    }
  }

  async function quickUpdateStatus(id: string, status: TestStatus) {
    await updateTestCase(id, { status })
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, status } : c))
    if (inlineEditId === id) setInlineForm((f) => ({ ...f, status }))
  }

  async function quickUpdateAssignedDeveloper(id: string, assignedDeveloper: string) {
    await updateTestCase(id, { assignedDeveloper })
    setCases((prev) => prev.map((c) => c.id === id ? { ...c, assignedDeveloper } : c))
    if (inlineEditId === id) setInlineForm((f) => ({ ...f, assignedDeveloper }))

    // Jira에도 반영
    const tc = cases.find((c) => c.id === id)
    if (tc?.ticketLink) {
      const issueKey = extractJiraKey(tc.ticketLink)
      const dev = users.find((u) => u.displayName === assignedDeveloper)
      if (issueKey && dev) {
        fetch('/api/jira-update-assignee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueKey, developerEmail: dev.email, jiraDisplayName: dev.jiraDisplayName ?? dev.displayName }),
        }).catch(() => {})
      }
    }
  }

  // 운영이슈 묶음은 '처리완료율', 테스트케이스 묶음은 '통과율'
  const completionRate = stats.total > 0
    ? Math.round(((isIssueSuite ? stats.resolved : stats.pass) / stats.total) * 100)
    : 0

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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} className="text-slate-400 hover:text-slate-600" title="새로고침">
              <RefreshCw className="w-4 h-4" />
            </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {isAdmin && (
              <DialogTrigger asChild>
                <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> {isIssueSuite ? '이슈 등록' : '테스트 추가'}</Button>
              </DialogTrigger>
            )}
            {dialogOpen && (
              isIssueSuite ? (
                <IssueForm
                  suiteId={suiteId!}
                  users={users}
                  areas={product?.areas}
                  jiraProjectKey={product?.jiraProjectKey}
                  currentUserDisplayName={user?.displayName}
                  onSave={handleIssueSave}
                  onCancel={() => setDialogOpen(false)}
                />
              ) : (
                <TestCaseForm
                  suiteId={suiteId!}
                  initial={editTarget ?? undefined}
                  users={users}
                  areas={product?.areas ?? []}
                  jiraProjectKey={editTarget ? undefined : product?.jiraProjectKey}
                  currentUserDisplayName={user?.displayName}
                  onSave={handleSave}
                  onCancel={() => setDialogOpen(false)}
                />
              )
            )}
          </Dialog>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b px-8 py-2.5 shrink-0">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-slate-500">전체 <strong className="text-slate-800">{stats.total}</strong></span>
          {isIssueSuite ? (
            <>
              <span className="text-emerald-700">처리완료 <strong>{stats.resolved}</strong></span>
              <span className="text-slate-500">미완료 <strong>{stats.total - stats.resolved}</strong></span>
            </>
          ) : (
            <>
              <span className="text-green-700">통과 <strong>{stats.pass}</strong></span>
              <span className="text-red-700">실패 <strong>{stats.fail}</strong></span>
              <span className="text-orange-700">블로킹 <strong>{stats.blocked}</strong></span>
              <span className="text-slate-500">미테스트 <strong>{stats.notTested}</strong></span>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="w-32 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className={cn('h-full transition-all', isIssueSuite ? 'bg-emerald-500' : 'bg-green-500')} style={{ width: `${completionRate}%` }} />
            </div>
            <span className="text-slate-600 font-medium text-sm">{completionRate}%</span>
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
            <SelectItem value="dev_deployed">개발배포</SelectItem>
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
        <label className="flex items-center gap-1.5 ml-auto cursor-pointer select-none text-xs text-slate-500 hover:text-slate-700">
          <Checkbox checked={hideCompleted} onChange={setHideCompleted} />
          완료 이슈 숨기기
        </label>
        <span className="text-xs text-slate-400">{filtered.length}건</span>
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
              {isIssueSuite ? (
                <tr className="text-xs text-slate-600 font-semibold whitespace-nowrap">
                  <th className="px-4 py-3 text-left w-20">ID</th>
                  <th className="px-4 py-3 text-left w-24">영역</th>
                  <th className="px-4 py-3 text-left w-16">우선순위</th>
                  <th className="px-4 py-3 text-left">제목</th>
                  <th className="px-4 py-3 text-left w-28">담당개발자</th>
                  <th className="px-4 py-3 text-left w-28">처리상태</th>
                  <th className="px-4 py-3 text-left w-24">등록일</th>
                  <th className="px-4 py-3 text-center w-10"></th>
                  <th className="px-4 py-3 text-center w-24"></th>
                </tr>
              ) : (
                <tr className="text-xs text-slate-600 font-semibold whitespace-nowrap">
                  <th className="px-4 py-3 text-left w-20">ID</th>
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
              )}
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filtered.map((tc) => (
                <Fragment key={tc.id}>
                  {/* Main Row */}
                  <tr
                    id={tc.id}
                    className={cn('hover:bg-slate-50 cursor-pointer transition-colors whitespace-nowrap', isIssueSuite ? (drawerTcId === tc.id ? 'bg-sky-50 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent') : (expanded.has(tc.id) ? 'bg-sky-50 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'))}
                    onClick={() => isIssueSuite ? openDrawer(tc.id) : toggleExpand(tc.id)}
                  >
                    <td className="px-4 py-2.5" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`TC-${String(tc.order + 1).padStart(3, '0')}`); toast({ title: '복사됨' }) }}>
                      <span className="text-xs font-mono text-slate-500 hover:text-primary cursor-pointer" title="클릭하여 복사">
                        TC-{String(tc.order + 1).padStart(3, '0')}
                      </span>
                    </td>
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
                      {!isIssueSuite && tc.tester && (
                        <div className="text-xs text-slate-400 mt-0.5">등록자: {tc.tester}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {isIssueSuite ? (
                        canEditStatus ? (
                          <Select value={tc.assignedDeveloper || '__none__'} onValueChange={(v) => quickUpdateAssignedDeveloper(tc.id, v === '__none__' ? '' : v)}>
                            <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {users.map((u) => <SelectItem key={u.uid} value={u.displayName}>{u.displayName}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm text-slate-600">{tc.assignedDeveloper || <span className="text-slate-300">—</span>}</span>
                        )
                      ) : (
                        <span className="text-sm text-slate-600 whitespace-nowrap">{tc.assignedDeveloper || <span className="text-slate-300">—</span>}</span>
                      )}
                    </td>
                    {!isIssueSuite && (
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
                    )}
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {canEditStatus ? (
                        <Select value={tc.processingStatus} onValueChange={(v) => quickUpdateProcessing(tc.id, v as ProcessingStatus)}>
                          <SelectTrigger className={cn('w-24 h-7 text-xs border-0 rounded-full font-medium px-2', PROCESSING_STATUS_COLORS[tc.processingStatus])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">미처리</SelectItem>
                            <SelectItem value="in_progress">처리중</SelectItem>
                            <SelectItem value="dev_deployed">개발배포</SelectItem>
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
                        {isAdmin && !isIssueSuite && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tc)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(tc)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => isIssueSuite ? openDrawer(tc.id) : toggleExpand(tc.id)}>
                          {isIssueSuite ? <ChevronDown className="w-3.5 h-3.5" /> : expanded.has(tc.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Detail Row (테스트케이스만, 이슈는 드로어) */}
                  {!isIssueSuite && expanded.has(tc.id) && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={isIssueSuite ? 9 : 10} className="px-8 py-5 bg-sky-50 border-t border-sky-100 border-b-2 border-b-primary/30">
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
                            <div className="bg-slate-50 rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed min-h-[60px] cursor-default">
                              {value || <span className="text-slate-300">—</span>}
                            </div>
                          )

                          if (isIssueSuite) {
                            return (
                              <div className="space-y-4">
                                {/* 헤더 */}
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <button
                                      className="text-xs font-mono text-slate-500 hover:text-primary transition-colors shrink-0"
                                      title="클릭하여 복사"
                                      onClick={() => { navigator.clipboard.writeText(`TC-${String(tc.order + 1).padStart(3, '0')}`); toast({ title: '복사됨' }) }}
                                    >
                                      TC-{String(tc.order + 1).padStart(3, '0')}
                                    </button>
                                    {isEditing
                                      ? <Input className="h-7 text-sm font-medium" value={f.title ?? ''} onChange={(e) => setF('title', e.target.value)} />
                                      : <span className="text-sm font-semibold text-slate-800 truncate">{tc.title}</span>}
                                    <span className="text-xs text-slate-400 shrink-0">등록일 {formatDate(tc.createdAt)}</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    className={cn('h-7 text-xs transition-opacity shrink-0', isDirty ? 'opacity-100' : 'opacity-0 pointer-events-none')}
                                    onClick={() => saveInlineEdit(tc.id)}
                                  >
                                    <Check className="w-3 h-3 mr-1"/>변경사항 저장
                                  </Button>
                                </div>

                                {/* 메타 정보 (2컬럼) */}
                                <div className="grid grid-cols-2 gap-4">
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
                                    <p className="text-xs text-slate-400 mb-1">처리 상태</p>
                                    {canEditStatus ? (
                                      <Select value={tc.processingStatus} onValueChange={(v) => quickUpdateProcessing(tc.id, v as ProcessingStatus)}>
                                        <SelectTrigger className={cn('h-8 text-xs border-0 rounded-full font-medium', PROCESSING_STATUS_COLORS[tc.processingStatus])}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">미처리</SelectItem>
                                          <SelectItem value="in_progress">처리중</SelectItem>
                                          <SelectItem value="dev_deployed">개발배포</SelectItem>
                                          <SelectItem value="resolved">처리완료</SelectItem>
                                          <SelectItem value="wont_fix">보류</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : <span className={cn('text-xs px-2 py-1 rounded-full font-medium', PROCESSING_STATUS_COLORS[tc.processingStatus])}>{PROCESSING_STATUS_LABELS[tc.processingStatus]}</span>}
                                  </div>
                                  <div className="col-span-2">
                                    <p className="text-xs text-slate-400 mb-1">Jira 티켓</p>
                                    {isEditing
                                      ? <div className="flex items-center gap-2">
                                          <Input className="h-8 text-sm min-w-0 flex-1" placeholder="https://..." value={f.ticketLink ?? ''} onChange={(e) => setF('ticketLink', e.target.value)} />
                                          {f.ticketLink
                                            ? <a href={f.ticketLink as string} target="_blank" rel="noopener noreferrer" className="shrink-0 text-slate-400 hover:text-primary"><ExternalLink className="w-4 h-4" /></a>
                                            : <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled={jiraRetrying === tc.id} onClick={() => retryCreateJira(tc)}>
                                                {jiraRetrying === tc.id ? <><Loader2 className="w-3 h-3 mr-1 animate-spin"/>생성 중...</> : 'Jira 티켓 생성'}
                                              </Button>}
                                        </div>
                                      : tc.ticketLink
                                        ? <a href={tc.ticketLink} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1 text-sm hover:underline break-all"><ExternalLink className="w-3 h-3 shrink-0"/>{tc.ticketLink}</a>
                                        : <span className="text-slate-300 text-sm">—</span>}
                                  </div>
                                </div>

                                {/* 개요 */}
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">개요</p>
                                  <RichTextEditor
                                    value={(f.background as string) ?? ''}
                                    onChange={(v) => setF('background', v)}
                                    placeholder="프로젝트 배경 및 개발 목적"
                                    readOnly={!isAdmin}
                                  />
                                </div>

                                {/* 범위 및 요구사항 */}
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">범위 및 요구사항</p>
                                  <RichTextEditor
                                    value={(f.requirements as string) ?? ''}
                                    onChange={(v) => setF('requirements', v)}
                                    placeholder="요구사항 및 범위"
                                    readOnly={!isAdmin}
                                  />
                                </div>

                                {/* 기능/화면 정의 */}
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1">피그마 링크</p>
                                    {isAdmin
                                      ? <Input className="h-8 text-sm" placeholder="https://www.figma.com/..." value={(f.figmaLink as string) ?? ''} onChange={(e) => setF('figmaLink', e.target.value)} />
                                      : tc.figmaLink
                                        ? <a href={tc.figmaLink} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1 text-sm hover:underline break-all"><ExternalLink className="w-3 h-3 shrink-0"/>{tc.figmaLink}</a>
                                        : <span className="text-slate-300 text-sm">—</span>}
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1">기능 / 화면 정의</p>
                                    <RichTextEditor
                                      value={(f.featureSpec as string) ?? ''}
                                      onChange={(v) => setF('featureSpec', v)}
                                      placeholder="화면 구성 및 기능 상세 정의"
                                      readOnly={!isAdmin}
                                    />
                                  </div>
                                </div>

                                {/* 개발 변경 내역 */}
                                <div>
                                  <p className="text-xs text-blue-500 font-medium mb-1">개발 변경 내역</p>
                                  <RichTextEditor
                                    value={tc.devChangelog ?? ''}
                                    onChange={async (v) => {
                                      await updateTestCase(tc.id, { devChangelog: v })
                                      setCases((prev) => prev.map((c) => c.id === tc.id ? { ...c, devChangelog: v } : c))
                                    }}
                                    placeholder="개발 변경 내역을 입력하세요..."
                                    readOnly={!canEditStatus}
                                  />
                                </div>

                                {/* 테스트 체크리스트 */}
                                <div>
                                  <p className="text-xs text-emerald-600 font-medium mb-2">테스트 체크리스트</p>
                                  {(tc.testChecklist && tc.testChecklist.length > 0) ? (
                                    <div className="space-y-1.5">
                                      {tc.testChecklist.map((item, idx) => (
                                        <label key={idx} className="flex items-start gap-2 cursor-pointer group">
                                          <Checkbox
                                            checked={item.checked}
                                            onChange={async (checked: boolean) => {
                                              const updated = tc.testChecklist!.map((it, i) =>
                                                i === idx ? { ...it, checked } : it
                                              )
                                              await updateTestCase(tc.id, { testChecklist: updated })
                                              setCases((prev) => prev.map((c) => c.id === tc.id ? { ...c, testChecklist: updated } : c))
                                            }}
                                            className="mt-0.5"
                                          />
                                          <span className={cn('text-sm leading-relaxed', item.checked ? 'line-through text-slate-400' : 'text-slate-700')}>
                                            {item.text}
                                          </span>
                                        </label>
                                      ))}
                                      <p className="text-xs text-slate-400 pt-1">
                                        {tc.testChecklist.filter((i) => i.checked).length} / {tc.testChecklist.length} 완료
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-300">—</p>
                                  )}
                                </div>

                                {/* 테스트 진행사항 */}
                                <div>
                                  <p className="text-xs text-amber-500 font-medium mb-1">테스트 진행사항</p>
                                  <RichTextEditor
                                    value={(f.testProgressNote as string) ?? ''}
                                    onChange={(v) => setF('testProgressNote', v)}
                                    placeholder="테스트 진행사항 입력"
                                    readOnly={!isAdmin}
                                  />
                                </div>

                                {/* 첨부 이미지 */}
                                <div>
                                  <p className="text-xs text-slate-400 font-medium mb-2">첨부 이미지 {(tc.images ?? []).length > 0 && `(${tc.images.length})`}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {(tc.images ?? []).map((url, i) => (
                                      <div key={i} className="relative group">
                                        <img
                                          src={url}
                                          alt=""
                                          className="w-20 h-20 object-cover rounded-md border cursor-pointer hover:opacity-80"
                                          onClick={() => setLightbox(url)}
                                        />
                                        <button
                                          className="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow p-0.5 hidden group-hover:flex text-slate-400 hover:text-destructive"
                                          onClick={async () => {
                                            const updated = tc.images.filter((_, j) => j !== i)
                                            await updateTestCase(tc.id, { images: updated })
                                            setCases((prev) => prev.map((c) => c.id === tc.id ? { ...c, images: updated } : c))
                                          }}
                                        ><X className="w-3 h-3" /></button>
                                      </div>
                                    ))}
                                    <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-md cursor-pointer hover:border-primary/50 hover:bg-slate-50 transition-colors">
                                      {issueImageUploading === tc.id
                                        ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                        : <><ImagePlus className="w-5 h-5 text-slate-300 mb-1" /><span className="text-xs text-slate-400">추가</span></>}
                                      <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                                        const files = Array.from(e.target.files ?? [])
                                        if (!files.length) return
                                        setIssueImageUploading(tc.id)
                                        try {
                                          const urls = await Promise.all(files.map((f) => uploadImage(f)))
                                          const updated = [...(tc.images ?? []), ...urls]
                                          await updateTestCase(tc.id, { images: updated })
                                          setCases((prev) => prev.map((c) => c.id === tc.id ? { ...c, images: updated } : c))
                                        } catch {
                                          toast({ variant: 'destructive', title: '이미지 업로드 실패' })
                                        } finally {
                                          setIssueImageUploading(null)
                                          e.target.value = ''
                                        }
                                      }} />
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )
                          }

                          return (
                          <div className="space-y-3">
                            {/* 헤더 */}
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <button
                                  className="text-xs font-mono text-slate-500 hover:text-primary transition-colors shrink-0"
                                  title="클릭하여 복사"
                                  onClick={() => { navigator.clipboard.writeText(`TC-${String(tc.order + 1).padStart(3, '0')}`); toast({ title: '복사됨' }) }}
                                >
                                  TC-{String(tc.order + 1).padStart(3, '0')}
                                </button>
                                {isEditing
                                  ? <Input className="h-7 text-sm font-medium" value={f.title ?? ''} onChange={(e) => setF('title', e.target.value)} />
                                  : <span className="text-sm font-semibold text-slate-800 truncate">{tc.title}</span>}
                                <span className="text-xs text-slate-400 shrink-0">등록일 {formatDate(tc.createdAt)}</span>
                              </div>
                              <Button
                                size="sm"
                                className={cn('h-7 text-xs transition-opacity shrink-0', isDirty ? 'opacity-100' : 'opacity-0 pointer-events-none')}
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
                                  {canEditStatus ? (
                                    <Select value={(isEditing ? f.processingStatus : tc.processingStatus) as string} onValueChange={(v) => isEditing ? setF('processingStatus', v) : quickUpdateProcessing(tc.id, v as ProcessingStatus)}>
                                      <SelectTrigger className={cn('h-8 text-xs border-0 rounded-full font-medium', PROCESSING_STATUS_COLORS[(isEditing ? f.processingStatus : tc.processingStatus) as ProcessingStatus])}><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">미처리</SelectItem>
                                        <SelectItem value="in_progress">처리중</SelectItem>
                                        <SelectItem value="dev_deployed">개발배포</SelectItem>
                                        <SelectItem value="resolved">처리완료</SelectItem>
                                        <SelectItem value="wont_fix">보류</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : <span className={cn('text-xs px-2 py-1 rounded-full font-medium', PROCESSING_STATUS_COLORS[tc.processingStatus])}>{PROCESSING_STATUS_LABELS[tc.processingStatus]}</span>}
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400 mb-1">티켓 링크</p>
                                  {isEditing
                                    ? <div className="flex items-center gap-2">
                                        <Input className="h-8 text-sm min-w-0 flex-1" placeholder="https://..." value={f.ticketLink ?? ''} onChange={(e) => setF('ticketLink', e.target.value)} />
                                        {f.ticketLink
                                          ? <a href={f.ticketLink as string} target="_blank" rel="noopener noreferrer" className="shrink-0 text-slate-400 hover:text-primary"><ExternalLink className="w-4 h-4" /></a>
                                          : <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled={jiraRetrying === tc.id} onClick={() => retryCreateJira(tc)}>
                                              {jiraRetrying === tc.id ? <><Loader2 className="w-3 h-3 mr-1 animate-spin"/>생성 중...</> : 'Jira 티켓 생성'}
                                            </Button>}
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
                                    ? <InlineAutoArea value={(f.steps as string) ?? ''} onChange={(v) => setF('steps', v)} placeholder={"1. 앱 실행\n2. 버튼 클릭"} />
                                    : <ReadBox value={tc.steps} />}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1">기대 결과</p>
                                    {isEditing
                                      ? <InlineAutoArea value={(f.expectedResult as string) ?? ''} onChange={(v) => setF('expectedResult', v)} />
                                      : <ReadBox value={tc.expectedResult} />}
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-400 mb-1">실제 결과</p>
                                    {isEditing
                                      ? <InlineAutoArea value={(f.actualResult as string) ?? ''} onChange={(v) => setF('actualResult', v)} />
                                      : <ReadBox value={tc.actualResult} />}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs text-blue-500 font-medium mb-1">개발자 코멘트</p>
                                  {isEditing ? (
                                    <InlineAutoArea value={(f.developerNote as string) ?? ''} onChange={(v) => setF('developerNote', v)} placeholder="처리 내용, 수정 사항 등" />
                                  ) : canEditStatus ? (
                                    <textarea
                                      className="w-full text-sm text-slate-700 bg-white border rounded-md px-3 py-2 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[60px]"
                                      placeholder="코멘트를 입력하세요..."
                                      defaultValue={tc.developerNote}
                                      onFocus={(e) => ar(e.target)}
                                      onChange={(e) => ar(e.target)}
                                      onBlur={async (e) => {
                                        const newVal = e.target.value
                                        if (newVal === (tc.developerNote ?? '')) return
                                        await updateTestCase(tc.id, { developerNote: newVal })
                                        setCases((prev) => prev.map((c) => c.id === tc.id ? { ...c, developerNote: newVal } : c))
                                        toast({ title: '코멘트가 저장되었습니다' })
                                      }}
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

                                {/* 테스트 결과 피드백 */}
                                {(canEditStatus || tc.resultNote || (tc.resultImages ?? []).length > 0) && (
                                  canEditStatus ? (
                                    <ResultFeedback
                                      tc={tc}
                                      onLightbox={setLightbox}
                                      onUpdate={(patch) => setCases((prev) => prev.map((c) => c.id === tc.id ? { ...c, ...patch } : c))}
                                    />
                                  ) : (
                                    <div>
                                      <p className="text-xs text-amber-500 font-medium mb-1">테스트 결과 피드백</p>
                                      <div className="bg-slate-50 rounded-md border border-slate-100 px-3 py-2 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                                        {tc.resultNote || <span className="text-slate-300">—</span>}
                                      </div>
                                      {(tc.resultImages ?? []).length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {(tc.resultImages ?? []).map((url) => (
                                            <img key={url} src={url}
                                              className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                                              onClick={() => setLightbox(url)} alt="" />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )
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
      {/* ── 이슈 드로어 ── */}
      {(() => {
        const tc = drawerTc
        if (!tc) return null
        const isEditing = inlineEditId === tc.id
        const f = isEditing ? inlineForm : tc
        const setF = (key: keyof TestCase, val: string) => setInlineForm((p) => ({ ...p, [key]: val }))
        const isDirty = isEditing && Object.keys(inlineForm).some((k) => {
          const key = k as keyof TestCase
          return (inlineForm as unknown as Record<string, unknown>)[key] !== (tc as unknown as Record<string, unknown>)[key]
        })
        return (
          <Sheet open={!!drawerTcId} onClose={closeDrawer}>
            <SheetHeader onClose={closeDrawer}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono text-slate-400 shrink-0">TC-{String(tc.order + 1).padStart(3, '0')}</span>
                <Input className="h-7 text-sm font-semibold border-transparent hover:border-slate-200 focus:border-primary flex-1" value={(f.title as string) ?? ''} onChange={(e) => setF('title', e.target.value)} readOnly={!isAdmin} />
                <span className="text-xs text-slate-400 shrink-0">등록일 {formatDate(tc.createdAt)}</span>
              </div>
            </SheetHeader>

            <SheetBody className="px-6 py-5 space-y-5">
              {/* 메타 정보 */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">영역</p>
                  {isAdmin ? <Input className="h-8 text-sm" value={(f.area as string) ?? ''} onChange={(e) => setF('area', e.target.value)} />
                    : <p className="text-sm font-medium text-slate-700">{tc.area || '—'}</p>}
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">우선순위</p>
                  <Select value={(f.priority as string)} onValueChange={(v) => setF('priority', v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">긴급</SelectItem>
                      <SelectItem value="high">높음</SelectItem>
                      <SelectItem value="medium">보통</SelectItem>
                      <SelectItem value="low">낮음</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">담당 개발자</p>
                  <Select value={(f.assignedDeveloper as string) || '__none__'} onValueChange={(v) => setF('assignedDeveloper', v === '__none__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {users.map((u) => <SelectItem key={u.uid} value={u.displayName}>{u.displayName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">처리 상태</p>
                  <Select value={tc.processingStatus} onValueChange={(v) => quickUpdateProcessing(tc.id, v as ProcessingStatus)}>
                    <SelectTrigger className={cn('h-8 text-xs border-0 rounded-full font-medium', PROCESSING_STATUS_COLORS[tc.processingStatus])}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">미처리</SelectItem>
                      <SelectItem value="in_progress">처리중</SelectItem>
                      <SelectItem value="dev_deployed">개발배포</SelectItem>
                      <SelectItem value="resolved">처리완료</SelectItem>
                      <SelectItem value="wont_fix">보류</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">시작일</p>
                  <input type="date" className="h-8 w-full px-3 text-sm border rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={(f.startDate as string) ?? ''} onChange={(e) => setF('startDate', e.target.value)} readOnly={!isAdmin} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">기한</p>
                  <input type="date" className="h-8 w-full px-3 text-sm border rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={(f.dueDate as string) ?? ''} onChange={(e) => setF('dueDate', e.target.value)} readOnly={!isAdmin} />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 mb-1">Jira 티켓</p>
                  <div className="flex items-center gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="https://..." value={(f.ticketLink as string) ?? ''} onChange={(e) => setF('ticketLink', e.target.value)} />
                    {f.ticketLink
                      ? <a href={f.ticketLink as string} target="_blank" rel="noopener noreferrer" className="shrink-0 text-slate-400 hover:text-primary"><ExternalLink className="w-4 h-4" /></a>
                      : <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" disabled={jiraRetrying === tc.id} onClick={() => retryCreateJira(tc)}>
                          {jiraRetrying === tc.id ? <><Loader2 className="w-3 h-3 mr-1 animate-spin"/>생성 중...</> : 'Jira 티켓 생성'}
                        </Button>}
                  </div>
                </div>
              </div>

              {/* 콘텐츠 2컬럼 */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">개요</p>
                    <RichTextEditor value={(f.background as string) ?? ''} onChange={(v) => setF('background', v)} placeholder="프로젝트 배경 및 개발 목적" readOnly={!isAdmin} className="[&_.tiptap]:min-h-[140px]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">기능 / 화면 정의</p>
                    {isAdmin && <div className="mb-1">
                      <p className="text-xs text-slate-400">피그마 링크</p>
                      <Input className="h-7 text-xs mb-1" placeholder="https://www.figma.com/..." value={(f.figmaLink as string) ?? ''} onChange={(e) => setF('figmaLink', e.target.value)} />
                    </div>}
                    {!isAdmin && tc.figmaLink && <a href={tc.figmaLink} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1 text-xs mb-1 hover:underline"><ExternalLink className="w-3 h-3"/>{tc.figmaLink}</a>}
                    <RichTextEditor value={(f.featureSpec as string) ?? ''} onChange={(v) => setF('featureSpec', v)} placeholder="화면 구성 및 기능 상세 정의" readOnly={!isAdmin} className="[&_.tiptap]:min-h-[140px]" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">범위 및 요구사항</p>
                    <RichTextEditor value={(f.requirements as string) ?? ''} onChange={(v) => setF('requirements', v)} placeholder="요구사항 및 범위" readOnly={!isAdmin} className="[&_.tiptap]:min-h-[140px]" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium mb-2">테스트 체크리스트</p>
                    {(tc.testChecklist && tc.testChecklist.length > 0) ? (
                      <div className="space-y-1.5">
                        {tc.testChecklist.map((item, idx) => (
                          <label key={idx} className="flex items-start gap-2 cursor-pointer">
                            <Checkbox checked={item.checked} onChange={async (checked) => {
                              const updated = tc.testChecklist!.map((it, i) => i === idx ? { ...it, checked } : it)
                              await updateTestCase(tc.id, { testChecklist: updated })
                              setCases((prev) => prev.map((c) => c.id === tc.id ? { ...c, testChecklist: updated } : c))
                            }} className="mt-0.5" />
                            <span className={cn('text-sm leading-relaxed', item.checked ? 'line-through text-slate-400' : 'text-slate-700')}>{item.text}</span>
                          </label>
                        ))}
                        <p className="text-xs text-slate-400 pt-1">{tc.testChecklist.filter((i) => i.checked).length} / {tc.testChecklist.length} 완료</p>
                      </div>
                    ) : <p className="text-sm text-slate-300">—</p>}
                  </div>
                  <div>
                    <p className="text-xs text-amber-500 font-medium mb-1">테스트 진행사항</p>
                    <RichTextEditor value={(f.testProgressNote as string) ?? ''} onChange={(v) => setF('testProgressNote', v)} placeholder="테스트 진행사항 입력" readOnly={!isAdmin} className="[&_.tiptap]:min-h-[100px]" />
                  </div>
                </div>
              </div>

              {/* 개발 변경 내역 (full width) */}
              <div>
                <p className="text-xs text-blue-500 font-medium mb-1">개발 변경 내역</p>
                <RichTextEditor
                  value={tc.devChangelog ?? ''}
                  onChange={() => { /* 타이핑 중엔 저장하지 않음 — blur 시 1회 저장 */ }}
                  onBlur={async (v) => {
                    if (v === (tc.devChangelog ?? '')) return
                    await updateTestCase(tc.id, { devChangelog: v })
                    setCases((prev) => prev.map((c) => c.id === tc.id ? { ...c, devChangelog: v } : c))
                    toast({ title: '개발 변경 내역 저장됨' })
                  }}
                  placeholder="개발 변경 내역을 입력하세요..." readOnly={!canEditStatus} className="[&_.tiptap]:min-h-[100px]" />
              </div>

              {/* 첨부 이미지 */}
              <div>
                <p className="text-xs text-slate-400 font-medium mb-2">첨부 이미지 {(tc.images ?? []).length > 0 && `(${tc.images.length})`}</p>
                <div className="flex flex-wrap gap-2">
                  {(tc.images ?? []).map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt="" className="w-20 h-20 object-cover rounded-md border cursor-pointer hover:opacity-80" onClick={() => setLightbox(url)} />
                      <button className="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow p-0.5 hidden group-hover:flex text-slate-400 hover:text-destructive"
                        onClick={async () => {
                          const updated = tc.images.filter((_, j) => j !== i)
                          await updateTestCase(tc.id, { images: updated })
                          setCases((prev) => prev.map((c) => c.id === tc.id ? { ...c, images: updated } : c))
                        }}><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <label className="w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-md cursor-pointer hover:border-primary/50 hover:bg-slate-50 transition-colors">
                    {issueImageUploading === tc.id ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      : <><ImagePlus className="w-5 h-5 text-slate-300 mb-1" /><span className="text-xs text-slate-400">추가</span></>}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                      const files = Array.from(e.target.files ?? [])
                      if (!files.length) return
                      setIssueImageUploading(tc.id)
                      try {
                        const urls = await Promise.all(files.map((file) => uploadImage(file)))
                        const updated = [...(tc.images ?? []), ...urls]
                        await updateTestCase(tc.id, { images: updated })
                        setCases((prev) => prev.map((c) => c.id === tc.id ? { ...c, images: updated } : c))
                      } catch {
                        toast({ variant: 'destructive', title: '이미지 업로드 실패' })
                      } finally {
                        setIssueImageUploading(null)
                        e.target.value = ''
                      }
                    }} />
                  </label>
                </div>
              </div>
            </SheetBody>

            <SheetFooter>
              <Button variant="outline" onClick={closeDrawer}>닫기</Button>
              <Button disabled={!isDirty} onClick={() => saveInlineEdit(tc.id)}>
                <Check className="w-3.5 h-3.5 mr-1" />변경사항 저장
              </Button>
            </SheetFooter>
          </Sheet>
        )
      })()}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteJiraToo(false) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>항목 삭제</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.title}"을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget?.ticketLink && extractJiraKey(deleteTarget.ticketLink) && (
            <label className="flex items-center gap-2 px-1 py-2 cursor-pointer select-none">
              <Checkbox checked={deleteJiraToo} onChange={setDeleteJiraToo} color="destructive" />
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
