import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import { ChangePasswordModal } from '@/components/ChangePasswordModal'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  getProducts, createProduct, updateProduct, deleteProduct,
  getSuites, createSuite, updateSuite, deleteSuite, reorderSuites, getSuiteStats,
  getQaGroups, createQaGroup, updateQaGroup, deleteQaGroup,
  type SuiteStats,
} from '@/lib/firestore'
import { ROLE_LABELS, VIEW_CONTROL_ROLES, canViewByRole } from '@/lib/constants'
import { useAuth, logout, deleteAccount } from '@/store/auth'
import type { Product, TestSuite, SuiteType, UserRole, QaGroup } from '@/types'
import {
  Plus, Package, ClipboardList, ArrowRight, Pencil, Trash2,
  LogOut, Users, KeyRound, ChevronDown, GripVertical, Wrench, X, Lock, Eye, EyeOff, Inbox,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// 일부 역할에게 가려진(=전체 공개가 아닌) 항목인지 판단 — admin 목록의 🔒 표시용
function isRoleRestricted(visibleRoles?: UserRole[]): boolean {
  return !!visibleRoles && VIEW_CONTROL_ROLES.some((r) => !visibleRoles.includes(r))
}

// 사용자별 저장된 순서(id 배열)대로 정렬. 순서에 없는 건 기존(Firestore order) 순서로 뒤에.
function applyProductOrder(list: Product[], order: string[]): Product[] {
  if (order.length === 0) return list
  return [...list].sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id)
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

// 노출 권한 체크박스 그룹 (다이얼로그 공용)
function VisibleRolesField({
  value, onChange,
}: {
  value: UserRole[]
  onChange: (roles: UserRole[]) => void
}) {
  function toggle(role: UserRole, checked: boolean) {
    onChange(checked ? [...value, role] : value.filter((r) => r !== role))
  }
  return (
    <div className="space-y-2">
      <Label>노출 권한 <span className="text-xs text-slate-400 font-normal">— 이 항목을 볼 수 있는 역할</span></Label>
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-slate-200 px-3 py-2.5">
        {VIEW_CONTROL_ROLES.map((role) => (
          <label key={role} className="flex items-center gap-1.5 cursor-pointer text-sm text-slate-700">
            <Checkbox checked={value.includes(role)} onChange={(c) => toggle(role, c)} />
            {ROLE_LABELS[role]}
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-400">관리자·개발자는 항상 볼 수 있습니다. 모두 해제하면 관리자·개발자만 보입니다.</p>
    </div>
  )
}

const SUITE_TYPE_LABELS: Record<SuiteType, string> = { qa: '테스트케이스', dev: '개발요청' }
const SUITE_TYPE_COLORS: Record<SuiteType, string> = {
  qa: 'bg-blue-50 text-blue-600 border-blue-100',
  dev: 'bg-orange-50 text-orange-600 border-orange-100',
}

function DonutChart({ stats, isIssue = false }: { stats: SuiteStats; isIssue?: boolean }) {
  const { pass, fail, blocked, notTested, total, resolved } = stats
  const size = 88
  const cx = size / 2, cy = size / 2
  const r = 34
  const circ = 2 * Math.PI * r
  // 운영이슈 묶음은 '처리완료율', 그 외는 '통과율'
  const rate = total > 0 ? Math.round(((isIssue ? resolved : pass) / total) * 100) : 0

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fill="#94a3b8">—</text>
      </svg>
    )
  }

  // 운영이슈: 처리완료 vs 미완료 2분할
  const segments = isIssue
    ? [
        { value: resolved, color: '#10b981' },
        { value: total - resolved, color: '#e2e8f0' },
      ]
    : [
        { value: pass, color: '#22c55e' },
        { value: fail, color: '#ef4444' },
        { value: blocked, color: '#f97316' },
        { value: notTested, color: '#e2e8f0' },
      ]

  let cumulative = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ
        const offset = -(cumulative / total) * circ
        cumulative += seg.value
        if (seg.value === 0) return null
        return (
          <circle
            key={i}
            r={r} cx={cx} cy={cy}
            fill="none"
            stroke={seg.color}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="15" fontWeight="700" fill="#334155">{rate}%</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#94a3b8">{isIssue ? '처리완료' : '통과율'}</text>
    </svg>
  )
}

type ProductDialog = { mode: 'create' | 'edit'; target?: Product }
type SuiteDialog = { mode: 'create' | 'edit'; target?: TestSuite }

// Sortable product item
function SortableProduct({
  product, selected, canManage, canReorder, restricted, onSelect, onEdit, onDelete,
}: {
  product: Product
  selected: boolean
  canManage: boolean
  canReorder: boolean
  restricted: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: product.id, disabled: !canReorder })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-2 mx-2 my-0.5 px-2 py-2 rounded-md cursor-pointer transition-colors',
        selected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-slate-50 text-slate-700',
        isDragging && 'opacity-50 shadow-lg'
      )}
      onClick={onSelect}
    >
      {canReorder && (
        <span
          {...attributes}
          {...listeners}
          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
      )}
      <Package className="w-4 h-4 shrink-0" />
      <span className="text-sm flex-1 truncate">{product.name}</span>
      {restricted && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
      {canManage && (
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
          <button className="p-0.5 rounded hover:bg-slate-200" onClick={(e) => { e.stopPropagation(); onEdit() }}>
            <Pencil className="w-3 h-3" />
          </button>
          <button className="p-0.5 rounded hover:bg-red-100 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete() }}>
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// Sortable suite item
function SortableSuite({
  suite, stats, canManage, restricted, hidden, onOpen, onEdit, onDelete, onToggleHide,
}: {
  suite: TestSuite
  stats?: SuiteStats
  canManage: boolean
  restricted: boolean
  hidden: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleHide: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: suite.id, disabled: !canManage })

  const s = stats
  const isIssue = suite.type === 'dev'  // 운영이슈 묶음: 통계 기준이 '처리완료'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group bg-white border rounded-xl px-4 py-4 hover:shadow-md transition-shadow cursor-pointer',
        isDragging && 'opacity-50 shadow-lg',
        hidden && 'opacity-70 border-dashed bg-slate-50/50'
      )}
      onClick={onOpen}
    >
      {/* 상단: 제목 + 도넛 차트 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {canManage && (
            <span
              {...attributes}
              {...listeners}
              className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing mt-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4" />
            </span>
          )}
          {suite.type === 'dev'
            ? <Wrench className="w-4 h-4 text-orange-500 shrink-0 mt-1" />
            : <ClipboardList className="w-4 h-4 text-primary shrink-0 mt-1" />
          }
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-slate-800">{suite.name}</p>
              <span className={cn('text-xs px-1.5 py-0.5 rounded border font-medium', SUITE_TYPE_COLORS[suite.type ?? 'qa'])}>
                {SUITE_TYPE_LABELS[suite.type ?? 'qa']}
              </span>
              {restricted && (
                <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-600 font-medium">
                  <Lock className="w-3 h-3" /> 제한
                </span>
              )}
              {hidden && (
                <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-500 font-medium">
                  <EyeOff className="w-3 h-3" /> 숨김
                </span>
              )}
              {suite.version && <span className="text-xs text-slate-400">{suite.version}</span>}
            </div>
            {s && s.total > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                처리완료 <span className="font-semibold text-slate-600">{s.resolved}</span> / 전체 <span className="font-semibold text-slate-600">{s.total}</span>
                {!isIssue && (
                  <>
                    <span className="mx-1.5 text-slate-200">|</span>
                    통과 <span className="font-semibold text-green-600">{s.pass}</span>
                    {s.fail > 0 && <> · 실패 <span className="font-semibold text-red-500">{s.fail}</span></>}
                    {s.blocked > 0 && <> · 블로킹 <span className="font-semibold text-orange-500">{s.blocked}</span></>}
                  </>
                )}
              </p>
            )}
            {s && s.total === 0 && <p className="text-xs text-slate-300 mt-1">항목 없음</p>}

            {/* 전체 상태 바 */}
            {s && s.total > 0 && (
              <div className="flex h-1.5 rounded-full overflow-hidden mt-2 gap-px bg-slate-100">
                {isIssue ? (
                  s.resolved > 0 && <div className="bg-emerald-500" style={{ flex: s.resolved }} />
                ) : (
                  <>
                    {s.pass > 0 && <div className="bg-green-500" style={{ flex: s.pass }} />}
                    {s.fail > 0 && <div className="bg-red-400" style={{ flex: s.fail }} />}
                    {s.blocked > 0 && <div className="bg-orange-400" style={{ flex: s.blocked }} />}
                    {s.notTested > 0 && <div className="bg-slate-200" style={{ flex: s.notTested }} />}
                  </>
                )}
                {isIssue && s.total - s.resolved > 0 && <div className="bg-slate-200" style={{ flex: s.total - s.resolved }} />}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400"
            title={hidden ? '내 화면에 다시 표시' : '내 화면에서 숨기기'}
            onClick={(e) => { e.stopPropagation(); onToggleHide() }}
          >
            {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          {canManage && (
            <div className="flex gap-0.5">
              <button className="p-1.5 rounded hover:bg-slate-100 text-slate-400"
                onClick={(e) => { e.stopPropagation(); onEdit() }}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded hover:bg-red-50 text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete() }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {s ? <DonutChart stats={s} isIssue={isIssue} /> : <div className="w-[88px] h-[88px] rounded-full border-[10px] border-slate-100 animate-pulse" />}
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
        </div>
      </div>

      {/* 영역별 진행도 */}
      {s && s.areas.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">영역별 진행도</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2.5">
            {s.areas.map((area) => {
              const done = isIssue ? area.resolved : area.pass
              const pct = area.total > 0 ? Math.round((done / area.total) * 100) : 0
              return (
                <div key={area.name}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-600 truncate max-w-[55%]">{area.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                      <span className="font-medium text-slate-600">{pct}%</span>
                      {!isIssue && area.fail > 0 && <span className="text-red-400">·{area.fail}실패</span>}
                      {!isIssue && area.blocked > 0 && <span className="text-orange-400">·{area.blocked}블</span>}
                    </span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
                    {isIssue ? (
                      area.resolved > 0 && <div className="bg-emerald-500" style={{ width: `${(area.resolved / area.total) * 100}%` }} />
                    ) : (
                      <>
                        {area.pass > 0 && <div className="bg-green-500" style={{ width: `${(area.pass / area.total) * 100}%` }} />}
                        {area.fail > 0 && <div className="bg-red-400" style={{ width: `${(area.fail / area.total) * 100}%` }} />}
                        {area.blocked > 0 && <div className="bg-orange-400" style={{ width: `${(area.blocked / area.total) * 100}%` }} />}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  // 콘텐츠(이슈/테스트케이스/QA) 편집 권한 — admin·pm·developer
  const isAdmin = user?.role === 'admin' || user?.role === 'pm' || user?.role === 'developer'
  // 프로덕트/묶음 구조 관리 — admin·pm (developer는 불가)
  const canManageProduct = user?.role === 'admin' || user?.role === 'pm'
  const canManageSuite = user?.role === 'admin' || user?.role === 'pm'
  const navigate = useNavigate()

  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [suites, setSuites] = useState<TestSuite[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingSuites, setLoadingSuites] = useState(false)

  const [productDialog, setProductDialog] = useState<ProductDialog | null>(null)
  const [productForm, setProductForm] = useState({ name: '', description: '', jiraProjectKeys: [] as string[], areas: [] as string[], visibleRoles: [...VIEW_CONTROL_ROLES] as UserRole[] })
  const [areaInput, setAreaInput] = useState('')
  const areaComposing = useRef(false)
  const [keyInput, setKeyInput] = useState('')
  const [productSaving, setProductSaving] = useState(false)
  const [deleteProduct_, setDeleteProduct_] = useState<Product | null>(null)

  const [suiteStats, setSuiteStats] = useState<Record<string, SuiteStats>>({})

  const [suiteDialog, setSuiteDialog] = useState<SuiteDialog | null>(null)
  const [suiteForm, setSuiteForm] = useState({ name: '', version: '', type: 'qa' as SuiteType, visibleRoles: [...VIEW_CONTROL_ROLES] as UserRole[] })
  const [suiteSaving, setSuiteSaving] = useState(false)
  const [deleteSuite_, setDeleteSuite_] = useState<TestSuite | null>(null)

  // QA 테스트 (배포예정 기능별)
  const [qaGroups, setQaGroups] = useState<QaGroup[]>([])
  const [qaDialog, setQaDialog] = useState<{ mode: 'create' | 'edit'; target?: QaGroup } | null>(null)
  const [qaForm, setQaForm] = useState({ name: '', deployDate: '' })
  const [qaSaving, setQaSaving] = useState(false)
  const [deleteQaGroup_, setDeleteQaGroup_] = useState<QaGroup | null>(null)

  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)

  // 사용자별(기기별) 묶음 숨김 설정 — localStorage 저장
  const [hiddenSuiteIds, setHiddenSuiteIds] = useState<Set<string>>(new Set())
  const [showHidden, setShowHidden] = useState(false)
  // 프로덕트 순서 — 사용자별(기기별) localStorage. 전역 아님.
  const [productOrder, setProductOrder] = useState<string[]>([])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // 묶음 숨김 + 프로덕트 순서 로드 (사용자 uid별 키)
  useEffect(() => {
    if (!user?.uid) { setHiddenSuiteIds(new Set()); setProductOrder([]); return }
    try {
      const raw = localStorage.getItem(`hiddenSuites:${user.uid}`)
      setHiddenSuiteIds(new Set(raw ? (JSON.parse(raw) as string[]) : []))
    } catch { setHiddenSuiteIds(new Set()) }
    try {
      const raw = localStorage.getItem(`productOrder:${user.uid}`)
      setProductOrder(raw ? (JSON.parse(raw) as string[]) : [])
    } catch { setProductOrder([]) }
  }, [user?.uid])

  function toggleSuiteHidden(id: string) {
    if (!user?.uid) return
    setHiddenSuiteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(`hiddenSuites:${user.uid}`, JSON.stringify([...next]))
      return next
    })
  }

  useEffect(() => { loadProducts() }, [])
  useEffect(() => {
    if (selectedProduct) { loadSuites(selectedProduct.id); loadQaGroups(selectedProduct.id) }
    else { setSuites([]); setQaGroups([]) }
  }, [selectedProduct])

  async function loadQaGroups(productId: string) {
    try { setQaGroups(await getQaGroups(productId)) } catch { setQaGroups([]) }
  }

  // QA 테스트 묶음 CRUD
  function openQaCreate() { setQaForm({ name: '', deployDate: '' }); setQaDialog({ mode: 'create' }) }
  function openQaEdit(g: QaGroup) { setQaForm({ name: g.name, deployDate: g.deployDate ?? '' }); setQaDialog({ mode: 'edit', target: g }) }
  async function handleQaSave() {
    if (!qaForm.name.trim() || !selectedProduct) return
    setQaSaving(true)
    try {
      if (qaDialog?.mode === 'edit' && qaDialog.target) {
        await updateQaGroup(qaDialog.target.id, { name: qaForm.name.trim(), deployDate: qaForm.deployDate })
        toast({ title: 'QA 테스트 수정 완료' })
      } else {
        await createQaGroup({ productId: selectedProduct.id, name: qaForm.name.trim(), deployDate: qaForm.deployDate }, qaGroups.length)
        toast({ title: 'QA 테스트 생성 완료' })
      }
      setQaDialog(null)
      await loadQaGroups(selectedProduct.id)
    } finally { setQaSaving(false) }
  }
  async function handleQaDelete() {
    if (!deleteQaGroup_ || !selectedProduct) return
    await deleteQaGroup(deleteQaGroup_.id)
    toast({ title: 'QA 테스트 삭제됨', variant: 'destructive' })
    setDeleteQaGroup_(null)
    await loadQaGroups(selectedProduct.id)
  }

  async function loadProducts() {
    setLoadingProducts(true)
    try {
      const list = await getProducts()
      setProducts(list)
      const firstVisible = list.find((p) => canViewByRole(p.visibleRoles, user?.role))
      if (firstVisible) setSelectedProduct((prev) => prev ?? firstVisible)
    } finally { setLoadingProducts(false) }
  }

  async function loadSuites(productId: string) {
    setLoadingSuites(true)
    try {
      const list = await getSuites(productId)
      setSuites(list)
      // 각 suite의 stats 병렬 로드
      const statsEntries = await Promise.all(
        list.map(async (s) => [s.id, await getSuiteStats(s.id)] as const)
      )
      setSuiteStats(Object.fromEntries(statsEntries))
    } finally { setLoadingSuites(false) }
  }

  // DnD — 프로덕트 순서는 사용자별(localStorage)
  function handleProductDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !user?.uid) return
    const visible = products.filter((p) => canViewByRole(p.visibleRoles, user?.role))
    const ordered = applyProductOrder(visible, productOrder)
    const oldIndex = ordered.findIndex((p) => p.id === active.id)
    const newIndex = ordered.findIndex((p) => p.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const ids = arrayMove(ordered, oldIndex, newIndex).map((p) => p.id)
    setProductOrder(ids)
    localStorage.setItem(`productOrder:${user.uid}`, JSON.stringify(ids))
  }

  async function handleSuiteDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = suites.findIndex((s) => s.id === active.id)
    const newIndex = suites.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(suites, oldIndex, newIndex)
    setSuites(reordered)
    await reorderSuites(reordered.map((s) => s.id))
  }

  // Product CRUD
  function openProductCreate() {
    setProductForm({ name: '', description: '', jiraProjectKeys: [], areas: [], visibleRoles: [...VIEW_CONTROL_ROLES] })
    setAreaInput(''); setKeyInput('')
    setProductDialog({ mode: 'create' })
  }
  function openProductEdit(p: Product) {
    const keys = p.jiraProjectKeys?.length ? p.jiraProjectKeys : (p.jiraProjectKey ? [p.jiraProjectKey] : [])
    setProductForm({ name: p.name, description: p.description, jiraProjectKeys: keys, areas: p.areas ?? [], visibleRoles: p.visibleRoles ?? [...VIEW_CONTROL_ROLES] })
    setAreaInput(''); setKeyInput('')
    setProductDialog({ mode: 'edit', target: p })
  }

  function addArea() {
    const trimmed = areaInput.trim()
    if (!trimmed || productForm.areas.includes(trimmed)) return
    setProductForm((f) => ({ ...f, areas: [...f.areas, trimmed] }))
    setAreaInput('')
  }
  function removeArea(area: string) {
    setProductForm((f) => ({ ...f, areas: f.areas.filter((a) => a !== area) }))
  }

  function addKey() {
    const trimmed = keyInput.trim().toUpperCase()
    if (!trimmed || productForm.jiraProjectKeys.includes(trimmed)) return
    setProductForm((f) => ({ ...f, jiraProjectKeys: [...f.jiraProjectKeys, trimmed] }))
    setKeyInput('')
  }
  function removeKey(k: string) {
    setProductForm((f) => ({ ...f, jiraProjectKeys: f.jiraProjectKeys.filter((x) => x !== k) }))
  }
  async function handleProductSave() {
    if (!productForm.name.trim()) return
    setProductSaving(true)
    try {
      // jiraProjectKey(대표) = 목록 첫 번째 — 이슈 Jira 티켓 생성에 사용(기존 동작 유지)
      const payload = { ...productForm, jiraProjectKey: productForm.jiraProjectKeys[0] ?? '', jiraProjectKeys: productForm.jiraProjectKeys }
      if (productDialog?.mode === 'edit' && productDialog.target) {
        await updateProduct(productDialog.target.id, payload)
        toast({ title: '프로덕트/프로젝트 수정 완료' })
      } else {
        await createProduct(payload, products.length)
        toast({ title: '프로덕트/프로젝트 추가 완료' })
      }
      setProductDialog(null)
      await loadProducts()
    } finally { setProductSaving(false) }
  }
  async function handleProductDelete() {
    if (!deleteProduct_) return
    await deleteProduct(deleteProduct_.id)
    toast({ title: '프로덕트/프로젝트 삭제됨', variant: 'destructive' })
    if (selectedProduct?.id === deleteProduct_.id) setSelectedProduct(null)
    setDeleteProduct_(null)
    await loadProducts()
  }

  // Suite CRUD
  function openSuiteCreate() {
    setSuiteForm({ name: '', version: '', type: 'dev', visibleRoles: [...VIEW_CONTROL_ROLES] })
    setSuiteDialog({ mode: 'create' })
  }
  function openSuiteEdit(s: TestSuite) {
    setSuiteForm({ name: s.name, version: s.version, type: s.type ?? 'qa', visibleRoles: s.visibleRoles ?? [...VIEW_CONTROL_ROLES] })
    setSuiteDialog({ mode: 'edit', target: s })
  }
  async function handleSuiteSave() {
    if (!suiteForm.name.trim() || !selectedProduct) return
    setSuiteSaving(true)
    try {
      if (suiteDialog?.mode === 'edit' && suiteDialog.target) {
        await updateSuite(suiteDialog.target.id, suiteForm)
        toast({ title: '수정 완료' })
      } else {
        await createSuite({ productId: selectedProduct.id, ...suiteForm }, suites.length)
        toast({ title: '추가 완료' })
      }
      setSuiteDialog(null)
      await loadSuites(selectedProduct.id)
    } finally { setSuiteSaving(false) }
  }
  async function handleSuiteDelete() {
    if (!deleteSuite_ || !selectedProduct) return
    await deleteSuite(deleteSuite_.id)
    toast({ title: '삭제됨', variant: 'destructive' })
    setDeleteSuite_(null)
    await loadSuites(selectedProduct.id)
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  async function handleDeleteAccount() {
    try {
      await deleteAccount()
      navigate('/login')
    } catch (e: unknown) {
      const code = (e as { code?: string }).code
      if (code === 'auth/requires-recent-login') {
        toast({
          title: '재로그인 필요',
          description: '보안을 위해 로그아웃 후 다시 로그인하여 탈퇴해주세요',
          variant: 'destructive',
        })
      } else {
        toast({ title: '계정 삭제 실패', description: String((e as Error).message), variant: 'destructive' })
      }
    }
  }

  // 역할 기준 노출 필터 (admin/developer는 전체 노출)
  const visibleProducts = applyProductOrder(products.filter((p) => canViewByRole(p.visibleRoles, user?.role)), productOrder)
  const visibleSuites = suites.filter((s) => canViewByRole(s.visibleRoles, user?.role))

  // 사용자별 숨김 필터 (역할 필터 통과분 중에서)
  const hiddenCount = visibleSuites.filter((s) => hiddenSuiteIds.has(s.id)).length
  const displayedSuites = showHidden ? visibleSuites : visibleSuites.filter((s) => !hiddenSuiteIds.has(s.id))

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-800">에버온 이슈트래커</h1>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/requests')}>
              <Inbox className="w-4 h-4" /> 개발요청
            </Button>
          )}
          {user?.role === 'admin' && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
              <Users className="w-4 h-4" /> 사용자 관리
            </Button>
          )}
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
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="w-4 h-4" /> 로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Products */}
        <aside className="w-60 bg-white border-r flex flex-col shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">프로덕트/프로젝트</span>
            {canManageProduct && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openProductCreate}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {loadingProducts ? (
              <div className="space-y-1 px-2 pt-1">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />)}
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm px-4">
                <Package className="w-7 h-7 mx-auto mb-2 opacity-30" />
                {canManageProduct
                  ? <button className="text-primary hover:underline text-xs" onClick={openProductCreate}>+ 추가</button>
                  : '프로덕트/프로젝트가 없습니다'}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProductDragEnd}>
                <SortableContext items={visibleProducts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  {visibleProducts.map((p) => (
                    <SortableProduct
                      key={p.id}
                      product={p}
                      selected={selectedProduct?.id === p.id}
                      canManage={canManageProduct}
                      canReorder={!!user}
                      restricted={isAdmin && isRoleRestricted(p.visibleRoles)}
                      onSelect={() => setSelectedProduct(p)}
                      onEdit={() => openProductEdit(p)}
                      onDelete={() => setDeleteProduct_(p)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </aside>

        {/* Middle: QA 테스트 */}
        {selectedProduct && (
          <aside className="w-56 bg-white border-r flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">QA 테스트</span>
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openQaCreate} title="QA 테스트 묶음 추가">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {qaGroups.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs px-2">
                  {isAdmin
                    ? <button className="text-primary hover:underline" onClick={openQaCreate}>+ QA 테스트 추가</button>
                    : 'QA 테스트 없음'}
                </div>
              ) : (
                qaGroups.map((g) => (
                  <div
                    key={g.id}
                    className="group bg-white border rounded-lg px-3 py-2.5 cursor-pointer hover:shadow-sm hover:border-primary/40 transition"
                    onClick={() => navigate(`/products/${selectedProduct.id}/qa/${g.id}`)}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-sm font-medium text-slate-700 break-words min-w-0">{g.name}</span>
                      {isAdmin && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                          <button className="p-0.5 rounded hover:bg-slate-100 text-slate-400" onClick={(e) => { e.stopPropagation(); openQaEdit(g) }}>
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button className="p-0.5 rounded hover:bg-red-50 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteQaGroup_(g) }}>
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {g.deployDate && <p className="text-[11px] text-slate-400 mt-0.5">{g.deployDate}</p>}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Right: Suites */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
            <span className="text-sm font-semibold text-slate-600">
              {selectedProduct ? selectedProduct.name : '프로덕트/프로젝트를 선택하세요'}
            </span>
            <div className="flex items-center gap-3">
              {selectedProduct && hiddenCount > 0 && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Switch checked={showHidden} onChange={setShowHidden} aria-label="숨긴 묶음 표시" />
                  <span className="text-sm text-slate-500">숨긴 묶음 표시 ({hiddenCount})</span>
                </label>
              )}
              {canManageSuite && selectedProduct && (
                <Button size="sm" onClick={openSuiteCreate}>
                  <Plus /> 묶음 추가
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!selectedProduct ? (
              <div className="text-center py-20 text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">좌측에서 프로덕트/프로젝트를 선택하세요</p>
              </div>
            ) : loadingSuites ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-200 animate-pulse" />)}
              </div>
            ) : visibleSuites.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">묶음이 없습니다</p>
                {canManageSuite && <Button className="mt-3" size="sm" onClick={openSuiteCreate}><Plus /> 묶음 추가</Button>}
              </div>
            ) : displayedSuites.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <EyeOff className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">모든 묶음을 숨겼습니다</p>
                <Button className="mt-3" variant="outline" size="sm" onClick={() => setShowHidden(true)}>
                  <Eye className="w-4 h-4" /> 숨긴 묶음 {hiddenCount}개 보기
                </Button>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSuiteDragEnd}>
                <SortableContext items={displayedSuites.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {displayedSuites.map((s) => (
                      <SortableSuite
                        key={s.id}
                        suite={s}
                        stats={suiteStats[s.id]}
                        canManage={canManageSuite}
                        restricted={isAdmin && isRoleRestricted(s.visibleRoles)}
                        hidden={hiddenSuiteIds.has(s.id)}
                        onOpen={() => navigate(`/products/${selectedProduct.id}/suites/${s.id}`)}
                        onEdit={() => openSuiteEdit(s)}
                        onDelete={() => setDeleteSuite_(s)}
                        onToggleHide={() => toggleSuiteHidden(s.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </main>
      </div>

      {/* Product Dialog */}
      <Dialog open={!!productDialog} onOpenChange={(o) => !o && setProductDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{productDialog?.mode === 'edit' ? '프로덕트/프로젝트 수정' : '새 프로덕트/프로젝트'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input placeholder="예: 에버온 앱 v2.0" value={productForm.name}
                onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>설명</Label>
              <Textarea placeholder="테스트 대상에 대한 간단한 설명" value={productForm.description} rows={3}
                onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Jira 프로젝트 키 <span className="text-xs text-slate-400 font-normal">— 첫 번째가 대표(이슈 티켓 생성용), 나머지는 QA 조회용</span></Label>
              <div className="flex gap-2">
                <Input
                  placeholder="예: APP (입력 후 Enter)"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKey() } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addKey} disabled={!keyInput.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {productForm.jiraProjectKeys.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {productForm.jiraProjectKeys.map((k, i) => (
                    <span key={k} className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full font-mono">
                      {k}{i === 0 && <span className="text-[10px] text-primary font-sans">대표</span>}
                      <button type="button" onClick={() => removeKey(k)} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 영역 관리 */}
            <div className="space-y-2">
              <Label>테스트 영역 <span className="text-xs text-slate-400 font-normal">— 없으면 자유 입력</span></Label>
              <div className="flex gap-2">
                <Input
                  placeholder="영역명 입력 후 Enter"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  onCompositionStart={() => { areaComposing.current = true }}
                  onCompositionEnd={() => { areaComposing.current = false }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !areaComposing.current) { e.preventDefault(); addArea() } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addArea} disabled={!areaInput.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {productForm.areas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {productForm.areas.map((area) => (
                    <span key={area} className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full">
                      {area}
                      <button type="button" onClick={() => removeArea(area)} className="text-slate-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <VisibleRolesField
              value={productForm.visibleRoles}
              onChange={(roles) => setProductForm((f) => ({ ...f, visibleRoles: roles }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialog(null)}>취소</Button>
            <Button onClick={handleProductSave} disabled={!productForm.name.trim() || productSaving}>
              {productSaving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suite Dialog */}
      <Dialog open={!!suiteDialog} onOpenChange={(o) => !o && setSuiteDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{suiteDialog?.mode === 'edit' ? '묶음 수정' : '새 묶음'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input placeholder="예: v2.1 릴리즈" value={suiteForm.name}
                onChange={(e) => setSuiteForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>버전/태그</Label>
              <Input placeholder="예: v2.1.0" value={suiteForm.version}
                onChange={(e) => setSuiteForm((f) => ({ ...f, version: e.target.value }))} />
            </div>

            <VisibleRolesField
              value={suiteForm.visibleRoles}
              onChange={(roles) => setSuiteForm((f) => ({ ...f, visibleRoles: roles }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuiteDialog(null)}>취소</Button>
            <Button onClick={handleSuiteSave} disabled={!suiteForm.name.trim() || suiteSaving}>
              {suiteSaving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirms */}
      <AlertDialog open={!!deleteProduct_} onOpenChange={(o) => !o && setDeleteProduct_(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프로덕트/프로젝트 삭제</AlertDialogTitle>
            <AlertDialogDescription>"{deleteProduct_?.name}"을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleProductDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSuite_} onOpenChange={(o) => !o && setDeleteSuite_(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>묶음 삭제</AlertDialogTitle>
            <AlertDialogDescription>"{deleteSuite_?.name}"을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleSuiteDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QA 테스트 묶음 생성/수정 */}
      <Dialog open={!!qaDialog} onOpenChange={(o) => !o && setQaDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{qaDialog?.mode === 'edit' ? 'QA 테스트 수정' : '새 QA 테스트'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>이름 * <span className="text-xs text-slate-400 font-normal">— 배포예정 기능명 등</span></Label>
              <Input placeholder="예: 출하요청 개선" value={qaForm.name}
                onChange={(e) => setQaForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>배포 예정일</Label>
              <input type="date" className="h-9 w-full px-3 text-sm border rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={qaForm.deployDate} onChange={(e) => setQaForm((f) => ({ ...f, deployDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQaDialog(null)}>취소</Button>
            <Button onClick={handleQaSave} disabled={!qaForm.name.trim() || qaSaving}>
              {qaSaving ? '저장 중...' : (qaDialog?.mode === 'edit' ? '저장' : '생성')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteQaGroup_} onOpenChange={(o) => !o && setDeleteQaGroup_(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>QA 테스트 삭제</AlertDialogTitle>
            <AlertDialogDescription>"{deleteQaGroup_?.name}"과 그 안의 모든 체크 항목을 삭제하시겠습니까?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleQaDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pwModalOpen} onOpenChange={setPwModalOpen}>
        <ChangePasswordModal onClose={() => setPwModalOpen(false)} />
      </Dialog>

      <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계정 탈퇴</AlertDialogTitle>
            <AlertDialogDescription>
              정말 탈퇴하시겠습니까? 계정이 영구 삭제되며 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              탈퇴하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
